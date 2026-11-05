import { z } from 'zod';
export class SupabaseConfigurationError extends Error { constructor() { super('Supabase is not configured. Add the project URL and publishable key to .env.local.'); } }
export function supabaseConfig() {
  const value = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  const result = z.object({ url: z.string().url().refine(url => (() => {const parsed=new URL(url);return !parsed.username&&!parsed.password&&(parsed.protocol==='https:'||(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname)));})()), key: z.string().min(10).refine(key => {if(key.startsWith('sb_publishable_'))return true;try{return JSON.parse(atob(key.split('.')[1].replaceAll('-','+').replaceAll('_','/'))).role==='anon';}catch{return false;}}) }).safeParse(value);
  if (!result.success) throw new SupabaseConfigurationError();
  return result.data;
}
export function isSupabaseConfigured() { try { supabaseConfig(); return true; } catch { return false; } }
