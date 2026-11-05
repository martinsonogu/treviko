import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, supabaseConfig } from '@/lib/supabase/config';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // API handlers independently verify bearer/cookie access and own their JSON errors.
  if (!isSupabaseConfigured() || request.headers.has('authorization')) return response;
  const { url, key } = supabaseConfig();
  const db = createServerClient(url, key, {
    cookieOptions: {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headers) Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) }) },
  });
  try { await db.auth.getClaims(); } catch { /* Protected services fail closed on invalid sessions. */ }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/', '/training', '/coach/:path*', '/profile/:path*', '/settings/:path*', '/onboarding/:path*', '/nutrition/:path*', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/:path*', '/api/v1/:path*'] };
