import { identifyMuscles } from './training/service';
export type ScopeResult = {
    allowed: boolean;
    reason: 'fitness' | 'unrelated' | 'uncertain';
};
// Demonstration-only classifier. Replace with a robust server-side policy pipeline in Milestone 3.
export function classifyScope(message: string): ScopeResult {
    const text = message.toLowerCase().trim();
    if (!text)
        return { allowed: false, reason: 'uncertain' };
    const fitness = /\b(gym|fitness|exercise|workout|muscle|traps|lats|chest|squat|train|training|strength|protein|calories|nutrition|diet|meal|food|recovery|creatine|hypertrophy|reps|sets|glutes|shoulders)\b/i.test(text);
    const unrelated = /\b(python|javascript|coding|code a|write code|homework|assignment|essay|algebra|maths|math|poem|fiction)\b/i.test(text);
    if (fitness || identifyMuscles(message).length > 0)
        return { allowed: true, reason: 'fitness' };
    if (unrelated)
        return { allowed: false, reason: 'unrelated' };
    return { allowed: false, reason: 'uncertain' };
}
