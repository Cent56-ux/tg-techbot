import { sb } from '../db/supabase';

export async function setParticipant(p: { event_id: string; tg_user_id: number; display_name?: string; status: 'going' | 'maybe' | 'declined' }) {
  const { data, error } = await sb.from('participants').upsert({
    event_id: p.event_id, tg_user_id: p.tg_user_id, display_name: p.display_name, status: p.status
  }, { onConflict: 'event_id,tg_user_id' }).select().single();
  if (error) throw error;
  return data;
}
