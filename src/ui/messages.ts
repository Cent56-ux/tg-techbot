import { Markup } from 'telegraf';
import { EventRow, Counts } from '../tools/events';

export function eventCard(ev: EventRow, counts?: Counts) {
  const dt = new Date(ev.start_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  const d = ev.description ? `\n${ev.description}` : '';
  const c = counts ? `\n👥 Zusagen: ${counts.going} | Vielleicht: ${counts.maybe} | Insgesamt: ${counts.total}` : '';
  return `🗓️ *${ev.title}*\n${dt}${ev.presenter ? `\n🧑‍🏫 ${ev.presenter}` : ''}${d}${c}`;
}

export function eventsList(events: EventRow[]) {
  if (!events.length) return '📭 Keine anstehenden Events.';
  return events.map(ev => {
    const h = new Date(ev.start_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    return `• *${ev.title}* — ${h}`;
  }).join('\n');
}

export function actionKeyboard(eventId: string) {
  return Markup.inlineKeyboard([
    [
      { text: '✅ Ich komme',  callback_data: `rsvp:${eventId}:going` },
      { text: '❔ Vielleicht', callback_data: `rsvp:${eventId}:maybe` },
      { text: '🚫 Abmelden',   callback_data: `rsvp:${eventId}:declined` },
    ],
    [
      { text: '📝 Alles bearbeiten', callback_data: `editall:${eventId}` },
      { text: '✏️ Titel',            callback_data: `editTitle:${eventId}` },
      { text: '🗑️ Löschen',          callback_data: `delete:${eventId}` },
    ],
  ]).reply_markup;
}

export function editMenuKeyboard(eventId: string) {
  return Markup.inlineKeyboard([
    [{ text: '✏️ Titel',            callback_data: `editTitle:${eventId}` }],
    [{ text: '📝 Alles bearbeiten', callback_data: `editall:${eventId}` }],
    [{ text: '🗑️ Löschen',          callback_data: `delete:${eventId}` }],
  ]).reply_markup;
}
