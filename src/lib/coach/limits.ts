import 'server-only';
export type CoachLimitCode='RATE_LIMITED'|'BUSY'|'TOKEN_BUDGET'|'COST_BUDGET';
export function nextBudgetReset(now=Date.now()){const date=new Date(now);date.setUTCHours(24,0,0,0);return date.toISOString();}
export function secondsUntilBudgetReset(now=Date.now()){return Math.max(1,Math.ceil((Date.parse(nextBudgetReset(now))-now)/1000));}
export class CoachLimitError extends Error {
 readonly retryAfter:number;readonly resetAt?:string;
 constructor(public code:CoachLimitCode,retryAfter?:number,resetAt?:string){super(code);const daily=code==='TOKEN_BUDGET'||code==='COST_BUDGET';this.retryAfter=retryAfter??(daily?secondsUntilBudgetReset():60);this.resetAt=daily?(resetAt??nextBudgetReset()):undefined;}
}
export function coachLimitMessage(error:CoachLimitError){
 switch(error.code){
  case 'RATE_LIMITED':return 'Too many coaching requests this minute. Please wait briefly and try again.';
  case 'BUSY':return 'Another coaching request is still running. Wait for it to finish before retrying.';
  case 'COST_BUDGET':return `The daily AI cost budget cannot cover this response. Try again after ${new Date(error.resetAt!).toUTCString()}.`;
  case 'TOKEN_BUDGET':return `The daily AI token budget cannot cover the next response reservation. Try again after ${new Date(error.resetAt!).toUTCString()}.`;
 }
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
