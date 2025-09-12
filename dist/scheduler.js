"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tick = tick;
const bot_1 = require("./bot");
const supabase_1 = require("./db/supabase");
const config_1 = require("./config");
const events_1 = require("./tools/events");
async function tick() {
    // If groupId is not configured yet, skip scheduler work
    if (config_1.CFG.groupId === undefined)
        return;
    const now = new Date();
    const win48Start = new Date(now.getTime() + 45 * 60 * 60 * 1000);
    const win48End = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const win15Start = new Date(now.getTime() + 10 * 60 * 1000);
    const win15End = new Date(now.getTime() + 15 * 60 * 1000);
    { // 48h Reminder
        const { data, error } = await supabase_1.sb.from('events')
            .select('*')
            .eq('reminder_48h_posted', false)
            .gt('start_at', win48Start.toISOString())
            .lt('start_at', win48End.toISOString());
        if (!error) {
            for (const ev of data || []) {
                const st = await (0, events_1.statusFor)(ev.id);
                const text = `⏰ In 48h: ${ev.title}\n👥 Zusagen: ${st.counts.going} · Maybe: ${st.counts.maybe}\n🔗 ${ev.zoom_join_url || ''}`.trim();
                await bot_1.bot.telegram.sendMessage(config_1.CFG.groupId, text);
                await (0, events_1.markReminder)(ev.id, '48h');
            }
        }
        else {
            console.error(error);
        }
    }
    { // 15m Reminder
        const { data, error } = await supabase_1.sb.from('events')
            .select('*')
            .eq('reminder_15m_posted', false)
            .gt('start_at', win15Start.toISOString())
            .lt('start_at', win15End.toISOString());
        if (!error) {
            for (const ev of data || []) {
                const text = `🔔 In 15 Minuten: ${ev.title}\n${ev.zoom_join_url || ''}`.trim();
                await bot_1.bot.telegram.sendMessage(config_1.CFG.groupId, text);
                await (0, events_1.markReminder)(ev.id, '15m');
            }
        }
        else {
            console.error(error);
        }
    }
}
