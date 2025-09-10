import axios from 'axios';
import { CFG } from '../config';

let cached: { token: string; exp: number } | null = null;

async function zoomToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - now > 60) return cached.token;

  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${CFG.zoom.accountId}`;
  const r = await axios.post(url, {}, {
    auth: { username: CFG.zoom.clientId, password: CFG.zoom.clientSecret }
  });

  cached = { token: r.data.access_token, exp: now + r.data.expires_in };
  return cached.token;
}

export async function createMeeting(input: { title: string; start_at: string; duration_minutes: number }) {
  const token = await zoomToken();
  const body = {
    topic: input.title,
    type: 2,
    start_time: input.start_at,
    duration: input.duration_minutes,
    timezone: 'Europe/Berlin',
    settings: { join_before_host: false, approval_type: 2, waiting_room: false }
  };
  const resp = await axios.post('https://api.zoom.us/v2/users/me/meetings', body, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return { join_url: String(resp.data.join_url), meeting_id: String(resp.data.id) };
}
