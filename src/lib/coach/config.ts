import 'server-only';
import { z } from 'zod';
const integer = (fallback: number, min: number, max: number) => z.coerce.number().int().min(min).max(max).default(fallback);
const configSchema = z.object({
  apiKey: z.string().trim().optional(), model: z.string().trim().min(1).max(100).refine(value=>!value.startsWith('sk-')&&!value.startsWith('sb_secret_')).optional(),
  reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high']).optional(),
  timeoutMs: integer(15000, 1000, 30000),
  requestTimeoutMs: integer(45000, 5000, 90000),
  maxOutputTokens: integer(1800, 256, 4000),
  policyOutputTokens: integer(1000, 256, 2000),
  requestsPerMinute: integer(8, 1, 60),
  globalRequestsPerMinute: integer(30, 1, 120),
  maxConcurrent: integer(2, 1, 8),
  dailyTokenLimit: integer(100000, 1000, 10000000),
  inputPricePerMillion: z.coerce.number().min(0).max(1000).optional(),
  outputPricePerMillion: z.coerce.number().min(0).max(1000).optional(),
  allowAnonymous: z.boolean(),
});
export type CoachConfig = z.infer<typeof configSchema>;
export function getCoachConfig(env: NodeJS.ProcessEnv = process.env): CoachConfig {
  const read = (key: string) => env[key]?.trim() || undefined;
  return configSchema.parse({
    apiKey: read('OPENAI_API_KEY'), model: read('OPENAI_MODEL'), reasoningEffort: read('OPENAI_REASONING_EFFORT'),
    timeoutMs: read('COACH_PROVIDER_TIMEOUT_MS'), requestTimeoutMs: read('COACH_REQUEST_TIMEOUT_MS'),
    maxOutputTokens: read('COACH_MAX_OUTPUT_TOKENS'), policyOutputTokens: read('COACH_POLICY_OUTPUT_TOKENS'),
    requestsPerMinute: read('COACH_REQUESTS_PER_MINUTE'), globalRequestsPerMinute: read('COACH_GLOBAL_REQUESTS_PER_MINUTE'),
    maxConcurrent: read('COACH_MAX_CONCURRENT'), dailyTokenLimit: read('COACH_DAILY_TOKEN_LIMIT'),
    inputPricePerMillion: read('OPENAI_INPUT_PRICE_PER_MILLION'), outputPricePerMillion: read('OPENAI_OUTPUT_PRICE_PER_MILLION'),
    allowAnonymous: env.COACH_ALLOW_ANONYMOUS === 'true' || (env.NODE_ENV !== 'production' && env.COACH_ALLOW_ANONYMOUS !== 'false'),
  });
}
export function configurationMessage(config: CoachConfig) {
  if (!config.apiKey) return 'Live AI is not configured. Set OPENAI_API_KEY in .env.local on the server and restart the app. No live AI response was generated.';
  if (!config.model) return 'Live AI needs a model configured. Set OPENAI_MODEL on the server and restart the app. No live AI response was generated.';
  return null;
}
