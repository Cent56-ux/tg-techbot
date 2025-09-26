import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, eventsList, actionKeyboard, editMenuKeyboard } from './ui/messages';
import { listUpcoming, nextEvent, updateEvent, type EventRow } from './tools/events';
import { setParticipant } from './tools/participants';

export const bot = new Telegraf(CFG.botToken);

bot.command('id', async (ctx) => {
  await ctx.reply(`chat id: ${ctx.chat?.id}`);
});

bot.command('list', async (ctx) => {
  const events = await listUpcoming(5);
  if (!events.length) {
    await ctx.reply('📭 Keine anstehenden Events.');
    return;
  }
  await ctx.reply(eventsList(events));
});

bot.command('next', async (ctx) => {
  const ev = await nextEvent();
  if (!ev) {
    await ctx.reply('📭 Kein kommendes Event gefunden.');
    return;
  }
  await ctx.reply(eventCard(ev), { reply_markup: actionKeyboard(ev.id) });
});
