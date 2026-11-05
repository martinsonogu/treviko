import {z} from 'zod';
import {equipmentOptions,experienceLevels} from '../training/types';
import {userProfileSchema,type UserProfile} from '../profile/schema';
import type {ConversationFacts} from '../coach/context';
export class PlanPreferenceError extends Error{readonly code='EQUIPMENT_CONFIRMATION_REQUIRED';}
export const conversationPreferencesSchema=z.object({equipment:z.array(z.enum(equipmentOptions)).optional(),trainingDays:z.number().int().min(1).max(7).optional(),sessionMinutes:z.number().int().min(10).max(240).optional(),experience:z.enum(experienceLevels).optional()}).strict();
export type ConversationPreferences=z.infer<typeof conversationPreferencesSchema>;
export function planConversationPreferences(facts:ConversationFacts):ConversationPreferences{
 return conversationPreferencesSchema.parse({...(facts.equipment!==undefined?{equipment:facts.equipment}:{}),...(facts.trainingFrequency!==undefined?{trainingDays:facts.trainingFrequency}:{}),...(facts.sessionMinutes!==undefined?{sessionMinutes:facts.sessionMinutes}:{}),...(facts.experience?{experience:facts.experience}:{})});
}
export function profileForPlan(saved:UserProfile,preferences?:ConversationPreferences):UserProfile{
 if(!preferences)return saved;const values=conversationPreferencesSchema.parse(preferences);
 if(values.equipment&&saved.equipment!==null&&values.equipment.some(item=>!saved.equipment!.includes(item)))throw new PlanPreferenceError('Your saved equipment does not include this option. Confirm newly available equipment in Profile before using it.');
 const experience=values.experience&&(!saved.experience||experienceLevels.indexOf(values.experience)<=experienceLevels.indexOf(saved.experience))?values.experience:saved.experience;
 return userProfileSchema.parse({...saved,...values,experience,trainingDays:values.trainingDays===undefined?saved.trainingDays:saved.trainingDays===null?values.trainingDays:Math.min(saved.trainingDays,values.trainingDays),sessionMinutes:values.sessionMinutes===undefined?saved.sessionMinutes:saved.sessionMinutes===null?values.sessionMinutes:Math.min(saved.sessionMinutes,values.sessionMinutes)});
}
export function missingPlanInformation(profile:UserProfile){return profile.equipment===null?'equipment':profile.trainingDays===null?'training_days':null;}

export function inheritPlanPreferences(saved:UserProfile,prior?:ConversationPreferences):ConversationPreferences{
 const values={...prior};
 // An updated saved equipment restriction supersedes older plan-specific availability.
 if(saved.equipment!==null&&values.equipment?.some(item=>!saved.equipment!.includes(item)))delete values.equipment;
 return values;
}
