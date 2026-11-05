import { exercises } from '../exercises';
import { identifyMuscles, recommend } from '../training/service';
import type { CoachInput, ScopeDecision } from './schemas';
export function retrieveExercises(input: CoachInput, scope: ScopeDecision) {
  if (!scope.needsExercises) return { exercises: [], availability:'not_requested', clarification: null };
  if (!input.profile.experience || !input.profile.equipment) return { exercises: [], availability:'needs_preferences', clarification: 'Concrete exercise selection needs confirmed experience and equipment. Give useful general training guidance first; ask only for the missing information. Do not assume equipment, availability or invent movements. Existing conversation declarations count; no need to force the preferences form.' };
  const detected = identifyMuscles(input.message);
  const muscles = detected.length ? detected : scope.muscles.length ? scope.muscles : ['Chest','Upper back','Quads','Hamstrings'] as const;
  const groups = muscles.map(muscle => recommend({ muscle, experience: input.profile.experience!, equipment: input.profile.equipment! }));
  // Interleave targets so a multi-muscle request is not filled by its first muscle alone.
  const unique: typeof exercises = [];
  for (let index = 0; index < 4 && unique.length < 4; index++) {
    for (const group of groups) {
      const exercise = group[index];
      if (exercise && !unique.some(item => item.id === exercise.id)) unique.push(exercise);
      if (unique.length === 4) break;
    }
  }
  return { exercises: unique, availability:unique.length?'ready':'no_match', clarification: unique.length ? null : 'No exercise in the current library matches that target, experience and confirmed equipment. Try a different muscle on Training, or update your equipment if you have more available. I will not invent an exercise or assume extra equipment.' };
}
export function validateExerciseIds(ids: string[], candidates: typeof exercises) {
  return new Set(ids).size === ids.length && ids.every(id => candidates.some(e => e.id === id) && exercises.some(e => e.id === id));
}
