import { equipmentOptions, experienceLevels, type RecommendationInput, type Equipment, type Experience } from './types';
import { resolveMuscle } from './service';
export type ValidationResult = { success: true; data: RecommendationInput } | { success: false; error: string };
// Explicit runtime schema validation; no external dependency or API key required.
export function validateRecommendation(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { success: false, error: 'Expected a JSON object.' };
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(k => !['muscle', 'experience', 'equipment'].includes(k))) return { success: false, error: 'Unknown request field.' };
  const muscle = typeof body.muscle === 'string' ? resolveMuscle(body.muscle) : undefined;
  if (!muscle) return { success: false, error: 'muscle must be a supported muscle group.' };
  if (!experienceLevels.includes(body.experience as Experience)) return { success: false, error: 'experience must be beginner, intermediate or advanced.' };
  if (!Array.isArray(body.equipment) || body.equipment.length > equipmentOptions.length || body.equipment.some(e => !equipmentOptions.includes(e as Equipment))) return { success: false, error: 'equipment must be an array of supported equipment IDs; use [] for bodyweight only.' };
  if (new Set(body.equipment).size !== body.equipment.length) return { success: false, error: 'equipment must not contain duplicates.' };
  return { success: true, data: { muscle, experience: body.experience as Experience, equipment: body.equipment as Equipment[] } };
}
