"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUpcoming = listUpcoming;
exports.nextEvent = nextEvent;
exports.updateEvent = updateEvent;
const supabase_1 = require("../db/supabase");
const nowISO = () => new Date().toISOString();
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
    return data && data[0] ? data[0] : null;
}
async function updateEvent(opts) {
    const { id, patch } = opts;
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
