"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setParticipant = setParticipant;
const supabase_1 = require("../db/supabase");
async function setParticipant(p) {
    const { data, error } = await supabase_1.sb.from('participants').upsert({
        event_id: p.event_id, tg_user_id: p.tg_user_id, display_name: p.display_name, status: p.status
    }, { onConflict: 'event_id,tg_user_id' }).select().single();
    if (error)
        throw error;
    return data;
}
