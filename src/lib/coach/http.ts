import 'server-only';
import { NextResponse } from 'next/server';
import { coachRequestSchema, profileSchema } from './schemas';
import { configurationMessage, getCoachConfig, type CoachConfig } from './config';
import { loadStoredCoachProfile, resolveCoachIdentity, type CoachPrincipal, type IdentityResolver } from './identity';
import { coachLimiter, CoachLimitError,coachLimitMessage, type CoachLimiter } from './limits';
import { createOpenAIProvider, type CoachProvider } from './provider';
import { coachError, runCoach, type CoachResult } from './service';

const BODY_LIMIT = 24000;
class BodyError extends Error { constructor(public code: string, public status: number) { super(code); } }
export async function readCoachBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BodyError('UNSUPPORTED_MEDIA_TYPE', 415);
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > BODY_LIMIT) throw new BodyError('BODY_TOO_LARGE', 413);
  if (!request.body) throw new BodyError('INVALID_JSON', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new BodyError('BODY_TIMEOUT', 408)); }, 5000); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > BODY_LIMIT) { void reader.cancel().catch(() => {}); throw new BodyError('BODY_TOO_LARGE', 413); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new BodyError('INVALID_JSON', 400); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
function send(result: CoachResult) {
  return NextResponse.json(result.body, { status: result.httpStatus, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}) } });
}
function blockedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // Native clients/curl may omit Origin; this is CSRF defence, not authentication.
  return request.headers.get('sec-fetch-site') === 'cross-site' || Boolean(origin && origin !== new URL(request.url).origin);
}
export type CoachHttpDependencies = {
  config?: () => CoachConfig;
  identity?: IdentityResolver;
  storedProfile?: typeof loadStoredCoachProfile;
  provider?: (config: CoachConfig) => CoachProvider;
  limiter?: CoachLimiter;
};
export function createCoachHandler(dependencies: CoachHttpDependencies = {}) {
  return async function handle(request: Request) {
    if (blockedOrigin(request)) return send(coachError('FORBIDDEN_ORIGIN', 'This request origin is not allowed.', 403));
    let config: CoachConfig;
    try { config = (dependencies.config ?? getCoachConfig)(); }
    catch { return send(coachError('INVALID_CONFIGURATION', 'The AI coach configuration needs attention on the server. No live response was generated.', 503, 'unavailable')); }
    let principal: CoachPrincipal | null;
    try { principal = await (dependencies.identity ?? resolveCoachIdentity)(request); }
    catch { return send(coachError('UNAUTHORIZED', 'Unable to verify access to Kivo.', 401)); }
    if (!principal || (principal.kind === 'anonymous' && !config.allowAnonymous)) return send(coachError('AUTH_REQUIRED', 'Live AI access requires authentication on this deployment. The account integration is not configured yet.', 401));
    let release: (() => void) | undefined;
    try {
      // Anonymous clients share one bucket. No spoofable identity/IP headers are trusted.
      release = (dependencies.limiter ?? coachLimiter).enter(principal.kind === 'authenticated' ? `user:${principal.subject}` : 'anonymous', config);
      let body: unknown;
      try { body = await readCoachBody(request); }
      catch (error) { if (error instanceof BodyError) return send(coachError(error.code, 'Send a valid JSON request within the Coach size and time limits.', error.status)); throw error; }
      const parsed = coachRequestSchema.safeParse(body);
      if (!parsed.success) return send(coachError('INVALID_INPUT', 'Use a non-empty message of at most 2000 characters, valid preferences, and no more than 10 history entries (12000 total conversation characters).', 400));
      // Only this server-side adapter may read stored data for a verified principal.
      const stored = profileSchema.parse(await (dependencies.storedProfile ?? loadStoredCoachProfile)(principal));
      const input = { ...parsed.data, profile: { ...stored, ...parsed.data.profile } };
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.requestTimeoutMs)]);
      const result = await runCoach(input, config, () => (dependencies.provider ?? createOpenAIProvider)(config), signal);
      return send(result);
    } catch (error) {
      if (error instanceof CoachLimitError) return send({ ...coachError(error.code, coachLimitMessage(error), 429, 'rate_limited'), retryAfter: error.retryAfter });
      return send(coachError('COACH_UNAVAILABLE', 'Kivo is unavailable right now. Please try again later.', 503));
    } finally { release?.(); }
  };
}
export function getCoachAvailability(config: CoachConfig) {
  const configuration = configurationMessage(config);
  const restricted = !config.allowAnonymous;
  return { mode: configuration || restricted ? 'unavailable' : 'live', available: !configuration && !restricted, message: configuration ?? (restricted ? 'Anonymous AI access is disabled. Authentication integration is required on this deployment.' : 'Live AI is configured. Responses use server-side scope and safety checks.'), anonymous: config.allowAnonymous };
}
