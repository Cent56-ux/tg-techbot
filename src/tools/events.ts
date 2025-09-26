import { sb } from '../db/supabase';

export type EventRow = {
  id: string;
  title: string;
  presenter?: string | null;
  description?: string | null;
  start_at: string;
  duration_minutes: number;
  zoom_join_url?: string | null;
  reminder_48h_posted?: boolean;
  reminder_15m_posted?: boolean;
};

export type Counts = { going: number; maybe: number; total: number };

const nowISO = () => new Date().toISOString();

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

export async function nextEvent(afterISO?: string): Promise<EventRow | null> {
  const gtISO = afterISO ?? nowISO();
  const { data, error } = await sb
    .from('events')
    .select('*')
    .gt('start_at', gtISO)
    .order('start_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  return data && data[0] ? (data[0] as EventRow) : null;
}

export async function updateEvent(opts: { id: string; patch: Partial<EventRow> & { recreate_zoom?: boolean } }): Promise<EventRow> {
  const { id, patch } = opts;
  const finalPatch: any = { ...patch };
  if (patch.recreate_zoom) {
    finalPatch.zoom_join_url = null;
    delete finalPatch.recreate_zoom;
  }
  const { data, error } = await sb.from('events').update(finalPatch).eq('id', id).select().single();
  if (error) throw error;
  return data as EventRow;
}
