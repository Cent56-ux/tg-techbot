import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, eventsList, actionKeyboard, editMenuKeyboard } from './ui/messages';
import { statusFor, updateEvent, deleteEvent } from './tools/events';
import { setParticipant } from './tools/participants';

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
