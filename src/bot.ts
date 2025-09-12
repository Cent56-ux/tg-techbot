import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, rsvpKeyboard, eventsList } from './ui/messages';
import { statusFor } from './tools/events';
import { setParticipant } from './tools/participants';

export const bot = new Telegraf(CFG.botToken);

// Chat-ID diagnostizieren
bot.command('id', async (ctx) => {
  try { await ctx.reply(`chat id: ${ctx.chat?.id}`); } catch (e) { console.error('/id error', e); }
});

// Liste kommender Events
bot.command('events', async (ctx) => {
  try {
    const res = await converse('Liste die kommenden Events (max 5)', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'events_list') {
      await ctx.reply(eventsList((res as any).events || []));
    } else if ((res as any).text) {
      await ctx.reply((res as any).text as string);
    }
  } catch (e) {
    console.error('/events error', e);
    await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
  }
});

// /next → nächstes Event (Status)
bot.command('next', async (ctx) => {
  try {
    const res = await converse('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'status') {
      const payload = (res as any).payload;
      const { event, counts } = payload;
      await ctx.reply(eventCard(event, counts), { reply_markup: rsvpKeyboard(event.id) });
    } else if ((res as any).text) {
      await ctx.reply((res as any).text as string);
    }
  } catch (e) {
    console.error('/next error', e);
    await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
  }
});

// /status → Alias
bot.command('status', async (ctx) => {
  try {
    const res = await converse('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'status') {
      const payload = (res as any).payload;
      const { event, counts } = payload;
      await ctx.reply(eventCard(event, counts), { reply_markup: rsvpKeyboard(event.id) });
    } else if ((res as any).text) {
      await ctx.reply((res as any).text as string);
    }
  } catch (e) {
    console.error('/status error', e);
    await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
  }
});

// Gruppen-Nachrichten
bot.on('message', async (ctx) => {
  try {
    const text = (ctx.message as any)?.text || '';
    if (!text) return;
    const me = ctx.me ?? '';
    const mentioned = text.toLowerCase().includes('@' + me.toLowerCase());
    const looksLikeEvent = /neuer talk|vortrag|event|meeting|neue präsentation/i.test(text);
    if (!mentioned && !looksLikeEvent) return;

    const res = await converse(text, { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });

    if ((res as any).type === 'event_created') {
      const ev = (res as any).event;
      const st = await statusFor(ev.id);
      await ctx.reply(eventCard(ev, st.counts), { reply_markup: rsvpKeyboard(ev.id) });
    } else if ((res as any).type === 'status') {
      const payload = (res as any).payload;
      const { event, counts } = payload;
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
      event_id: evId,
      tg_user_id: ctx.from.id,
      display_name: ctx.from.first_name,
      status: status as 'going' | 'maybe' | 'declined'
    });
    await ctx.answerCbQuery('Gespeichert ✅');
  } catch (e) {
    console.error('callback error', e);
    try { await ctx.answerCbQuery('Fehler'); } catch {}
  }
});
