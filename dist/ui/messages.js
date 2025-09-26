"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventCard = eventCard;
exports.rsvpKeyboard = rsvpKeyboard;
exports.actionKeyboard = actionKeyboard;
const telegraf_1 = require("telegraf");
function eventCard(ev, counts) {
    const dt = new Date(ev.start_at);
    const when = dt.toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const lines = [
        `📣 ${ev.title}`,
        `🗓️ ${when} · ${ev.duration_minutes} Min`,
        `🎤 ${ev.presenter}`,
    ];
    if (ev.description)
        lines.push(`📝 ${ev.description}`);
    if (ev.zoom_join_url)
        lines.push(`🔗 Zoom: ${ev.zoom_join_url}`);
    if (counts)
        lines.push(`👥 Zusagen: ${counts.going} · Maybe: ${counts.maybe}`);
    return lines.join('\n');
}
function rsvpKeyboard(evId) {
    return {
        inline_keyboard: [[
                { text: 'Ich komme ✅', callback_data: `rsvp:${evId}:going` },
                { text: 'Vielleicht 🤔', callback_data: `rsvp:${evId}:maybe` },
                { text: 'Abmelden ❌', callback_data: `rsvp:${evId}:declined` }
            ]]
    };
}
/** RSVP + Bearbeiten- & Löschen-Button */
function actionKeyboard(eventId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            { text: '✅ Ich komme', callback_data: `rsvp:${eventId}:going` },
            { text: '❔ Vielleicht', callback_data: `rsvp:${eventId}:maybe` },
            { text: '🚫 Abmelden', callback_data: `rsvp:${eventId}:declined` },
        ],
        [
            { text: '📝 Alles bearbeiten', callback_data: `editall:${eventId}` },
            { text: '✏️ Titel', callback_data: `editTitle:${eventId}` },
            { text: '🗑️ Löschen', callback_data: `delete:${eventId}` },
        ],
    ]);
}
going ` },
        { text: 'Vielleicht 🤔', callback_data: `;
rsvp: $;
{
    evId;
}
maybe ` },
        { text: 'Abmelden ❌', callback_data: `;
rsvp: $;
{
    evId;
}
declined ` }
      ],
      [
        { text: '🛠️ Bearbeiten', callback_data: `;
edit: $;
{
    evId;
}
` },
        { text: '🗑️ Löschen',   callback_data: `;
delete ;
$;
{
    evId;
}
` }
      ]
    ]
  };
}

/** Inline-Edit-Menü (für Admins) */
export function editMenuKeyboard(evId: string) {
  return {
    inline_keyboard: [
      [
        { text: '⏪ -15 Min', callback_data: `;
edit: $;
{
    evId;
}
shift: -15 ` },
        { text: '⏩ +15 Min', callback_data: `;
edit: $;
{
    evId;
}
shift: 15 ` }
      ],
      [
        { text: '📅 Morgen 19:00', callback_data: `;
edit: $;
{
    evId;
}
tomorrow: 19;
0 ` }
      ],
      [
        { text: '🔁 Zoom neu', callback_data: `;
edit: $;
{
    evId;
}
zoom ` }
      ],
      [
        { text: 'ℹ️ Hilfe', callback_data: `;
edit: $;
{
    evId;
}
help ` }
      ]
    ]
  };
}

export function eventsList(events: any[]) {
  if (!events || events.length === 0) return 'Kein kommendes Event.';
  const rows = events.map((ev: any, i: number) => {
    const dt = new Date(ev.start_at);
    const when = dt.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const base = `;
$;
{
    i + 1;
}
$;
{
    ev.title;
}
$;
{
    when;
}
$;
{
    ev.duration_minutes;
}
Min;
$;
{
    ev.presenter;
}
`;
    const link = ev.zoom_join_url ? `;
n;
$;
{
    ev.zoom_join_url;
}
` : '';
    return base + link;
  });
  return `;
Kommende;
Events: ;
n ` + rows.join('\n');
}
;
