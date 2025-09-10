import 'dotenv/config';

export const CFG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseService: process.env.SUPABASE_SERVICE_ROLE || '',
  groupId: process.env.GROUP_CHAT_ID || '',
  tz: process.env.TZ || 'Europe/Berlin',
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID || '',
    clientId: process.env.ZOOM_CLIENT_ID || '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET || ''
  }
};

export function requireEnv(...keys: (keyof typeof CFG | string)[]) {
  const missing: string[] = [];
  for (const k of keys) {
    const v = (CFG as any)[k] ?? process.env[String(k)];
    if (!v) missing.push(String(k));
  }
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
}
