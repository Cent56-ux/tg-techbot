import { sb } from '../db/supabase';
import { createMeeting } from './zoom';

// Normalize date to UTC and fix obvious past years from LLM parsing
function toUtcWithYearFix(inputIso: string): string {
  const now = new Date();
  let dt = new Date(inputIso);
  if (isNaN(dt.getTime())) dt = new Date(String(inputIso).replace(' ', 'T'));
  const dayMs = 24 * 60 * 60 * 1000;
  if (dt.getTime() < now.getTime() - dayMs) {
    dt.setFullYear(now.getFullYear());
    if (dt.getTime() < now.getTime() - dayMs) dt.setFullYear(now.getFullYear() + 1);
  }
  return dt.toISOString();
}

export async function eventsCreate(p: {
  title: string; start_at: string; duration_minutes: number; presenter: string;
  description?: string; create_zoom?: boolean; created_by?: number;
}) {
  const startUtc = toUtcWithYearFix(p.start_at);
  let zoom_join_url: string | undefined, zoom_meeting_id: string | undefined;
  if (p.create_zoom !== false) {
    const z = await createMeeting({ title: p.title, start_at: startUtc, duration_minutes: p.duration_minutes });
    zoom_join_url = z.join_url; zoom_meeting_id = z.meeting_id;
  }
  const { data, error } = await sb.from('events').insert([{
    title: p.title, description: p.description, start_at: startUtc, duration_minutes: p.duration_minutes,
    presenter: p.presenter, zoom_join_url, zoom_meeting_id, created_by: p.created_by
  }]).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvent(p: {
  id?: string; // optional, sonst wird das nächste Event editiert
  patch: Partial<{
    title: string;
    start_at: string;
    duration_minutes: number;
    presenter: string;
    description: string;
    recreate_zoom: boolean; // wenn true: neue Zoom-Einladung erzeugen
  }>;
}) {
  let eventId = p.id;
  if (!eventId) {
    const ne = await nextEvent(new Date().toISOString());
    if (!ne) throw new Error('Kein kommendes Event gefunden.');
    eventId = ne.id;
  }

  const patch: any = {};
  if (p.patch.title) patch.title = p.patch.title;
  if (p.patch.presenter) patch.presenter = p.patch.presenter;
  if (typeof p.patch.duration_minutes === 'number') patch.duration_minutes = p.patch.duration_minutes;
  if (p.patch.description !== undefined) patch.description = p.patch.description;
  if (p.patch.start_at) patch.start_at = toUtcWithYearFix(p.patch.start_at);

  // Zoom ggf. neu erzeugen
  if (p.patch.recreate_zoom) {
    const base = await sb.from('events').select('*').eq('id', eventId).single();
    if (base.error) throw base.error;
    const start = patch.start_at || base.data.start_at;
    const dur = patch.duration_minutes ?? base.data.duration_minutes;
    const title = patch.title || base.data.title;
    const z = await createMeeting({ title, start_at: start, duration_minutes: dur });
    patch.zoom_join_url = z.join_url;
    patch.zoom_meeting_id = z.meeting_id;
  }

  const { data, error } = await sb.from('events').update(patch).eq('id', eventId).select().single();
  if (error) throw error;
  return data;
}

export async function nextEvent(nowIso: string) {
  const { data, error } = await sb.from('events').select('*').gte('start_at', nowIso).order('start_at', { ascending: true }).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function listUpcoming(limit = 5) {
  const { data, error } = await sb.from('events').select('*').gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(Math.max(1, Math.min(limit, 10)));
  if (error) throw error;
  return data || [];
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
  const patch = kind === '48h' ? { reminder_48h_posted: true } : { reminder_15m_posted: true };
  const { error } = await sb.from('events').update(patch).eq('id', event_id);
  if (error) throw error;
}

// --- Delete an event (and its participants) ---
import { sb } from '../db/supabase';

/**
 * Löscht ein Event inkl. aller Teilnehmer-Einträge.
 * Gibt das gelöschte Event zurück (oder wirft bei Fehlern).
 */
export async function deleteEvent(evId: string) {
  // Teilnehmer (FK) zuerst entfernen
  const pDel = await sb.from('participants').delete().eq('event_id', evId);
  if (pDel.error) throw pDel.error;

  // Event löschen und zurückgeben
  const eDel = await sb.from('events').delete().eq('id', evId).select().single();
  if (eDel.error) throw eDel.error;
  return eDel.data;
}

// --- Delete an event (and its participants) ---
import { sb } from '../db/supabase';

/**
 * Löscht ein Event inkl. aller Teilnehmer-Einträge.
 * Gibt das gelöschte Event zurück (oder wirft bei Fehlern).
 */
export async function deleteEvent(evId: string) {
  // Teilnehmer (FK) zuerst entfernen
  const pDel = await sb.from('participants').delete().eq('event_id', evId);
  if (pDel.error) throw pDel.error;

  // Event löschen und zurückgeben
  const eDel = await sb.from('events').delete().eq('id', evId).select().single();
  if (eDel.error) throw eDel.error;
  return eDel.data;
}
