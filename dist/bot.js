"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const telegraf_1 = require("telegraf");
const config_1 = require("./config");
const llm_1 = require("./llm");
const messages_1 = require("./ui/messages");
const events_1 = require("./tools/events");
const participants_1 = require("./tools/participants");
exports.bot = new telegraf_1.Telegraf(config_1.CFG.botToken);
// Convenience: numeric group id (may be undefined)
const GID = config_1.CFG.groupId;
const memberCache = new Map();
const TTL_MS = 5 * 60 * 1000;
async function isGroupMember(userId) {
    if (!GID)
        return false; // without configured group, deny
    const now = Date.now();
    const hit = memberCache.get(userId);
    if (hit && now - hit.ts < TTL_MS)
        return hit.ok;
    try {
        const m = await exports.bot.telegram.getChatMember(GID, userId);
        const ok = ['creator', 'administrator', 'member'].includes(m.status);
        memberCache.set(userId, { ok, ts: now });
        return ok;
    }
    catch {
        memberCache.set(userId, { ok: false, ts: now });
        return false;
    }
}
// Middleware: only allow members; ignore other groups
exports.bot.use(async (ctx, next) => {
    const uid = ctx.from?.id;
    if (!uid)
        return;
    const chatId = ctx.chat?.id;
    const isPrivate = ctx.chat?.type === 'private';
    // 1) Ignore messages from other groups than the configured one
    if (chatId && chatId < 0 && GID !== undefined && chatId !== GID) {
        return;
    }
    // 2) In DMs, only allow if user is member of our group
    if (isPrivate) {
        const ok = await isGroupMember(uid);
        if (!ok) {
            try {
                await ctx.reply('Nur Mitglieder der Promptimals-Gruppe dürfen mir schreiben. 👋');
            }
            catch { }
            return;
        }
    }
    return next();
});
// ===== Commands =====
exports.bot.command('id', async (ctx) => {
    try {
        await ctx.reply(`chat id: ${ctx.chat?.id}`);
    }
    catch (e) {
        console.error('/id error', e);
    }
});
exports.bot.command('events', async (ctx) => {
    try {
        const res = await (0, llm_1.converse)('Liste die kommenden Events (max 5)', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
        if (res.type === 'events_list') {
            await ctx.reply((0, messages_1.eventsList)(res.events || []));
        }
        else if (res.text) {
            await ctx.reply(res.text);
        }
    }
    catch (e) {
        console.error('/events error', e);
        await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
    }
});
exports.bot.command('next', async (ctx) => {
    try {
        const res = await (0, llm_1.converse)('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
        if (res.type === 'status') {
            const { event, counts } = res.payload;
            await ctx.reply((0, messages_1.eventCard)(event, counts), { reply_markup: (0, messages_1.actionKeyboard)(event.id) });
        }
        else if (res.text) {
            await ctx.reply(res.text);
        }
    }
    catch (e) {
        console.error('/next error', e);
        await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
    }
});
exports.bot.command('status', async (ctx) => {
    try {
        const res = await (0, llm_1.converse)('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
        if (res.type === 'status') {
            const { event, counts } = res.payload;
            await ctx.reply((0, messages_1.eventCard)(event, counts), { reply_markup: (0, messages_1.actionKeyboard)(event.id) });
        }
        else if (res.text) {
            await ctx.reply(res.text);
        }
    }
    catch (e) {
        console.error('/status error', e);
        await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
    }
});
// Manual /edit (admin-gated in group; DM allowed for members)
exports.bot.command('edit', async (ctx) => {
    try {
        if (ctx.chat?.id && GID !== undefined && ctx.chat.id === GID) {
            try {
                const member = await ctx.telegram.getChatMember(GID, ctx.from.id);
                const isAdmin = ['creator', 'administrator'].includes(member.status);
                if (!isAdmin) {
                    await ctx.reply('Nur Admins dürfen bearbeiten.');
                    return;
                }
            }
            catch {
                await ctx.reply('Bearbeitung nicht erlaubt.');
                return;
            }
        }
        const text = ctx.message?.text || '';
        const parts = text.split(/\s+/).slice(1);
        const patch = {};
        for (const p of parts) {
            const [k, ...rest] = p.split('=');
            const v = rest.join('=');
            if (!k || !v)
                continue;
            if (/^title$/i.test(k))
                patch.title = v.replace(/_/g, ' ');
            else if (/^presenter$/i.test(k))
                patch.presenter = v.replace(/_/g, ' ');
            else if (/^description$/i.test(k))
                patch.description = v.replace(/_/g, ' ');
            else if (/^duration|duration_minutes$/i.test(k))
                patch.duration_minutes = Number(v);
            else if (/^start|start_at$/i.test(k))
                patch.start_at = v;
            else if (/^recreate_zoom$/i.test(k))
                patch.recreate_zoom = /^(1|true|yes|ja)$/i.test(v);
        }
        const res = await (0, llm_1.converse)(JSON.stringify({ intent: 'events_update', patch }), { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
        if (res.type === 'event_updated') {
            const ev = res.event;
            await ctx.reply('Aktualisiert ✅\n' + (0, messages_1.eventCard)(ev), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
        }
        else if (res.text) {
            await ctx.reply(res.text);
        }
        else {
            await ctx.reply('⚠️ Konnte das Update nicht verarbeiten.');
        }
    }
    catch (e) {
        console.error('/edit error', e);
        await ctx.reply('⚠️ Fehler beim Editieren.');
    }
});
// ===== Messages =====
exports.bot.on('message', async (ctx) => {
    try {
        const text = ctx.message?.text || '';
        if (!text)
            return;
        // Ignore other groups
        if (ctx.chat?.id && ctx.chat.id < 0 && GID !== undefined && ctx.chat.id !== GID)
            return;
        const me = ctx.me ?? '';
        const mentioned = text.toLowerCase().includes('@' + me.toLowerCase());
        const looksLikeEvent = /neuer talk|vortrag|event|meeting|neue präsentation|verschieb|edit|änder|update/i.test(text);
        if (ctx.chat?.type === 'private' || mentioned || looksLikeEvent) {
            const res = await (0, llm_1.converse)(text, { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
            if (res.type === 'event_created') {
                const ev = res.event;
                const st = await (0, events_1.statusFor)(ev.id);
                await ctx.reply((0, messages_1.eventCard)(ev, st.counts), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
            }
            else if (res.type === 'event_updated') {
                const ev = res.event;
                await ctx.reply('Aktualisiert ✅\n' + (0, messages_1.eventCard)(ev), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
            }
            else if (res.type === 'status') {
                const { event, counts } = res.payload;
                await ctx.reply((0, messages_1.eventCard)(event, counts), { reply_markup: (0, messages_1.actionKeyboard)(event.id) });
            }
            else if (res.type === 'events_list') {
                await ctx.reply((0, messages_1.eventsList)(res.events || []));
            }
            else if (res.type === 'announce') {
                await ctx.reply(res.text || '');
            }
            else if (res.text) {
                await ctx.reply(res.text);
            }
        }
    }
    catch (e) {
        console.error('on message error', e);
        try {
            await ctx.reply('⚠️ Konnte das nicht verarbeiten.');
        }
        catch { }
    }
});
// ===== Callback-Queries =====
exports.bot.on('callback_query', async (ctx) => {
    try {
        const data = String(ctx.callbackQuery.data || '');
        // Ignore other groups
        if (ctx.chat?.id && ctx.chat.id < 0 && GID !== undefined && ctx.chat.id !== GID) {
            await ctx.answerCbQuery();
            return;
        }
        // RSVP
        let m = data.match(/^rsvp:(.+):(going|maybe|declined)$/);
        if (m) {
            const [_, evId, status] = m;
            await (0, participants_1.setParticipant)({
                event_id: evId,
                tg_user_id: ctx.from.id,
                display_name: ctx.from.first_name,
                status: status
            });
            await ctx.answerCbQuery('Gespeichert ✅');
            return;
        }
        // Edit (admin-gated)
        m = data.match(/^edit:([a-z0-9-]+)(?::(.+))?$/i);
        if (m) {
            if (GID === undefined) {
                await ctx.answerCbQuery('Gruppe nicht konfiguriert.');
                return;
            }
            const evId = m[1];
            const rest = m[2] || '';
            try {
                const member = await ctx.telegram.getChatMember(GID, ctx.from.id);
                const isAdmin = ['creator', 'administrator'].includes(member.status);
                if (!isAdmin) {
                    await ctx.answerCbQuery('Nur Admins dürfen bearbeiten.', { show_alert: true });
                    return;
                }
            }
            catch {
                await ctx.answerCbQuery('Bearbeitung nicht erlaubt.', { show_alert: true });
                return;
            }
            if (!rest) {
                await ctx.answerCbQuery();
                try {
                    await ctx.editMessageReplyMarkup((0, messages_1.editMenuKeyboard)(evId));
                }
                catch {
                    await ctx.reply('Was möchtest du ändern?', { reply_markup: (0, messages_1.editMenuKeyboard)(evId) });
                }
                return;
            }
            if (rest.startsWith('shift:')) {
                const minutes = parseInt(rest.split(':')[1], 10);
                const st = await (0, events_1.statusFor)(evId);
                const oldStart = new Date(st.event.start_at);
                const newStart = new Date(oldStart.getTime() + minutes * 60000).toISOString();
                const ev = await (0, events_1.updateEvent)({ id: evId, patch: { start_at: newStart } });
                await ctx.answerCbQuery('Zeit aktualisiert ✅');
                try {
                    await ctx.editMessageText((0, messages_1.eventCard)(ev, st.counts), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
                }
                catch {
                    await ctx.reply('Aktualisiert ✅\n' + (0, messages_1.eventCard)(ev), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
                }
                return;
            }
            if (rest.startsWith('tomorrow:')) {
                const hhmm = rest.split(':').slice(1).join(':');
                const d = new Date();
                d.setDate(d.getDate() + 1);
                const [hh, mm] = hhmm.split(':').map(Number);
                d.setHours(hh, mm, 0, 0);
                const ev = await (0, events_1.updateEvent)({ id: evId, patch: { start_at: d.toISOString() } });
                await ctx.answerCbQuery('Auf morgen gesetzt ✅');
                await ctx.reply('Aktualisiert ✅\n' + (0, messages_1.eventCard)(ev), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
                return;
            }
            if (rest === 'zoom') {
                const ev = await (0, events_1.updateEvent)({ id: evId, patch: { recreate_zoom: true } });
                await ctx.answerCbQuery('Zoom neu erstellt ✅');
                await ctx.reply('Aktualisiert ✅\n' + (0, messages_1.eventCard)(ev), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
                return;
            }
            if (rest === 'help') {
                await ctx.answerCbQuery();
                await ctx.reply([
                    'Bearbeiten-Hilfe:',
                    '• /edit start=2025-10-01T19:00',
                    '• /edit title=Neuer_Titel',
                    '• /edit presenter=Alex',
                    '• /edit duration=45',
                    '• /edit recreate_zoom=true'
                ].join('\n'));
                return;
            }
        }
        await ctx.answerCbQuery();
    }
    catch (e) {
        console.error('callback error', e);
        try {
            await ctx.answerCbQuery('Fehler');
        }
        catch { }
    }
});
