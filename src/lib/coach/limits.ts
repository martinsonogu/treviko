import 'server-only';
export class CoachLimitError extends Error {
  constructor(public code: 'RATE_LIMITED' | 'BUSY' | 'TOKEN_BUDGET', public retryAfter = 60) { super(code); }
}
export class CoachLimiter {
  private buckets = new Map<string, { count: number; expires: number }>();
  private active = 0;
  constructor(private now: () => number = Date.now) {}
  private consume(key: string, limit: number) {
    const now = this.now();
    for (const [id, bucket] of this.buckets) if (bucket.expires <= now) this.buckets.delete(id);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= 5000) throw new CoachLimitError('BUSY');
      bucket = { count: 0, expires: now + 60000 }; this.buckets.set(key, bucket);
    }
    if (bucket.count >= limit) throw new CoachLimitError('RATE_LIMITED', Math.max(1, Math.ceil((bucket.expires - now) / 1000)));
    bucket.count++;
  }
  enter(key: string, limits: { requestsPerMinute: number; globalRequestsPerMinute: number; maxConcurrent: number }) {
    this.consume('global', limits.globalRequestsPerMinute);
    this.consume(`subject:${key}`, limits.requestsPerMinute);
    if (this.active >= limits.maxConcurrent) throw new CoachLimitError('BUSY', 5);
    this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
}
export const coachLimiter = new CoachLimiter();
