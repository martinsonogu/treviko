import 'server-only';
import { CoachLimitError,secondsUntilBudgetReset,nextBudgetReset } from './limits';
export type ProviderUsage = { inputTokens: number; outputTokens: number };
export type UsageStage = 'scope' | 'coach' | 'review';
export type UsageFinish = (stage: UsageStage, model: string, success: boolean, usage: ProviderUsage | null, prices: {input?:number;output?:number})=>void|Promise<void>;
export interface UsageMonitor { reserve(tokens:number,limit:number,context?:{stage:UsageStage;model:string;maxOutput:number}):UsageFinish|Promise<UsageFinish> }
type UsageRecord = { calls: number; errors: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number; unpricedCalls: number; unknownUsageCalls: number };
export class CoachUsageMonitor {
  private day = '';
  private committed = 0;
  private reserved = 0;
  private totals: UsageRecord = { calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, unpricedCalls: 0, unknownUsageCalls: 0 };
  constructor(private now: () => number = Date.now, private log: (record: object) => void = () => {}) {}
  reserve(tokens: number, limit: number) {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (this.day !== today) { this.day = today; this.committed = 0; }
    if (this.committed + this.reserved + tokens > limit) throw new CoachLimitError('TOKEN_BUDGET',secondsUntilBudgetReset(this.now()),nextBudgetReset(this.now()));
    this.reserved += tokens;
    let finished = false;
    return (stage: UsageStage, model: string, success: boolean, usage: ProviderUsage | null, prices: { input?: number; output?: number }) => {
      if (finished) return; finished = true;
      this.reserved -= tokens;
      // Unknown usage (timeout/transport errors) remains charged at the reserved upper bound.
      this.committed += usage ? usage.inputTokens + usage.outputTokens : tokens;
      this.totals.calls++; if (!success) this.totals.errors++;
      if (usage) { this.totals.inputTokens += usage.inputTokens; this.totals.outputTokens += usage.outputTokens; } else this.totals.unknownUsageCalls++;
      const estimatedCostUsd = usage && prices.input !== undefined && prices.output !== undefined ? (usage.inputTokens * prices.input + usage.outputTokens * prices.output) / 1000000 : null;
      if (estimatedCostUsd === null) this.totals.unpricedCalls++; else this.totals.estimatedCostUsd += estimatedCostUsd;
      this.log({ event: 'coach_usage', stage, model, success, usage, estimatedCostUsd });
    };
  }
  snapshot() { return { ...this.totals, budgetDay: this.day, committedTokens: this.committed, reservedTokens: this.reserved }; }
}
// Aggregate metrics are process-local and are not exposed by a public endpoint.
export const coachUsage = new CoachUsageMonitor(Date.now, record => {
  if (process.env.COACH_LOG_USAGE === 'true') console.info(JSON.stringify(record));
});
