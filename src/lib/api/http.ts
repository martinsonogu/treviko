import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationError, requireUser, type AuthContext } from '../auth/session';
import { SupabaseConfigurationError } from '../supabase/config';
export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export function json(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export function apiFailure(error: unknown) {
  const issue = error instanceof ApiError ? error : error instanceof AuthenticationError ? new ApiError(401, 'AUTH_REQUIRED', error.message) : error instanceof SupabaseConfigurationError ? new ApiError(503, 'NOT_CONFIGURED', error.message) : error instanceof z.ZodError ? new ApiError(400, 'INVALID_INPUT', 'Check the supplied fields and try again.') : new ApiError(503, 'UNAVAILABLE', 'This operation is unavailable. Please try again.');
  return NextResponse.json({ data: null, error: { code: issue.code, message: issue.message } }, { status: issue.status, headers: { 'Cache-Control': 'private, no-store',...(issue.status===429?{'Retry-After':'60'}:{}) } });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) throw new ApiError(403, 'ORIGIN_REJECTED', 'This request origin is not allowed.');
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = 24000): Promise<T> {
  checkOrigin(request);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'CONTENT_TYPE', 'Send JSON.');
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ApiError(413, 'TOO_LARGE', 'Request is too large.');
  if (!request.body) throw new ApiError(400, 'INVALID_JSON', 'Send valid JSON.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new ApiError(408, 'TIMEOUT', 'Request body timed out.')); }, 5000); });
  try {
    while (true) { const { done, value } = await Promise.race([reader.read(), deadline]); if (done) break; size += value.byteLength; if (size > maxBytes) { void reader.cancel().catch(() => {}); throw new ApiError(413, 'TOO_LARGE', 'Request is too large.'); } chunks.push(value); }
    let value: unknown; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ApiError(400, 'INVALID_JSON', 'Send valid JSON.'); }
    return schema.parse(value);
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export function privateRoute(work: (request: Request, context: AuthContext) => Promise<unknown>) {
  return async (request: Request) => { try { if (request.method !== 'GET') checkOrigin(request); return json(await work(request, await requireUser(request))); } catch (error) { return apiFailure(error); } };
}
