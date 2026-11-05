import 'server-only';
import {connection} from 'next/server';
import { redirect } from 'next/navigation';
import { createServerSupabase, type UserDatabase } from '../supabase/server';
import { isSupabaseConfigured, SupabaseConfigurationError } from '../supabase/config';
export class AuthenticationError extends Error { constructor() { super('Please sign in to continue.'); } }
export type AuthContext = { userId: string; email: string; db: UserDatabase };
export async function requireUser(request?: Request): Promise<AuthContext> {
  if (!isSupabaseConfigured()) throw new SupabaseConfigurationError();
  const db = await createServerSupabase(request);
  // getUser contacts Auth for verified current user data instead of trusting cookie contents.
  const token = request?.headers.get('authorization')?.replace(/^Bearer /i, '');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at || data.user.is_anonymous) throw new AuthenticationError();
  return { userId: data.user.id, email: data.user.email ?? '', db };
}
export async function requirePageUser(next: string) {
  await connection();
  try { return await requireUser(); }
  catch (error) {
    if (error instanceof SupabaseConfigurationError) redirect('/login?setup=required');
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
}
