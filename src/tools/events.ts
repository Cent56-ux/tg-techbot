import { sb } from '../db/supabase';

/** --- Types (leicht) --- */
export type EventRow = {
  id: string;
  title: string;
  presenter?: string | null;
  description?: string | null;
  start_at: string;              // ISO
  duration_minutes: number;
  zoom_join_url?: string | null;
  reminder_48h_posted?: boolean;
  reminder_15m_posted?: boolean;
};

export type Counts = { going: number; maybe: number; total: number };

/** --- Helpers --- */
const nowISO = () => new Date().toISOString();

/** Liste kommender Events */
export async function listUpcoming(limit = 5): Promise<EventRow[]> {
  const { data, error } = await sb
    .from('events')
    .select('*')
    .gt('start_at', nowISO())
    .order('start_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as EventRow[];
}

/** Status zu Event (inkl. RSVP-Zählung) */
export async function statusFor(eventId: string): Promise<{ event: EventRow; counts: Counts }> {
  const evQ = await sb.from('events').select('*').eq('id', eventId).single();
  if (evQ.error) throw evQ.error;
  const event = evQ.data as EventRow;

  const goingQ = await sb.from('participants').select('id', { count: 'exact', head: true })
    .eq('event_id', eventId).eq('status', 'going');
  const maybeQ = await sb.from('participants').select('id', { count: 'exact', head: true })
    .eq('event_id', eventId).eq('status', 'maybe');
  const totalQ = await sb.from('participants').select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  const counts: Counts = {
    going: goingQ.count || 0,
    maybe: maybeQ.count || 0,
    total: totalQ.count || 0,
  };
  return { event, counts };
}

/** Reminder-Flag setzen */
export async function markReminder(eventId: string, which: '48h' | '15m') {
  const column = which === '48h' ? 'reminder_48h_posted' : 'reminder_15m_posted';
  const { error } = await sb.from('events').update({ [column]: true }).eq('id', eventId);
  if (error) throw error;
}

/** Event patchen (einfacher Updater); gibt das aktualisierte Event zurück */
export async function updateEvent(opts: { id: string; patch: Partial<EventRow> & { recreate_zoom?: boolean } }): Promise<EventRow> {
  const { id, patch } = opts;

  // Wenn recreate_zoom gesetzt ist, entferne vorhandenen Link – dein Zoom-Tool baut ihn neu.
  const finalPatch: any = { ...patch };
  if (patch.recreate_zoom) {
    finalPatch.zoom_join_url = null;
    delete finalPatch.recreate_zoom;
  }

  const { data, error } = await sb.from('events').update(finalPatch).eq('id', id).select().single();
  if (error) throw error;
  return data as EventRow;
}

/**
 * Event löschen (inkl. Teilnehmer).
 * - Wenn in der DB ein FK mit ON DELETE CASCADE existiert, reicht der zweite DELETE aus.
 * - Wir löschen hier trotzdem erst participants, dann event (robust auch ohne CASCADE).
 */
export async function deleteEvent(evId: string): Promise<EventRow> {
  // Teilnehmer entfernen (ignorieren, wenn es keine gibt)
  const pDel = await sb.from('participants').delete().eq('event_id', evId);
  if (pDel.error) throw pDel.error;

  // Event löschen und gelöschte Row zurückgeben
  const eDel = await sb.from('events').delete().eq('id', evId).select().single();
  if (eDel.error) throw eDel.error;
  return eDel.data as EventRow;
}
