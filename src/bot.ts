import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, rsvpKeyboard, eventsList } from './ui/messages';
import { statusFor } from './tools/events';
import { setParticipant } from './tools/participants';

export const bot = new Telegraf(CFG.botToken);

bot.command('id', async (ctx) => { try { await ctx.reply(`chat id: ${ctx.chat?.id}`); } catch (e) { console.error('/id error', e); } });

bot.command('events', async (ctx) => {
  try {
    const res = await converse('Liste die kommenden Events (max 5)', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'events_list') await ctx.reply(eventsList((res as any).events || []));
    else if ((res as any).text) await ctx.reply((res as any).text as string);
  } catch (e) { console.error('/events error', e); await ctx.reply('⚠️ Da ist etwas schiefgelaufen.'); }
});

bot.command('next', async (ctx) => {
  try {
    const res = await converse('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'status') {
      const { event, counts } = (res as any).payload;
      await ctx.reply(eventCard(event, counts), { reply_markup: rsvpKeyboard(event.id) });
    } else if ((res as any).text) await ctx.reply((res as any).text as string);
  } catch (e) { console.error('/next error', e); await ctx.reply('⚠️ Da ist etwas schiefgelaufen.'); }
});

bot.command('status', async (ctx) => ctx.scene?.enter ? null : (bot as any)); // no-op alias safeguard

// NEW: /edit parser (very simple key=value pairs)
bot.command('edit', async (ctx) => {
  try {
    const text = (ctx.message as any)?.text || '';
    const parts = text.split(/\s+/).slice(1); // after /edit
    const patch: any = {};
    for (const p of parts) {
      const [k, ...rest] = p.split('=');
      const v = rest.join('=');
      if (!k || !v) continue;
      if (/^title$/i.test(k)) patch.title = v;
      else if (/^presenter$/i.test(k)) patch.presenter = v;
      else if (/^description$/i.test(k)) patch.description = v;
      else if (/^duration|duration_minutes$/i.test(k)) patch.duration_minutes = Number(v);
      else if (/^start|start_at$/i.test(k)) patch.start_at = v;
      else if (/^recreate_zoom$/i.test(k)) patch.recreate_zoom = /^(1|true|yes|ja)$/i.test(v);
    }

    const res = await converse(JSON.stringify({ intent: 'events_update', patch }), { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'event_updated') {
      const ev = (res as any).event;
      await ctx.reply('Aktualisiert ✅\n' + eventCard(ev));
    } else if ((res as any).text) {
      await ctx.reply((res as any).text as string);
    } else {
      await ctx.reply('⚠️ Konnte das Update nicht verarbeiten.');
    }
  } catch (e) {
    console.error('/edit error', e);
    await ctx.reply('⚠️ Fehler beim Editieren.');
  }
});

bot.on('message', async (ctx) => {
  try {
    const text = (ctx.message as any)?.text || '';
    if (!text) return;
    const me = ctx.me ?? '';
    const mentioned = text.toLowerCase().includes('@' + me.toLowerCase());
    const looksLikeEvent = /neuer talk|vortrag|event|meeting|neue präsentation|verschieb|edit|änder|update/i.test(text);
    if (!mentioned && !looksLikeEvent) return;

    const res = await converse(text, { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });

    if ((res as any).type === 'event_created') {
      const ev = (res as any).event;
      const st = await statusFor(ev.id);
      await ctx.reply(eventCard(ev, st.counts), { reply_markup: rsvpKeyboard(ev.id) });
    } else if ((res as any).type === 'event_updated') {
      const ev = (res as any).event;
      await ctx.reply('Aktualisiert ✅\n' + eventCard(ev));
    } else if ((res as any).type === 'status') {
      const { event, counts } = (res as any).payload;
      await ctx.reply(eventCard(event, counts), { reply_markup: rsvpKeyboard(event.id) });
    } else if ((res as any).type === 'events_list') {
      await ctx.reply(eventsList((res as any).events || []));
    } else if ((res as any).type === 'announce') {
      await ctx.reply(((res as any).text as string) || '');
    } else if ((res as any).text) {
      await ctx.reply((res as any).text as string);
    }
  } catch (e) {
    console.error('on message error', e);
    try { await ctx.reply('⚠️ Konnte das nicht verarbeiten.'); } catch {}
  }
});

// RSVP-Buttons
bot.on('callback_query', async (ctx: any) => {
  try {
    const data = String(ctx.callbackQuery.data || '');
    const m = data.match(/^rsvp:(.+):(going|maybe|declined)$/);
    if (!m) return ctx.answerCbQuery();
    const [_, evId, status] = m;
    await setParticipant({
      event_id: evId, tg_user_id: ctx.from.id, display_name: ctx.from.first_name,
      status: status as 'going' | 'maybe' | 'declined'
    });
    await ctx.answerCbQuery('Gespeichert ✅');
  } catch (e) { console.error('callback error', e); try { await ctx.answerCbQuery('Fehler'); } catch {} }
});
