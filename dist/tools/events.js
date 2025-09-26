"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsCreate = eventsCreate;
exports.nextEvent = nextEvent;
exports.listUpcoming = listUpcoming;
exports.statusFor = statusFor;
exports.markReminder = markReminder;
exports.updateEvent = updateEvent;
exports.deleteEvent = deleteEvent;
const supabase_1 = require("../db/supabase");
const nowISO = () => new Date().toISOString();
/** Neues Event anlegen */
async function eventsCreate(input) {
    const payload = {
        title: input.title,
        start_at: input.start_at,
        duration_minutes: input.duration_minutes ?? 30,
        presenter: input.presenter ?? null,
        description: input.description ?? null,
        zoom_join_url: input.zoom_join_url ?? null,
        reminder_48h_posted: false,
        reminder_15m_posted: false,
    };
    const { data, error } = await supabase_1.sb.from('events').insert(payload).select().single();
    if (error)
        throw error;
    return data;
}
/** Nächstes (zukünftiges) Event – optional nach einem bestimmten Zeitpunkt */
async function nextEvent(afterISO) {
    const gtISO = afterISO ?? nowISO();
    const { data, error } = await supabase_1.sb
        .from('events')
        .select('*')
        .gt('start_at', gtISO)
        .order('start_at', { ascending: true })
        .limit(1);
    if (error)
        throw error;
    return (data && data[0]) ? data[0] : null;
}
/** Liste kommender Events */
async function listUpcoming(limit = 5) {
    const { data, error } = await supabase_1.sb
        .from('events')
        .select('*')
        .gt('start_at', nowISO())
        .order('start_at', { ascending: true })
        .limit(limit);
    if (error)
        throw error;
    return data;
}
/** Status zu Event (inkl. RSVP-Zählung) */
async function statusFor(eventId) {
    const evQ = await supabase_1.sb.from('events').select('*').eq('id', eventId).single();
    if (evQ.error)
        throw evQ.error;
    const event = evQ.data;
    const goingQ = await supabase_1.sb.from('participants').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('status', 'going');
    const maybeQ = await supabase_1.sb.from('participants').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('status', 'maybe');
    const totalQ = await supabase_1.sb.from('participants').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);
    const counts = {
        going: goingQ.count || 0,
        maybe: maybeQ.count || 0,
        total: totalQ.count || 0,
    };
    return { event, counts };
}
/** Reminder-Flag setzen */
async function markReminder(eventId, which) {
    const column = which === '48h' ? 'reminder_48h_posted' : 'reminder_15m_posted';
    const { error } = await supabase_1.sb.from('events').update({ [column]: true }).eq('id', eventId);
    if (error)
        throw error;
}
/** Event patchen (einfacher Updater); gibt das aktualisierte Event zurück */
async function updateEvent(opts) {
    const { id, patch } = opts;
    // Wenn recreate_zoom gesetzt ist, entfernen wir vorhandenen Link – dein Zoom-Tool setzt später neu.
    const finalPatch = { ...patch };
    if (patch.recreate_zoom) {
        finalPatch.zoom_join_url = null;
        delete finalPatch.recreate_zoom;
    }
    const { data, error } = await supabase_1.sb.from('events').update(finalPatch).eq('id', id).select().single();
    if (error)
        throw error;
    return data;
}
/**
 * Event löschen (inkl. Teilnehmer).
 * - Mit/ohne FK-CASCADE robust: erst participants, dann event.
 */
async function deleteEvent(evId) {
    const pDel = await supabase_1.sb.from('participants').delete().eq('event_id', evId);
    if (pDel.error)
        throw pDel.error;
    const eDel = await supabase_1.sb.from('events').delete().eq('id', evId).select().single();
    if (eDel.error)
        throw eDel.error;
    return eDel.data;
}
