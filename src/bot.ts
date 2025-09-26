import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, eventsList, actionKeyboard, editMenuKeyboard } from './ui/messages';
import { statusFor, updateEvent, deleteEvent } from './tools/events';


import { setParticipant } from './tools/participants';
// === BEGIN: List/Next + Edit-Wizard (ohne LLM) ===

// Formatter
function fmtEventLine(e: EventRow) {
  const h = new Date(e.start_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  return `• *${e.title}* — ${h}${e.presenter ? ` — _${e.presenter}_` : ''}`;
}

// Antworten
async function replyUpcoming(ctx: any) {
  try {
    const events = await listUpcoming(5);
    if (!events || events.length === 0) {
      await ctx.reply('📭 Keine anstehenden Events gefunden.');
      return;
    }
    const lines = events.map(fmtEventLine).join('\n');
    await ctx.reply(`🗓️ *Kommende Events*\n${lines}`, { parse_mode: 'Markdown' });
    try {
      const first = events[0];
      await ctx.reply(`Details: *${first.title}*`, { parse_mode: 'Markdown', reply_markup: (0, messages_1.actionKeyboard)(first.id) });
    } catch {}
  } catch (err) {
    console.error('listUpcoming error', err);
    await ctx.reply('❌ Konnte die anstehenden Events nicht laden.');
  }
}

async function replyNext(ctx: any) {
  try {
    const ev = await nextEvent();
    if (!ev) { await ctx.reply('📭 Kein kommendes Event gefunden.'); return; }
    const h = new Date(ev.start_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    await ctx.reply(`➡️ *Nächstes Event*\n*${ev.title}*\n${h}${ev.presenter ? `\n_${ev.presenter}_` : ''}`, {
      parse_mode: 'Markdown',
      reply_markup: (0, messages_1.actionKeyboard)(ev.id),
    });
  } catch (err) {
    console.error('nextEvent error', err);
    await ctx.reply('❌ Konnte das nächste Event nicht laden.');
  }
}

// Wizard-State
type EditStep = 'title'|'description'|'start_at'|'duration_minutes'|'presenter'|'zoom_join_url'|'confirm';
type EditState = { eventId: string; step: EditStep; patch: Partial<EventRow> };
const pendingEdits = new Map<number, EditState>();

async function requireAdmin(ctx: any): Promise<boolean> {
  try {
    if (config_1.CFG.groupId !== undefined && ctx.chat?.id === config_1.CFG.groupId) {
      const m = await ctx.telegram.getChatMember(config_1.CFG.groupId, ctx.from.id);
      const ok = ['creator','administrator'].includes((m as any).status);
      if (!ok) {
        await ctx.answerCbQuery?.('Nur Admins dürfen das.', { show_alert: true });
        return false;
      }
    }
    return true;
  } catch {
    await ctx.answerCbQuery?.('Bearbeitung nicht erlaubt.', { show_alert: true });
    return false;
  }
}

function toISOFromLocalInput(input: string): string | null {
  const txt = (input || '').trim();
  if (/^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}(:\\d{2})?(Z|[+-]\\d{2}:?\\d{2})?$/.test(txt)) {
    try { return new Date(txt.replace(' ', 'T')).toISOString(); } catch {}
  }
  return null;
}

async function promptNext(ctx: any, st: EditState) {
  switch (st.step) {
    case 'title':             await ctx.reply('✏️ Neuer *Titel*? (oder `-`)', { parse_mode: 'Markdown' }); break;
    case 'description':       await ctx.reply('📝 Neue *Beschreibung*? (oder `-`)'); break;
    case 'start_at':          await ctx.reply('🕒 Neue *Startzeit*? `YYYY-MM-DD HH:MM` lokal oder ISO (oder `-`)'); break;
    case 'duration_minutes':  await ctx.reply('⏳ Neue *Dauer (Minuten)*? (Zahl oder `-`)'); break;
    case 'presenter':         await ctx.reply('🧑‍🏫 Neuer *Presenter*? (oder `-`)'); break;
    case 'zoom_join_url':     await ctx.reply('🎥 Neuer *Zoom-Link*? (oder `-`)'); break;
    case 'confirm':           await ctx.reply('✅ Aktualisiere Event …'); break;
  }
}

// früher Handler (Wizard + NL-Liste)
const NL_LIST = /(zeige|list(e|en)?|zeig|was\\s+steht|was\\s+kommt)\\s+(mir\\s+)?(als\\s+nächstes\\s+)?(die\\s+)?(anstehenden|kommenden)?\\s*(events|termine)?/i;
exports.bot.on('message', async (ctx: any, next: any) => {
  const st = pendingEdits.get(ctx.from.id);
  const text = (ctx.message?.text || '').trim();

  if (st && text) {
    const skip = text === '-';
    try {
      switch (st.step) {
        case 'title':            if (!skip) st.patch.title = text;              st.step = 'description';       await promptNext(ctx, st); return;
        case 'description':      if (!skip) st.patch.description = text;        st.step = 'start_at';          await promptNext(ctx, st); return;
        case 'start_at':
          if (!skip) {
            const iso = toISOFromLocalInput(text);
            if (!iso) { await ctx.reply('❌ Ungültiges Datum. Beispiel: `2025-10-12 18:00`'); return; }
            (st.patch as any).start_at = iso;
          }
          st.step = 'duration_minutes';                                          await promptNext(ctx, st); return;
        case 'duration_minutes':
          if (!skip) {
            const n = parseInt(text, 10);
            if (!Number.isFinite(n) || n <= 0) { await ctx.reply('❌ Bitte positive Zahl oder `-`.'); return; }
            (st.patch as any).duration_minutes = n;
          }
          st.step = 'presenter';                                                 await promptNext(ctx, st); return;
        case 'presenter':        if (!skip) (st.patch as any).presenter = text;  st.step = 'zoom_join_url';     await promptNext(ctx, st); return;
        case 'zoom_join_url':    if (!skip) (st.patch as any).zoom_join_url = text; st.step = 'confirm';        await promptNext(ctx, st);
          await updateEvent({ id: st.eventId, patch: st.patch });
          pendingEdits.delete(ctx.from.id);
          await ctx.reply('✅ Event aktualisiert.');
          return;
      }
    } catch (e) {
      console.error('edit-wizard error', e);
      await ctx.reply('⚠️ Konnte die Eingabe nicht verarbeiten.');
      pendingEdits.delete(ctx.from.id);
    }
    return;
  }

  if (text && NL_LIST.test(text)) { await replyUpcoming(ctx); return; }
  return next();
});

// Kommandos ohne LLM
exports.bot.command('list', replyUpcoming);
exports.bot.command('next', replyNext);

// separater Callback-Handler für Wizard-Start (läuft zusätzlich zu deinem bestehenden)
exports.bot.on('callback_query', async (ctx: any, next: any) => {
  try {
    const data = String(ctx.callbackQuery?.data || '');
    if (data.startsWith('editall:')) {
      if (!(await requireAdmin(ctx))) return;
      const evId = data.split(':')[1];
      pendingEdits.set(ctx.from.id, { eventId: evId, step: 'title', patch: {} });
      await ctx.answerCbQuery('Bearbeiten gestartet');
      await promptNext(ctx, pendingEdits.get(ctx.from.id)!);
      return;
    }
    if (data.startsWith('editTitle:')) {
      if (!(await requireAdmin(ctx))) return;
      const evId = data.split(':')[1];
      pendingEdits.set(ctx.from.id, { eventId: evId, step: 'title', patch: {} });
      await ctx.answerCbQuery('Titel ändern');
      await ctx.reply('✏️ Neuer *Titel*?', { parse_mode: 'Markdown' });
      return;
    }
  } catch (e) {
    console.error('callback wizard start error', e);
  }
  return next?.();
});
// === END: List/Next + Edit-Wizard (ohne LLM) ===


export const bot = new Telegraf(CFG.botToken);

// /id (Diagnose)
bot.command('id', async (ctx) => {
  try { await ctx.reply(`chat id: ${ctx.chat?.id}`); } catch (e) { console.error('/id error', e); }
});

// /events
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

// /next (alias /status)
bot.command('next', async (ctx) => {
  try {
    const res = await converse('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'status') {
      const { event, counts } = (res as any).payload;
      await ctx.reply(eventCard(event, counts), { reply_markup: actionKeyboard(event.id) });
    } else if ((res as any).text) {
      await ctx.reply((res as any).text as string);
    }
  } catch (e) {
    console.error('/next error', e);
    await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
  }
});

bot.command('status', async (ctx) => {
  try {
    const res = await converse('Zeige Status des nächsten Events', { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'status') {
      const { event, counts } = (res as any).payload;
      await ctx.reply(eventCard(event, counts), { reply_markup: actionKeyboard(event.id) });
    } else if ((res as any).text) {
      await ctx.reply((res as any).text as string);
    }
  } catch (e) {
    console.error('/status error', e);
    await ctx.reply('⚠️ Da ist etwas schiefgelaufen.');
  }
});

// /edit (manuelle key=value Edits; Admin-Gate nur in der Gruppe)
bot.command('edit', async (ctx) => {
  try {
    if (CFG.groupId !== undefined && ctx.chat?.id === CFG.groupId) {
      try {
        const member = await ctx.telegram.getChatMember(CFG.groupId, ctx.from.id);
        const isAdmin = ['creator', 'administrator'].includes((member as any).status);
        if (!isAdmin) {
          await ctx.reply('Nur Admins dürfen bearbeiten.');
          return;
        }
      } catch {
        await ctx.reply('Bearbeitung nicht erlaubt.');
        return;
      }
    }

    const text = (ctx.message as any)?.text || '';
    const parts = text.split(/\s+/).slice(1);
    const patch: any = {};
    for (const p of parts) {
      const [k, ...rest] = p.split('=');
      const v = rest.join('=');
      if (!k || !v) continue;
      if (/^title$/i.test(k)) patch.title = v.replace(/_/g, ' ');
      else if (/^presenter$/i.test(k)) patch.presenter = v.replace(/_/g, ' ');
      else if (/^description$/i.test(k)) patch.description = v.replace(/_/g, ' ');
      else if (/^duration|duration_minutes$/i.test(k)) patch.duration_minutes = Number(v);
      else if (/^start|start_at$/i.test(k)) patch.start_at = v;
      else if (/^recreate_zoom$/i.test(k)) patch.recreate_zoom = /^(1|true|yes|ja)$/i.test(v);
    }

    const res = await converse(JSON.stringify({ intent: 'events_update', patch }), { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });
    if ((res as any).type === 'event_updated') {
      const ev = (res as any).event;
      await ctx.reply('Aktualisiert ✅\n' + eventCard(ev), { reply_markup: actionKeyboard(ev.id) });
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

// Nachrichten: DMs, oder Erwähnung, oder „Event“-Pattern
bot.on('message', async (ctx) => {
  try {
    const text = (ctx.message as any)?.text || '';
    if (!text) return;

    const me = ctx.me ?? '';
    const mentioned = text.toLowerCase().includes('@' + me.toLowerCase());
    const looksLikeEvent = /neuer talk|vortrag|event|meeting|neue präsentation|verschieb|edit|änder|update/i.test(text);

    if (ctx.chat?.type === 'private' || mentioned || looksLikeEvent) {
      const res = await converse(text, { tg_user_id: ctx.from.id, display_name: ctx.from.first_name });

      if ((res as any).type === 'event_created') {
        const ev = (res as any).event;
        const st = await statusFor(ev.id);
        await ctx.reply(eventCard(ev, st.counts), { reply_markup: actionKeyboard(ev.id) });
      } else if ((res as any).type === 'event_updated') {
        const ev = (res as any).event;
        await ctx.reply('Aktualisiert ✅\n' + eventCard(ev), { reply_markup: actionKeyboard(ev.id) });
      } else if ((res as any).type === 'status') {
        const { event, counts } = (res as any).payload;
        await ctx.reply(eventCard(event, counts), { reply_markup: actionKeyboard(event.id) });
      } else if ((res as any).type === 'events_list') {
        await ctx.reply(eventsList((res as any).events || []));
      } else if ((res as any).type === 'announce') {
        await ctx.reply(((res as any).text as string) || '');
      } else if ((res as any).text) {
        await ctx.reply((res as any).text as string);
      }
    }
  } catch (e) {
    console.error('on message error', e);
    try { await ctx.reply('⚠️ Konnte das nicht verarbeiten.'); } catch {}
  }
});

// Callback-Queries: RSVP + Edit + Delete
bot.on('callback_query', async (ctx: any) => {
  try {
    const data = String(ctx.callbackQuery.data || '');

    // RSVP
    let m = data.match(/^rsvp:(.+):(going|maybe|declined)$/);
    if (m) {
      const [_, evId, status] = m;
      await setParticipant({
        event_id: evId,
        tg_user_id: ctx.from.id,
        display_name: ctx.from.first_name,
        status: status as 'going' | 'maybe' | 'declined'
      });
      await ctx.answerCbQuery('Gespeichert ✅');
      return;
    }

    // Edit-Menü
    m = data.match(/^edit:([a-z0-9-]+)(?::(.+))?$/i);
    if (m) {
      const evId = m[1];
      const rest = m[2] || '';

      // Admin-Check NUR für Bearbeiten-Aktionen:
      const needAdmin = rest && rest !== '';
      if (needAdmin && CFG.groupId !== undefined && ctx.chat?.id === CFG.groupId) {
        try {
          const member = await ctx.telegram.getChatMember(CFG.groupId, ctx.from.id);
          const isAdmin = ['creator', 'administrator'].includes((member as any).status);
          if (!isAdmin) {
            await ctx.answerCbQuery('Nur Admins dürfen bearbeiten.', { show_alert: true });
            return;
          }
        } catch {
          await ctx.answerCbQuery('Bearbeitung nicht erlaubt.', { show_alert: true });
          return;
        }
      }

      if (!rest) {
        await ctx.answerCbQuery();
        try {
          await ctx.editMessageReplyMarkup(editMenuKeyboard(evId));
        } catch {
          await ctx.reply('Was möchtest du ändern?', { reply_markup: editMenuKeyboard(evId) });
        }
        return;
      }

      if (rest.startsWith('shift:')) {
        const minutes = parseInt(rest.split(':')[1], 10);
        const st = await statusFor(evId);
        const oldStart = new Date(st.event.start_at);
        const newStart = new Date(oldStart.getTime() + minutes * 60_000).toISOString();
        const ev = await updateEvent({ id: evId, patch: { start_at: newStart } });
        await ctx.answerCbQuery('Zeit aktualisiert ✅');
        try {
          await ctx.editMessageText(eventCard(ev, st.counts), { reply_markup: actionKeyboard(ev.id) });
        } catch {
          await ctx.reply('Aktualisiert ✅\n' + eventCard(ev), { reply_markup: actionKeyboard(ev.id) });
        }
        return;
      }

      if (rest.startsWith('tomorrow:')) {
        const hhmm = rest.split(':').slice(1).join(':');
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const [hh, mm] = hhmm.split(':').map(Number);
        d.setHours(hh, mm, 0, 0);
        const ev = await updateEvent({ id: evId, patch: { start_at: d.toISOString() } });
        await ctx.answerCbQuery('Auf morgen gesetzt ✅');
        await ctx.reply('Aktualisiert ✅\n' + eventCard(ev), { reply_markup: actionKeyboard(ev.id) });
        return;
      }

      if (rest === 'zoom') {
        const ev = await updateEvent({ id: evId, patch: { recreate_zoom: true } });
        await ctx.answerCbQuery('Zoom neu erstellt ✅');
        await ctx.reply('Aktualisiert ✅\n' + eventCard(ev), { reply_markup: actionKeyboard(ev.id) });
        return;
      }

      if (rest === 'help') {
        await ctx.answerCbQuery();
        await ctx.reply([
          'Bearbeiten-Hilfe:',
          '• /edit start=2025-10-01T19:00',
          '• /edit title=Neuer_Titel',
          '• /edit presenter=Alex',
          '• /edit duration=45',
          '• /edit recreate_zoom=true'
        ].join('\n'));
        return;
      }
    }

    // Delete (nur Admins)
    if (data.startsWith('delete:')) {
      const evId = data.split(':')[1];
      try {
        if (CFG.groupId !== undefined && ctx.chat?.id === CFG.groupId) {
          const member = await ctx.telegram.getChatMember(CFG.groupId, ctx.from.id);
          const isAdmin = ['creator', 'administrator'].includes((member as any).status);
          if (!isAdmin) {
            await ctx.answerCbQuery('Nur Admins dürfen löschen.', { show_alert: true });
            return;
          }
        }
        await deleteEvent(evId);
        await ctx.answerCbQuery('Event gelöscht ✅');
        try {
          await ctx.editMessageText('❌ Dieses Event wurde gelöscht.');
        } catch {
          await ctx.reply('❌ Dieses Event wurde gelöscht.');
        }
      } catch (e) {
        console.error('delete error', e);
        await ctx.answerCbQuery('Fehler beim Löschen', { show_alert: true });
      }
      return;
    }

    await ctx.answerCbQuery();
  } catch (e) {
    console.error('callback error', e);
    try { await ctx.answerCbQuery('Fehler'); } catch {}
  }
});
