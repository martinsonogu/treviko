import { z } from 'zod';
import { equipmentOptions, experienceLevels, muscleGroups } from '../training/types';
export const goals = ['muscle_gain', 'strength', 'recomposition', 'fat_loss', 'general_fitness'] as const;
export const allergens = ['milk', 'eggs', 'fish', 'shellfish', 'peanuts', 'tree_nuts', 'soy', 'wheat', 'sesame', 'celery', 'mustard', 'lupin', 'molluscs', 'sulphites'] as const;
const textList = z.array(z.string().trim().min(1).max(80)).max(20).refine(values => new Set(values.map(v => v.toLowerCase())).size === values.length, 'Remove duplicates');
export const userProfileSchema = z.object({
  displayName: z.string().trim().max(80).default(''),
  units: z.enum(['metric', 'imperial']).default('metric'),
  timeZone: z.string().min(1).max(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Invalid time zone').default('Europe/London'),
  language: z.literal('en').default('en'),
  experience: z.enum(experienceLevels).nullable().default(null),
  goals: z.array(z.enum(goals)).max(goals.length).refine(v => new Set(v).size === v.length).default([]),
  equipment: z.array(z.enum(equipmentOptions)).max(equipmentOptions.length).refine(v => new Set(v).size === v.length).nullable().default(null),
  environment: z.enum(['gym', 'home', 'mixed']).nullable().default(null),
  trainingDays: z.number().int().min(1).max(7).nullable().default(null),
  sessionMinutes: z.number().int().min(10).max(240).nullable().default(null),
  targetMuscles: z.array(z.enum(muscleGroups)).max(muscleGroups.length).refine(v => new Set(v).size === v.length).default([]),
  dietaryPattern: z.enum(['unspecified', 'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'other']).default('unspecified'),
  cuisines: textList.default([]), dislikes: textList.default([]),
  allergies: z.array(z.enum(allergens)).max(allergens.length).refine(v => new Set(v).size === v.length).default([]),
  allergyNotes: z.string().trim().max(300).default(''),
  weeklyBudget: z.number().finite().min(0).max(1000000).nullable().default(null),
  budgetCurrency: z.string().regex(/^[A-Z]{3}$/).default('GBP'),
  mealsPerDay: z.number().int().min(1).max(8).nullable().default(null),
  heightCm: z.number().finite().min(80).max(250).nullable().default(null),
  weightKg: z.number().finite().min(20).max(500).nullable().default(null),
  age: z.number().int().min(13).max(120).nullable().default(null),
  onboardingStep: z.number().int().min(0).max(6).default(0),
  onboardingComplete: z.boolean().default(false),
}).strict();
// Zod 4 applies defaults even inside optional fields. Remove defaults for PATCH so
// changing one preference cannot reset unrelated saved data.
type ProfileShape=typeof userProfileSchema.shape;
type PatchShape={ [K in keyof ProfileShape]: z.ZodOptional<ReturnType<ProfileShape[K]['removeDefault']>> };
const patchShape=Object.fromEntries(Object.entries(userProfileSchema.shape).map(([key,field])=>[key,field.removeDefault().optional()])) as PatchShape;
export const profilePatchSchema = z.object(patchShape).strict();
export type UserProfile = z.infer<typeof userProfileSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export const emptyProfile = (): UserProfile => userProfileSchema.parse({});
