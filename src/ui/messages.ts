export function eventCard(ev: any, counts?: { going: number; maybe: number }) {
  const dt = new Date(ev.start_at);
  const when = dt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday:'short', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  const lines = [
    `📣 ${ev.title}`,
    `🗓️ ${when} · ${ev.duration_minutes} Min`,
    `🎤 ${ev.presenter}`,
  ];
  if (ev.description) lines.push(`�� ${ev.description}`);
  if (ev.zoom_join_url) lines.push(`🔗 Zoom: ${ev.zoom_join_url}`);
  if (counts) lines.push(`👥 Zusagen: ${counts.going} · Maybe: ${counts.maybe}`);
  return lines.join('\n');
}

export function rsvpKeyboard(evId: string) {
  return {
    inline_keyboard: [[
      { text: 'Ich komme ✅', callback_data: `rsvp:${evId}:going` },
      { text: 'Vielleicht 🤔', callback_data: `rsvp:${evId}:maybe` },
      { text: 'Abmelden ❌', callback_data: `rsvp:${evId}:declined` }
    ]]
  };
}
