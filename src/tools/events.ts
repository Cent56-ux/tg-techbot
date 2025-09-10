import { sb } from '../db/supabase';
import { createMeeting } from './zoom';

export async function eventsCreate(p: {
  title: string; start_at: string; duration_minutes: number; presenter: string; description?: string; create_zoom?: boolean; created_by?: number;
}) {
  let zoom_join_url: string | undefined, zoom_meeting_id: string | undefined;
  if (p.create_zoom !== false) {
    const z = await createMeeting({ title: p.title, start_at: p.start_at, duration_minutes: p.duration_minutes });
    zoom_join_url = z.join_url; zoom_meeting_id = z.meeting_id;
  }
  const { data, error } = await sb
    .from('events')
    .insert([{ title: p.title, description: p.description, start_at: p.start_at, duration_minutes: p.duration_minutes,
               presenter: p.presenter, zoom_join_url, zoom_meeting_id, created_by: p.created_by }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function nextEvent(nowIso: string) {
  const { data, error } = await sb
    .from('events')
    .select('*')
    .gte('start_at', nowIso)
    .order('start_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function statusFor(event_id: string) {
  const evQ = await sb.from('events').select('*').eq('id', event_id).single();
  if (evQ.error) throw evQ.error;
  const going = await sb.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event_id).eq('status', 'going');
  const maybe = await sb.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event_id).eq('status', 'maybe');
  const total = await sb.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event_id);
  return { event: evQ.data, counts: { going: going.count || 0, maybe: maybe.count || 0, total: total.count || 0 } };
}

export async function markReminder(event_id: string, kind: '48h' | '15m') {
  const patch = (kind === '48h') ? { reminder_48h_posted: true } : { reminder_15m_posted: true };
  const { error } = await sb.from('events').update(patch).eq('id', event_id);
  if (error) throw error;
}
