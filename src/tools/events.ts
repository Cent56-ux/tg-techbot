import { sb } from '../db/supabase';

/** --- Types --- */
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

const nowISO = () => new Date().toISOString();

/** Neues Event anlegen */
export async function eventsCreate(input: {
  title: string;
  start_at: string;              // ISO
  duration_minutes?: number;
  presenter?: string | null;
  description?: string | null;
  zoom_join_url?: string | null;
}): Promise<EventRow> {
  const payload = {
    title: input.title,
    start_at: input.start_at,
    duration_minutes: input.duration_minutes ?? 30,
    presenter: input.presenter ?? null,
    description: input.description ?? null,
    zoom_join_url: input.zoom_join_url ?? null,
    reminder_48h_posted: false,
    reminder_15m_posted: false,
  };
  const { data, error } = await sb.from('events').insert(payload).select().single();
  if (error) throw error;
  return data as EventRow;
}

/** Nächstes (zukünftiges) Event – optional nach einem bestimmten Zeitpunkt */
export async function nextEvent(afterISO?: string): Promise<EventRow | null> {
  const gtISO = afterISO ?? nowISO();
  const { data, error } = await sb
    .from('events')
    .select('*')
    .gt('start_at', gtISO)
    .order('start_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  return (data && data[0]) ? (data[0] as EventRow) : null;
}

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

  // Wenn recreate_zoom gesetzt ist, entfernen wir vorhandenen Link – dein Zoom-Tool setzt später neu.
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
 * - Mit/ohne FK-CASCADE robust: erst participants, dann event.
 */
export async function deleteEvent(evId: string): Promise<EventRow> {
  const pDel = await sb.from('participants').delete().eq('event_id', evId);
  if (pDel.error) throw pDel.error;

  const eDel = await sb.from('events').delete().eq('id', evId).select().single();
  if (eDel.error) throw eDel.error;
  return eDel.data as EventRow;
}
