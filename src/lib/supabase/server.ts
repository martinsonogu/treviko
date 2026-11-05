import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';
export async function createServerSupabase(request?: Request) {
  const { url, key } = supabaseConfig();
  const authorization = request?.headers.get('authorization');
  if (authorization) {
    if (!/^Bearer [^\s]+$/i.test(authorization)) throw new Error('Invalid authentication');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: authorization }, fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) }) } });
  }
  const jar = await cookies();
  return createServerClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) }) },
    cookieOptions: {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},
    cookies: { getAll: () => jar.getAll(), setAll: values => { try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* Server Components rely on Proxy for refresh writes. */ } } },
  });
}
export type UserDatabase = Awaited<ReturnType<typeof createServerSupabase>>;

export function createPasswordVerifier(){const {url,key}=supabaseConfig();return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(10000)})}});}
