import {z} from 'zod';
import {equipmentOptions,experienceLevels} from '../training/types';
import {goals} from '../profile/schema';
import {muscleGroups} from '../training/types';
import {conversationPreferencesSchema} from './conversation-preferences';
import {planScopes,type PlanScope} from './scope';
const text=(max:number)=>z.string().trim().min(1).max(max);
export const proposalDraftSchema=z.object({
 rationale:text(900),assumptions:z.array(text(200)).max(8),
 experience:z.enum(experienceLevels),equipment:z.array(z.enum(equipmentOptions)).max(equipmentOptions.length),
 sessionMinutes:z.number().int().min(10).max(240),
 days:z.array(z.object({weekday:z.number().int().min(1).max(7),name:text(100),exerciseIds:z.array(text(80)).min(1).max(6)}).strict()).max(7),
 meals:z.array(z.object({slot:z.number().int().min(1).max(8),name:text(120),guidance:text(700),recipeId:text(100).nullable()}).strict()).max(8),
}).strict();
export const planPayloadSchema=proposalDraftSchema.omit({days:true}).extend({
 conversationPreferences:conversationPreferencesSchema.optional(),
 schemaVersion:z.union([z.literal(1),z.literal(2)]).default(1),scope:z.enum(planScopes).default('training_and_nutrition'),
 trainingRationale:text(900).optional(),nutritionRationale:text(900).optional(),
 primaryGoal:z.enum(goals),savedProfileGoal:z.enum(goals).nullable().optional(),goalSource:z.enum(['request','profile','active_plan','default']).optional(),trainingGoal:z.enum(goals).nullable().optional(),nutritionGoal:z.enum(goals).nullable().optional(),
 targetMuscles:z.array(z.enum(muscleGroups)).optional(),excludedExerciseIds:z.array(text(80)).optional(),progression:text(900).optional(),qualityWarnings:z.array(text(300)).max(20).optional(),
 days:z.array(z.object({weekday:z.number().int().min(1).max(7),name:text(100),warmupMinutes:z.number().int().min(1).max(10).optional(),estimatedMinutes:z.number().int().positive().max(240).optional(),workingSeconds:z.number().nonnegative().optional(),restSeconds:z.number().nonnegative().optional(),transitionSeconds:z.number().nonnegative().optional(),conditioningSeconds:z.literal(0).optional(),warmup:text(600).optional(),recovery:text(600).optional(),exercises:z.array(z.object({exerciseId:text(80),sets:z.number().int().min(1).max(4),reps:text(30),unit:z.enum(['reps','seconds']),restSeconds:z.number().int().min(30).max(180).optional(),repetitionsInReserve:z.number().int().min(2).max(4).optional(),cue:text(700).optional(),reason:text(500).optional(),progression:text(700).optional(),substitutionId:text(80).nullable().optional()}).strict()).min(1).max(6)}).strict()).max(7),
}).strict();
export type PlanPayload=z.infer<typeof planPayloadSchema>;
export const proposalRequestSchema=z.object({message:text(2000),conversationId:z.string().uuid().optional(),proposalId:z.string().uuid().optional(),scope:z.enum(planScopes).optional(),goal:z.enum(goals).optional()}).strict();
export const confirmRequestSchema=z.object({proposalId:z.string().uuid(),confirm:z.literal(true)}).strict();
export const cancelRequestSchema=z.object({proposalId:z.string().uuid()}).strict();
export const proposalRowSchema=z.object({id:z.string().uuid(),preference_fingerprint:z.string(),base_version:z.number().int(),payload:planPayloadSchema,status:z.enum(['pending','confirmed','cancelled']),created_at:z.string(),expires_at:z.string()});
export type PlanProposal=z.infer<typeof proposalRowSchema>;
export type ActivePlan={id:string;preferenceFingerprint:string;trainingPreferenceFingerprint?:string|null;nutritionPreferenceFingerprint?:string|null;version:number;status:'active'|'paused';createdAt:string;updatedAt:string;payload:PlanPayload;mealPlanId:string|null};

// The provider sees the same finite choices that the server will validate.
export function proposalModelSchema(options:{experience:typeof experienceLevels[number];equipment:typeof equipmentOptions[number][];exerciseIds:string[];recipeIds:string[];scope?:PlanScope;minutes?:number}){
 if(!options.exerciseIds.length&&options.scope!=='nutrition_only')throw new Error('No model exercise options');
 const exerciseId=options.exerciseIds.length?z.enum(options.exerciseIds as [string,...string[]]):text(80);
 const recipeId=options.recipeIds.length?z.enum(options.recipeIds as [string,...string[]]).nullable():z.null();
 const equipment=options.equipment.length?z.array(z.enum(options.equipment as [typeof equipmentOptions[number],...typeof equipmentOptions[number][]])).max(options.equipment.length):z.array(z.enum(equipmentOptions)).max(0);
 return proposalDraftSchema.extend({experience:z.literal(options.experience),equipment,...(options.minutes?{sessionMinutes:z.literal(options.minutes)}:{}),
  days:options.scope==='nutrition_only'?z.array(proposalDraftSchema.shape.days.element).max(0):z.array(proposalDraftSchema.shape.days.element.extend({exerciseIds:z.array(exerciseId).min(1).max(6)})).min(1).max(7),
  meals:options.scope==='training_only'?z.array(proposalDraftSchema.shape.meals.element).max(0):z.array(proposalDraftSchema.shape.meals.element.extend({recipeId})).min(1).max(8),
 }).strict();
}

export const proposalResponseSchema=z.object({proposal:proposalRowSchema,conversationId:z.string().uuid(),historySaved:z.boolean().optional()});
