import { coachResponseSchema, type CoachResponse } from './schemas';
import type { Exercise } from '../training/types';
export type CoachPayload = CoachResponse & { exercises: Exercise[] };
export function formatResponse(fields: Omit<CoachResponse, 'exerciseIds' | 'exerciseSlugs' | 'nutritionData'> & { exerciseIds?: string[] }, candidates: Exercise[] = []): CoachPayload {
  const ids = fields.exerciseIds ?? [];
  const selected = ids.map(id => candidates.find(e => e.id === id));
  if (selected.some(e => !e)) throw new Error('Invalid exercise reference');
  const records = selected as Exercise[];
  const response = coachResponseSchema.parse({ ...fields, exerciseIds: ids, exerciseSlugs: records.map(e => e.slug), nutritionData: 'not_connected' });
  return { ...response, exercises: records };
}
