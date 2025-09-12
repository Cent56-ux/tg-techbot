import 'dotenv/config';

export const CFG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
  // Parse group id to number; undefined if not set or invalid
  groupId: (() => {
    const raw = (process.env.GROUP_CHAT_ID || '').trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  })(),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE || '',
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID || '',
    clientId: process.env.ZOOM_CLIENT_ID || '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
  },
};

export function requireEnv(keys: string[]) {
  const missing = keys.filter((k) => !(process.env as any)[k]);
  if (missing.length) throw new Error('Missing env vars: ' + missing.join(', '));
}
