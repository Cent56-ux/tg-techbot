import { bot } from './bot';
import { sb } from './db/supabase';
import { CFG } from './config';
import { markReminder, statusFor } from './tools/events';

export async function tick() {
  const now = new Date();

  const win48Start = new Date(now.getTime() + 45 * 60 * 60 * 1000);
  const win48End = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const win15Start = new Date(now.getTime() + 10 * 60 * 1000);
  const win15End = new Date(now.getTime() + 15 * 60 * 1000);

  { // 48h Reminder
    const { data, error } = await sb.from('events')
      .select('*')
      .eq('reminder_48h_posted', false)
      .gt('start_at', win48Start.toISOString())
      .lt('start_at', win48End.toISOString());
    if (!error) {
      for (const ev of data || []) {
        const st = await statusFor(ev.id);
        const text = `⏰ In 48h: ${ev.title}\n👥 Zusagen: ${st.counts.going} · Maybe: ${st.counts.maybe}\n🔗 ${ev.zoom_join_url || ''}`.trim();
        await bot.telegram.sendMessage(CFG.groupId, text);
        await markReminder(ev.id, '48h');
      }
    } else {
      console.error(error);
    }
  }

  { // 15m Reminder
    const { data, error } = await sb.from('events')
      .select('*')
      .eq('reminder_15m_posted', false)
      .gt('start_at', win15Start.toISOString())
      .lt('start_at', win15End.toISOString());
    if (!error) {
      for (const ev of data || []) {
        const text = `🔔 In 15 Minuten: ${ev.title}\n${ev.zoom_join_url || ''}`.trim();
        await bot.telegram.sendMessage(CFG.groupId, text);
        await markReminder(ev.id, '15m');
      }
    } else {
      console.error(error);
    }
  }
}
