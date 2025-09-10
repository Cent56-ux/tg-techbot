import { createClient } from '@supabase/supabase-js';
import { CFG } from '../config';

if (!CFG.supabaseUrl || !CFG.supabaseService) {
  console.warn('Supabase env not set yet; client will be null until you add env vars.');
}

export const sb = (CFG.supabaseUrl && CFG.supabaseService)
  ? createClient(CFG.supabaseUrl, CFG.supabaseService, { auth: { persistSession: false } })
  : null as any;
