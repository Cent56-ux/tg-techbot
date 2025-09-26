import { listUpcoming, updateEvent, markReminder, statusFor } from './tools/events';
import { Telegraf } from 'telegraf';

export function startScheduler(bot: Telegraf, chatId: number) {
  setInterval(async () => {
    const upcoming = await listUpcoming(50);
    const now = Date.now();
    for (const e of upcoming) {
      const t = new Date(e.start_at).getTime();
      const mins = Math.round((t - now) / 60000);
      if (!e.reminder_48h_posted && mins <= 2880 && mins > 2700) {
        await bot.telegram.sendMessage(chatId, `⏰ In 48h: ${e.title}`);
        await markReminder(e.id, '48h');
      }
      if (!e.reminder_15m_posted && mins <= 15 && mins >= 0) {
        await bot.telegram.sendMessage(chatId, `⏰ In 15 Min: ${e.title}`);
        await markReminder(e.id, '15m');
      }
    }
  }, 60_000);
}
