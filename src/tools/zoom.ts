import axios from 'axios';
import { CFG } from '../config';

export async function recreateZoomMeeting(): Promise<string> {
  if (!CFG.openaiKey) {
    throw new Error('Zoom-Konfiguration fehlt');
  }

  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`;
  const resp = await axios.post(url, null, {
    auth: { username: process.env.ZOOM_CLIENT_ID!, password: process.env.ZOOM_CLIENT_SECRET! },
  });
  const token = resp.data.access_token;

  // Platzhalter Meeting-Link
  return `https://zoom.us/j/${Math.floor(Math.random() * 1e9)}`;
}
