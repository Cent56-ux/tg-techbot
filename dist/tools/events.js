"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsCreate = eventsCreate;
exports.updateEvent = updateEvent;
exports.nextEvent = nextEvent;
exports.listUpcoming = listUpcoming;
exports.statusFor = statusFor;
exports.markReminder = markReminder;
const supabase_1 = require("../db/supabase");
const zoom_1 = require("./zoom");
// Normalize date to UTC and fix obvious past years from LLM parsing
function toUtcWithYearFix(inputIso) {
    const now = new Date();
    let dt = new Date(inputIso);
    if (isNaN(dt.getTime()))
        dt = new Date(String(inputIso).replace(' ', 'T'));
    const dayMs = 24 * 60 * 60 * 1000;
    if (dt.getTime() < now.getTime() - dayMs) {
        dt.setFullYear(now.getFullYear());
        if (dt.getTime() < now.getTime() - dayMs)
            dt.setFullYear(now.getFullYear() + 1);
    }
    return dt.toISOString();
}
async function eventsCreate(p) {
    const startUtc = toUtcWithYearFix(p.start_at);
    let zoom_join_url, zoom_meeting_id;
    if (p.create_zoom !== false) {
        const z = await (0, zoom_1.createMeeting)({ title: p.title, start_at: startUtc, duration_minutes: p.duration_minutes });
        zoom_join_url = z.join_url;
        zoom_meeting_id = z.meeting_id;
    }
    const { data, error } = await supabase_1.sb.from('events').insert([{
            title: p.title, description: p.description, start_at: startUtc, duration_minutes: p.duration_minutes,
            presenter: p.presenter, zoom_join_url, zoom_meeting_id, created_by: p.created_by
        }]).select().single();
    if (error)
        throw error;
    return data;
}
async function updateEvent(p) {
    let eventId = p.id;
    if (!eventId) {
        const ne = await nextEvent(new Date().toISOString());
        if (!ne)
            throw new Error('Kein kommendes Event gefunden.');
        eventId = ne.id;
    }
    const patch = {};
    if (p.patch.title)
        patch.title = p.patch.title;
    if (p.patch.presenter)
        patch.presenter = p.patch.presenter;
    if (typeof p.patch.duration_minutes === 'number')
        patch.duration_minutes = p.patch.duration_minutes;
    if (p.patch.description !== undefined)
        patch.description = p.patch.description;
    if (p.patch.start_at)
        patch.start_at = toUtcWithYearFix(p.patch.start_at);
    // Zoom ggf. neu erzeugen
    if (p.patch.recreate_zoom) {
        const base = await supabase_1.sb.from('events').select('*').eq('id', eventId).single();
        if (base.error)
            throw base.error;
        const start = patch.start_at || base.data.start_at;
        const dur = patch.duration_minutes ?? base.data.duration_minutes;
        const title = patch.title || base.data.title;
        const z = await (0, zoom_1.createMeeting)({ title, start_at: start, duration_minutes: dur });
        patch.zoom_join_url = z.join_url;
        patch.zoom_meeting_id = z.meeting_id;
    }
    const { data, error } = await supabase_1.sb.from('events').update(patch).eq('id', eventId).select().single();
    if (error)
        throw error;
    return data;
}
async function nextEvent(nowIso) {
    const { data, error } = await supabase_1.sb.from('events').select('*').gte('start_at', nowIso).order('start_at', { ascending: true }).limit(1);
    if (error)
        throw error;
    return data?.[0] || null;
}
async function listUpcoming(limit = 5) {
    const { data, error } = await supabase_1.sb.from('events').select('*').gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(Math.max(1, Math.min(limit, 10)));
    if (error)
        throw error;
    return data || [];
}
async function statusFor(event_id) {
    const evQ = await supabase_1.sb.from('events').select('*').eq('id', event_id).single();
    if (evQ.error)
        throw evQ.error;
    const going = await supabase_1.sb.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event_id).eq('status', 'going');
    const maybe = await supabase_1.sb.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event_id).eq('status', 'maybe');
    const total = await supabase_1.sb.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event_id);
    return { event: evQ.data, counts: { going: going.count || 0, maybe: maybe.count || 0, total: total.count || 0 } };
}
async function markReminder(event_id, kind) {
    const patch = kind === '48h' ? { reminder_48h_posted: true } : { reminder_15m_posted: true };
    const { error } = await supabase_1.sb.from('events').update(patch).eq('id', event_id);
    if (error)
        throw error;
}
