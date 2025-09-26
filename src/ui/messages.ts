import { Markup } from 'telegraf';

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
  ]);
}
