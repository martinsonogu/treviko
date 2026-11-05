import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/schemas';
export async function GET(request:Request) {
 const url=new URL(request.url); const token=url.searchParams.get('token_hash'); const type=url.searchParams.get('type');const code=url.searchParams.get('code');
 try {
  const db=await createServerSupabase();
  let error;
  if(token && ['signup','email','recovery'].includes(type??'')) ({error}=await db.auth.verifyOtp({token_hash:token,type:type as 'signup'|'email'|'recovery'}));
  else if(code) ({error}=await db.auth.exchangeCodeForSession(code));
  else error=true;
  if(!error) return NextResponse.redirect(new URL(type==='recovery'?'/reset-password':safeNext(url.searchParams.get('next'),'/onboarding'),url.origin),{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 } catch { /* Never return tokens or auth diagnostics. */ }
 return NextResponse.redirect(new URL('/login?verification=failed',url.origin),{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
}
