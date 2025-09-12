import { createClient } from '@supabase/supabase-js';
import { CFG } from '../config';

if (!CFG.supabaseUrl || !CFG.supabaseServiceRole) {
  console.warn('Supabase env not set yet; client will be null until you add env vars.');
}

export const sb = (CFG.supabaseUrl && CFG.supabaseServiceRole)
  ? createClient(CFG.supabaseUrl, CFG.supabaseServiceRole, { auth: { persistSession: false } })
  : (null as any);
