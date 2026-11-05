import {z} from 'zod';
import {equipmentOptions,experienceLevels} from '../training/types';
import {goals} from '../profile/schema';
const text=(max:number)=>z.string().trim().min(1).max(max);
export const proposalDraftSchema=z.object({
 rationale:text(900),assumptions:z.array(text(200)).max(8),
 experience:z.enum(experienceLevels),equipment:z.array(z.enum(equipmentOptions)).max(8),
 sessionMinutes:z.number().int().min(10).max(240),
 days:z.array(z.object({weekday:z.number().int().min(1).max(7),name:text(100),exerciseIds:z.array(text(80)).min(1).max(6)}).strict()).min(1).max(7),
 meals:z.array(z.object({slot:z.number().int().min(1).max(8),name:text(120),guidance:text(700),recipeId:text(100).nullable()}).strict()).min(1).max(8),
}).strict();
export const planPayloadSchema=proposalDraftSchema.omit({days:true}).extend({
 primaryGoal:z.enum(goals),
 days:z.array(z.object({weekday:z.number().int().min(1).max(7),name:text(100),exercises:z.array(z.object({exerciseId:text(80),sets:z.number().int().min(1).max(4),reps:text(30),unit:z.enum(['reps','seconds'])}).strict()).min(1).max(6)}).strict()).min(1).max(7),
}).strict();
export type PlanPayload=z.infer<typeof planPayloadSchema>;
export const proposalRequestSchema=z.object({message:text(2000),conversationId:z.string().uuid().optional()}).strict();
export const confirmRequestSchema=z.object({proposalId:z.string().uuid(),confirm:z.literal(true)}).strict();
export const cancelRequestSchema=z.object({proposalId:z.string().uuid()}).strict();
export const proposalRowSchema=z.object({id:z.string().uuid(),preference_fingerprint:z.string(),base_version:z.number().int(),payload:planPayloadSchema,status:z.enum(['pending','confirmed','cancelled']),created_at:z.string(),expires_at:z.string()});
export type PlanProposal=z.infer<typeof proposalRowSchema>;
export type ActivePlan={id:string;preferenceFingerprint:string;version:number;status:'active'|'paused';createdAt:string;updatedAt:string;payload:PlanPayload;mealPlanId:string|null};

// The provider sees the same finite choices that the server will validate.
export function proposalModelSchema(options:{experience:typeof experienceLevels[number];equipment:typeof equipmentOptions[number][];exerciseIds:string[];recipeIds:string[]}){
 if(!options.exerciseIds.length)throw new Error('No model exercise options');
 const exerciseId=z.enum(options.exerciseIds as [string,...string[]]);
 const recipeId=options.recipeIds.length?z.enum(options.recipeIds as [string,...string[]]).nullable():z.null();
 const equipment=options.equipment.length?z.array(z.enum(options.equipment as [typeof equipmentOptions[number],...typeof equipmentOptions[number][]])).max(options.equipment.length):z.array(z.enum(equipmentOptions)).max(0);
 return proposalDraftSchema.extend({experience:z.literal(options.experience),equipment,
  days:z.array(proposalDraftSchema.shape.days.element.extend({exerciseIds:z.array(exerciseId).min(1).max(6)})).min(1).max(7),
  meals:z.array(proposalDraftSchema.shape.meals.element.extend({recipeId})).min(1).max(8),
 }).strict();
}

export const proposalResponseSchema=z.object({proposal:proposalRowSchema,conversationId:z.string().uuid(),historySaved:z.boolean().optional()});
