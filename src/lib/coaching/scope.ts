import {z} from 'zod';
import {scopeSchema} from '../coach/schemas';
import {goals} from '../profile/schema';
import {equipmentOptions} from '../training/types';
import {exercises} from '../exercises';
export const planScopes=['training_only','nutrition_only','training_and_nutrition'] as const;
export type PlanScope=typeof planScopes[number];
export const includesTraining=(scope:PlanScope)=>scope!=='nutrition_only';
export const includesNutrition=(scope:PlanScope)=>scope!=='training_only';
export const planIntentSchema=scopeSchema.extend({
 availableEquipment:z.array(z.enum(equipmentOptions)).max(equipmentOptions.length).nullable(),trainingRequested:z.boolean(),nutritionRequested:z.boolean(),requestedGoal:z.enum(goals).nullable(),
 availableMinutes:z.number().int().min(10).max(240).nullable(),trainingDays:z.number().int().min(1).max(7).nullable(),
 excludedExerciseIds:z.array(z.enum(exercises.map(e=>e.id) as [string,...string[]])).max(exercises.length),
}).strict();
export function resolvePlanScope(intent:{trainingRequested:boolean;nutritionRequested:boolean},selection?:PlanScope):PlanScope{
 return selection??(intent.nutritionRequested?(intent.trainingRequested?'training_and_nutrition':'nutrition_only'):'training_only');
}
export const scopeLabels:Record<PlanScope,string>={training_only:'Training',nutrition_only:'Nutrition',training_and_nutrition:'Training + nutrition'};
