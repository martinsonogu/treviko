import 'server-only';
import { userProfileSchema, profilePatchSchema, type ProfilePatch, type UserProfile } from './schema';
import { ApiError } from '../api/http';
import {containsSecret} from '../persistence/conversations';
import type { AuthContext } from '../auth/session';
const baseFields = { displayName: 'display_name', units: 'units', timeZone: 'time_zone', language: 'language', heightCm: 'height_cm', weightKg: 'weight_kg', age: 'age', onboardingStep: 'onboarding_step', onboardingComplete: 'onboarding_complete' } as const;
const fitnessFields = { experience: 'experience', goals: 'goals', equipment: 'equipment', environment: 'environment', trainingDays: 'training_days', sessionMinutes: 'session_minutes', targetMuscles: 'target_muscles' } as const;
const nutritionFields = { dietaryPattern: 'dietary_pattern', cuisines: 'cuisines', dislikes: 'dislikes', allergies: 'allergies', allergyNotes: 'allergy_notes', weeklyBudget: 'weekly_budget', budgetCurrency: 'budget_currency', mealsPerDay: 'meals_per_day' } as const;
function fromRow(row: Record<string, unknown>, fields: Record<string, string>) { return Object.fromEntries(Object.entries(fields).filter(([, column]) => column in row).map(([field, column]) => [field, row[column]])); }
function toRow(profile: ProfilePatch, fields: Record<string, string>) { return Object.fromEntries(Object.entries(fields).filter(([field]) => field in profile).map(([field, column]) => [column, profile[field as keyof ProfilePatch]])); }
export async function getProfile(context: AuthContext): Promise<UserProfile> {
  const results = await Promise.all(['profiles','user_fitness_preferences','user_nutrition_preferences'].map(table => context.db.from(table).select('*').eq('user_id', context.userId).single()));
  if (results.some(r => r.error || !r.data)) throw new ApiError(503, 'PROFILE_UNAVAILABLE', 'Your profile could not load. Check database migrations and try again.');
  return userProfileSchema.parse({ ...fromRow(results[0].data, baseFields), ...fromRow(results[1].data, fitnessFields), ...fromRow(results[2].data, nutritionFields) });
}
export async function updateProfile(context: AuthContext, patch: ProfilePatch) {
  const validated = profilePatchSchema.parse(patch);
  if(containsSecret(validated))throw new ApiError(400,'CREDENTIALS_REJECTED','Do not save API credentials in your profile.');
  const { error } = await context.db.rpc('save_profile', { p_base: toRow(validated, baseFields), p_fitness: toRow(validated, fitnessFields), p_nutrition: toRow(validated, nutritionFields) });
  if (error) throw new ApiError(503, 'SAVE_FAILED', 'Your preferences were not saved. Please try again.');
  return getProfile(context);
}

// Read only the saved name needed by the authenticated header, using the user's RLS client.
export async function getProfileDisplayName(context:AuthContext):Promise<string>{
 const {data,error}=await context.db.from('profiles').select('display_name').eq('user_id',context.userId).single();
 return !error&&typeof data?.display_name==='string'?data.display_name:'';
}
