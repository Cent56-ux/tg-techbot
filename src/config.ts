import * as dotenv from 'dotenv';
dotenv.config();

export const CFG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  groupId: process.env.GROUP_CHAT_ID ? Number(process.env.GROUP_CHAT_ID) : undefined,
  openaiKey: process.env.OPENAI_API_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE!,
};
