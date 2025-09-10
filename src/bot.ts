import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, rsvpKeyboard } from './ui/messages';
import { statusFor } from './tools/events';
import { setParticipant } from './tools/participants';

export const bot = new Telegraf(CFG.botToken);

bot.command('id', async (ctx) => { await ctx.reply(`chat id: ${ctx.chat?.id}`); });

bot.command('next', async (ctx) => {
  const res = await converse('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
  if (res.type === 'status') {
    const { event, counts } = res.payload;
    await ctx.reply(eventCard(event, counts), { reply_to_message_id: ctx.message?.message_id, reply_markup: rsvpKeyboard(event.id) });
  } else if ('text' in res) await ctx.reply(res.text);
});

bot.command('status', async (ctx) => {
  const res = await converse('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
  if (res.type === 'status') {
    const { event, counts } = res.payload;
    await ctx.reply(eventCard(event, counts), { reply_to_message_id: ctx.message?.message_id, reply_markup: rsvpKeyboard(event.id) });
  } else if ('text' in res) await ctx.reply(res.text);
});

bot.on('message', async (ctx) => {
  const text = (ctx.message as any)?.text || '';
  if (!text) return;
  const me = ctx.me ?? '';
  const mentioned = text.toLowerCase().includes('@' + me.toLowerCase());
  const looksLikeEvent = /neuer talk|vortrag|event|meeting|neue präsentation/i.test(text);

  if (!mentioned && !looksLikeEvent) return;

  const res = await converse(text, { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });

  if (res.type === 'event_created') {
    const { event } = res;
    const st = await statusFor(event.id);
    await ctx.reply(eventCard(event, st.counts), { reply_to_message_id: ctx.message?.message_id, reply_markup: rsvpKeyboard(event.id) });
  } else if (res.type === 'status') {
    const { event, counts } = res.payload;
    await ctx.reply(eventCard(event, counts), { reply_to_message_id: ctx.message?.message_id, reply_markup: rsvpKeyboard(event.id) });
  } else if (res.type === 'announce') {
    await ctx.reply(res.text, { reply_to_message_id: ctx.message?.message_id });
  } else if ('text' in res) {
    await ctx.reply(res.text, { reply_to_message_id: ctx.message?.message_id });
  }
});

bot.on('callback_query', async (ctx: any) => {
  const data = String(ctx.callbackQuery.data || '');
  const m = data.match(/^rsvp:(.+):(going|maybe|declined)$/);
  if (!m) return ctx.answerCbQuery();
  const [_, evId, status] = m;
  await setParticipant({ event_id: evId, tg_user_id: ctx.from.id, display_name: ctx.from.first_name, status });
  await ctx.answerCbQuery('Gespeichert ✅');
});
