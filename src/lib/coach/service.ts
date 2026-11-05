import 'server-only';
import {buildConversationContext,effectivePreferences,projectConversationContext} from './context';
import { projectCoachProfile } from '../profile/personalisation';
import { configurationMessage, type CoachConfig } from './config';
import { draftSchema, reviewSchema, type CoachInput, type ScopeDecision } from './schemas';
import { preflightScope, validateScope, conversationalScope } from './scope';
import { safetyMessages } from './safety';
import { retrieveExercises, validateExerciseIds } from './exercises';
import { formatResponse, type CoachPayload } from './format';
import { type CoachProvider, ProviderFailure } from './provider';
import { CoachLimitError,coachLimitMessage } from './limits';

export type CoachResult = { httpStatus: number; body: CoachPayload; retryAfter?: number };
export function coachError(code: string, message: string, httpStatus: number, status: 'error' | 'unavailable' | 'rate_limited' = 'error'): CoachResult {
  return { httpStatus, body: formatResponse({ message, category: status === 'unavailable' ? 'configuration' : 'error', status, mode: 'unavailable', code }) };
}
function policyResponse(scope: ScopeDecision): CoachResult | null {
  if (scope.safety !== 'none') return { httpStatus: 200, body: formatResponse({ message: safetyMessages[scope.safety], category: 'safety', status: 'safety', mode: 'policy' }) };
  if (scope.injection || scope.outcome === 'unrelated') return { httpStatus: 200, body: formatResponse({ message: "I focus on fitness, training and nutrition. I can help with workouts, meals and recovery, but I can't take on that unrelated request.", category: 'unrelated', status: 'declined', mode: 'policy' }) };
  if (scope.outcome === 'ambiguous') return { httpStatus: 200, body: formatResponse({ message: 'I can help you choose a training routine, plan meals around your preferences, or improve recovery. Which would you like to work on?', category: 'ambiguous', status: 'clarification', mode: 'policy' }) };
  return null;
}
// Abort the service even if an injected provider fails to honour its signal.
async function withinDeadline<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new ProviderFailure('PROVIDER_TIMEOUT');
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { abort = () => reject(new ProviderFailure('PROVIDER_TIMEOUT')); signal.addEventListener('abort', abort, { once: true }); });
  try { return await Promise.race([task(), stopped]); }
  finally { signal.removeEventListener('abort', abort); }
}
export async function runCoach(input: CoachInput, config: CoachConfig, providerFactory: () => CoachProvider, signal: AbortSignal): Promise<CoachResult> {
  const preflight = preflightScope(input);
  if (preflight) { const response = policyResponse(preflight); if (response) return response; }
  const missing = configurationMessage(config);
  if (missing) return coachError('NOT_CONFIGURED', missing, 503, 'unavailable');
  try {
    if (signal.aborted) throw new ProviderFailure('PROVIDER_TIMEOUT');
    const provider = providerFactory();
    const conversation=buildConversationContext(input);
    const providedPreferences=input.profile;
    const classifierProfile=Object.fromEntries(Object.entries({goals:providedPreferences.goals,experience:providedPreferences.experience}).filter(([,value])=>value!==undefined));
    const classified = validateScope(await withinDeadline(() => provider.classify({...input,profile:classifierProfile}, signal), signal));
    // Recover well-defined conversation intents only after semantic safety/injection checks.
    const scope = classified.safety!=='none'||classified.injection ? classified : conversationalScope(input) ?? classified;
    const policy = policyResponse(scope); if (policy) return policy;
    input = {...input,providedPreferences:projectCoachProfile(providedPreferences,scope.topic),profile:projectCoachProfile(effectivePreferences(providedPreferences,conversation),scope.topic),conversationContext:projectConversationContext(conversation,scope.topic)};
    const retrieved = retrieveExercises(input, scope);
    // Missing selection inputs limit cards, not the whole coaching conversation.
    input.exerciseContext={availability:retrieved.availability,guidance:retrieved.clarification};
    const draft = draftSchema.parse(await withinDeadline(() => provider.generate(input, scope, retrieved.exercises, signal), signal));
    if ((scope.topic==='nutrition'||scope.topic==='mixed') && /\b\d+(?:[.,]\d+)?\s*(?:kcal|calories?|kilocalories?|grams?|mg|g)\b/i.test(draft.message)) throw new ProviderFailure('INVALID_OUTPUT');
    if (!validateExerciseIds(draft.exerciseIds, retrieved.exercises)) throw new ProviderFailure('INVALID_OUTPUT');
    if (retrieved.exercises.length && scope.needsExercises && !draft.exerciseIds.length) throw new ProviderFailure('INVALID_OUTPUT');
    const review = reviewSchema.parse(await withinDeadline(() => provider.review(input, draft, retrieved.exercises, signal), signal));
    if (!Object.values(review).every(Boolean)) throw new ProviderFailure('INVALID_OUTPUT');
    return { httpStatus: 200, body: formatResponse({ message: draft.message, category: ['greeting','fitness_profile','coaching_followup'].includes(scope.category) ? scope.category as 'greeting'|'fitness_profile'|'coaching_followup' : scope.topic === 'other' ? 'fitness' : scope.topic, status: 'ok', mode: 'live', exerciseIds: draft.exerciseIds }, retrieved.exercises) };
  } catch (error) {
    if (error instanceof CoachLimitError) return { ...coachError(error.code, coachLimitMessage(error), 429, 'rate_limited'), retryAfter: error.retryAfter };
    if (error instanceof ProviderFailure && error.code === 'PROVIDER_TIMEOUT') return coachError('PROVIDER_TIMEOUT', 'Kivo took too long to respond. Please try again.', 504);
    if (error instanceof ProviderFailure && error.code === 'PROVIDER_ERROR') return coachError('PROVIDER_UNAVAILABLE', 'The AI service is unavailable right now. Please try again later.', 502);
    return coachError('RESPONSE_UNAVAILABLE', 'I could not produce a validated coaching response. Please rephrase your fitness or nutrition question and try again.', 502);
  }
}
