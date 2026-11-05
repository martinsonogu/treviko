import {exercises} from '../exercises';
import {experienceLevels} from '../training/types';
import {isEquipmentCompatible,prescribe} from '../training/service';
import type {UserProfile} from '../profile/schema';
import {recipeFits} from '../nutrition/service';
import type {Food,Recipe} from '../nutrition/schema';
import {containsSecret} from '../persistence/conversations';
import {ApiError} from '../api/http';
import {planPayloadSchema,proposalDraftSchema,type PlanPayload} from './schema';
export function planCandidates(profile:UserProfile){
 const experience=profile.experience??'beginner',equipment=profile.equipment??[];
 return exercises.filter(e=>experienceLevels.indexOf(e.difficulty)<=experienceLevels.indexOf(experience)&&isEquipmentCompatible(e.requiredEquipment,equipment));
}
export class PlanValidationError extends ApiError{constructor(message:string,public rule:'nutrition_numbers'|'credentials'|'experience'|'equipment'|'duplicate_options'|'duration'|'duplicate_exercises'|'exercise'|'prescription'|'meal_guidance'|'recipe'){super(422,'INVALID_PROPOSAL',message);}}
function invalid(message:string,rule:PlanValidationError['rule']):never{throw new PlanValidationError(message,rule);}
export function validatePlanPayload(value:unknown,profile:UserProfile,foods:Food[],recipes:Recipe[]):PlanPayload{
 const plan=planPayloadSchema.parse(value);
 if(/\b\d+(?:[.,]\d+)?\s*(?:kcal|calories?|kilocalories?|grams?\s+(?:of\s+)?(?:protein|fat|carb)|g\s+(?:protein|fat|carb))\b|[£$€]\s*\d/i.test(JSON.stringify(plan)))invalid('Numerical nutrition and grocery price claims are unavailable in AI proposals.','nutrition_numbers');
 if(containsSecret(plan))invalid('The proposal contains text that cannot be saved.','credentials');
 if(plan.experience!==(profile.experience??'beginner'))invalid('Experience changed. Update your profile and request a new proposal.','experience');
 if(!isEquipmentCompatible(plan.equipment,profile.equipment??[]))invalid('The proposal assumes equipment that is not confirmed in your profile.','equipment');
 if(new Set(plan.equipment).size!==plan.equipment.length||new Set(plan.days.map(d=>d.weekday)).size!==plan.days.length||new Set(plan.meals.map(m=>m.slot)).size!==plan.meals.length)invalid('The proposal contains duplicate days, equipment or meal slots.','duplicate_options');
 const candidates=planCandidates(profile);
 for(const day of plan.days){
  if(day.exercises.length>Math.max(1,Math.min(6,Math.floor(plan.sessionMinutes/5))))invalid('Too many exercises for the proposed session duration.','duration');
  if(new Set(day.exercises.map(e=>e.exerciseId)).size!==day.exercises.length)invalid('A workout contains duplicate exercises.','duplicate_exercises');
  for(const item of day.exercises){
   const exercise=candidates.find(e=>e.id===item.exerciseId);
   if(!exercise||!isEquipmentCompatible(exercise.requiredEquipment,plan.equipment))invalid('An exercise is unknown or incompatible with your equipment and experience.','exercise');
   const prescription=prescribe(exercise,plan.experience);
   if(item.sets!==prescription.sets||item.reps!==prescription.reps||item.unit!==prescription.unit)invalid('Exercise targets must use the library prescriptions.','prescription');
  }
 }
 for(const meal of plan.meals){
  // Numerical nutrition comes exclusively from the deterministic source-data view.
  if(/\d|\b(?:guaranteed|allergen.free|allergy.free)\b/i.test(meal.name+' '+meal.guidance))invalid('Meal guidance must be qualitative, without nutrition numbers or allergy guarantees.','meal_guidance');
  if(meal.recipeId){const recipe=recipes.find(r=>r.id===meal.recipeId);if(!recipe||!recipeFits(recipe,foods,profile)||meal.name!==recipe.name)invalid('A recipe no longer matches your preferences or source records.','recipe');}
 }
 return plan;
}
export function materialiseDraft(value:unknown,profile:UserProfile,foods:Food[],recipes:Recipe[]):PlanPayload{
 const draft=proposalDraftSchema.parse(value);
 const assumptions:string[]=[];
 if(!profile.goals.length)assumptions.push('General fitness is a starting goal until you choose one in Profile.');
 if(!profile.mealsPerDay)assumptions.push('Meal frequency is a proposed daily template, not a saved preference.');
 if(!profile.experience)assumptions.push('Beginner targets are a starting option; your experience is not saved.');
 if(profile.equipment===null)assumptions.push('Bodyweight only until equipment is confirmed in Profile.');
 if(!profile.trainingDays)assumptions.push('Training days are a proposed option, not assumed availability.');
 if(!profile.sessionMinutes)assumptions.push('Session duration is a proposed estimate, not saved availability.');
 return validatePlanPayload({...draft,primaryGoal:profile.goals[0]??'general_fitness',assumptions:[...new Set([...assumptions,...draft.assumptions])].slice(0,8),days:draft.days.map(day=>({weekday:day.weekday,name:day.name,exercises:day.exerciseIds.map(id=>{const e=exercises.find(e=>e.id===id);if(!e)invalid('The proposal contains an unknown exercise.','exercise');return {exerciseId:id,...prescribe(e,draft.experience)};})}))},profile,foods,recipes);
}
