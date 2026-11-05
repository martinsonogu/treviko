import {profileForPlan} from './conversation-preferences';
import {exercises} from '../exercises';
import {experienceLevels} from '../training/types';
import {isEquipmentCompatible,prescribe} from '../training/service';
import type {UserProfile} from '../profile/schema';
import {recipeFits} from '../nutrition/service';
import type {Food,Recipe} from '../nutrition/schema';
import {containsSecret} from '../persistence/conversations';
import {ApiError} from '../api/http';
import {includesTraining,includesNutrition,type PlanScope} from './scope';
import {enrichWorkout,estimateWorkoutDuration,programmePrescription,programmeQuality,progressionFor,getProgrammePolicy,type ProgrammeContext,type ProgrammeDay} from './programme';
import {planPayloadSchema,proposalDraftSchema,type PlanPayload} from './schema';
export function planCandidates(profile:UserProfile){
 const experience=profile.experience??'beginner',equipment=profile.equipment??[];
 return exercises.filter(e=>experienceLevels.indexOf(e.difficulty)<=experienceLevels.indexOf(experience)&&isEquipmentCompatible(e.requiredEquipment,equipment));
}
export class PlanValidationError extends ApiError{constructor(message:string,public rule:'nutrition_numbers'|'credentials'|'experience'|'equipment'|'duplicate_options'|'duration'|'duplicate_exercises'|'exercise'|'prescription'|'meal_guidance'|'recipe'|'scope'|'volume'|'weekly_balance'|'similar_movements'|'recovery'|'progression'){super(422,'INVALID_PROPOSAL',message);}}
function invalid(message:string,rule:PlanValidationError['rule']):never{throw new PlanValidationError(message,rule);}
export function validatePlanPayload(value:unknown,profile:UserProfile,foods:Food[],recipes:Recipe[]):PlanPayload{
 const plan=planPayloadSchema.parse(value);
 profile=profileForPlan(profile,plan.conversationPreferences);
 if((includesTraining(plan.scope)&&!plan.days.length)||(!includesTraining(plan.scope)&&plan.days.length)||(includesNutrition(plan.scope)&&!plan.meals.length)||(!includesNutrition(plan.scope)&&plan.meals.length))invalid('The proposal must contain only the requested training or nutrition components.','scope');
 if(/\b\d+(?:[.,]\d+)?\s*(?:kcal|calories?|kilocalories?|grams?\s+(?:of\s+)?(?:protein|fat|carb)|g\s+(?:protein|fat|carb))\b|[£$€]\s*\d/i.test(JSON.stringify(plan)))invalid('Numerical nutrition and grocery price claims are unavailable in AI proposals.','nutrition_numbers');
 if(containsSecret(plan))invalid('The proposal contains text that cannot be saved.','credentials');
 if(plan.conversationPreferences?.trainingDays&&profile.trainingDays!==null&&plan.days.length>profile.trainingDays)invalid('The proposal exceeds the training days confirmed for this plan.','weekly_balance');
 if(plan.experience!==(profile.experience??'beginner'))invalid('Experience changed. Update your profile and request a new proposal.','experience');
 if(!isEquipmentCompatible(plan.equipment,profile.equipment??[]))invalid('The proposal assumes equipment that is not confirmed in your profile.','equipment');
 if(new Set(plan.equipment).size!==plan.equipment.length||new Set(plan.days.map(d=>d.weekday)).size!==plan.days.length||new Set(plan.meals.map(m=>m.slot)).size!==plan.meals.length)invalid('The proposal contains duplicate days, equipment or meal slots.','duplicate_options');
 const candidates=planCandidates(profile).filter(e=>!plan.excludedExerciseIds?.includes(e.id));
 if(plan.schemaVersion===2&&includesTraining(plan.scope)){if(plan.sessionMinutes>(profile.sessionMinutes??30))invalid('Training exceeds your confirmed maximum session time.','duration');if(!plan.progression?.trim())invalid('A weekly progression approach is required.','progression');}
 for(const day of plan.days){
  if(plan.schemaVersion===1&&day.exercises.length>Math.max(1,Math.min(6,Math.floor(plan.sessionMinutes/5))))invalid('Too many exercises for the proposed session duration.','duration');
  if(new Set(day.exercises.map(e=>e.exerciseId)).size!==day.exercises.length)invalid('A workout contains duplicate exercises.','duplicate_exercises');
  for(const item of day.exercises){
   const exercise=candidates.find(e=>e.id===item.exerciseId);
   if(!exercise||!isEquipmentCompatible(exercise.requiredEquipment,plan.equipment))invalid('An exercise is unknown or incompatible with your equipment and experience.','exercise');
   if(plan.schemaVersion===2){const prescription=programmePrescription(exercise,plan.experience,plan.primaryGoal,plan.equipment,plan.excludedExerciseIds);if(Object.entries(prescription).some(([key,value])=>JSON.stringify(item[key as keyof typeof item])!==JSON.stringify(value)))invalid('Each movement needs its complete verified prescription, cue, effort and progression.','prescription');continue;}
   const prescription=prescribe(exercise,plan.experience);
   if(item.sets!==prescription.sets||item.reps!==prescription.reps||item.unit!==prescription.unit)invalid('Exercise targets must use the library prescriptions.','prescription');
  }
 }
 if(plan.schemaVersion===2&&includesTraining(plan.scope)){
  const context={goal:plan.primaryGoal,minutes:plan.sessionMinutes,trainingDays:plan.days.length,targetMuscles:plan.targetMuscles??[],excludedExerciseIds:plan.excludedExerciseIds??[],policy:getProgrammePolicy()};
  for(const day of plan.days){
   if(!day.warmup||!day.recovery||day.warmupMinutes===undefined||day.exercises.some(e=>e.restSeconds===undefined))invalid('Warm-up, recovery and rest guidance are required.','prescription');
   const timing=estimateWorkoutDuration(day.exercises as ProgrammeDay['exercises'],day.warmupMinutes);
   if(Object.entries(timing).some(([key,value])=>day[key as keyof typeof day]!==value))invalid('Workout timing must match the deterministic estimate.','duration');
  }
  const quality=programmeQuality(plan.days as ProgrammeDay[],candidates,context);
  if(quality.errors.length){const first=quality.errors[0];invalid(first.detail,first.rule as PlanValidationError['rule']);}
 }
 if(plan.schemaVersion===2&&new Set(plan.meals.map(m=>m.name.toLowerCase().trim())).size!==plan.meals.length)invalid('Choose varied meals rather than repeating the same meal in multiple slots.','recipe');
 const recipeChoices=plan.meals.flatMap(m=>m.recipeId?[m.recipeId]:[]);
 if(plan.schemaVersion===2&&new Set(recipeChoices).size!==recipeChoices.length)invalid('Use different recipe options across meal slots to offer variety.','recipe');
 for(const meal of plan.meals){
  // Numerical nutrition comes exclusively from the deterministic source-data view.
  if(/\d|\b(?:guaranteed|allergen.free|allergy.free)\b/i.test(meal.name+' '+meal.guidance))invalid('Meal guidance must be qualitative, without nutrition numbers or allergy guarantees.','meal_guidance');
  if(meal.recipeId){const recipe=recipes.find(r=>r.id===meal.recipeId);if(!recipe||!recipeFits(recipe,foods,profile)||meal.name!==recipe.name)invalid('A recipe no longer matches your preferences or source records.','recipe');}
 }
 return plan;
}
export type ProgrammeRequest=ProgrammeContext&{scope:PlanScope;goalSource:'request'|'profile'|'active_plan'|'default';daysExplicit?:boolean;minutesExplicit?:boolean;notes?:string[]};
export function materialiseDraft(value:unknown,profile:UserProfile,foods:Food[],recipes:Recipe[],request?:ProgrammeRequest):PlanPayload{
 const draft=proposalDraftSchema.parse(value);
 const assumptions:string[]=[];
 const training=!request||includesTraining(request.scope),nutrition=!request||includesNutrition(request.scope);
 if(!profile.goals.length&&(!request||request.goalSource==='default'))assumptions.push('General fitness is a starting goal until you choose one in Profile.');
 if(nutrition&&!profile.mealsPerDay)assumptions.push('Meal frequency is a proposed daily template, not a saved preference.');
 if(training&&!profile.experience)assumptions.push('Beginner targets are a starting option; your experience is not saved.');
 if(training&&profile.equipment===null)assumptions.push('Bodyweight only until equipment is confirmed in Profile.');
 if(training&&!profile.trainingDays&&!request?.daysExplicit)assumptions.push('Training days are a proposed option, not assumed availability.');
 if(training&&!profile.sessionMinutes&&!request?.minutesExplicit)assumptions.push('A thirty-minute time ceiling is a starting option, not saved availability.');
 if(request){
  if(training&&draft.days.length!==request.trainingDays)invalid(`Use ${request.trainingDays} training days for the requested availability.`,'weekly_balance');
  if(training&&draft.days.some(d=>d.exerciseIds.some(id=>!exercises.some(e=>e.id===id))))invalid('The proposal contains an unknown exercise.','exercise');
  assumptions.push(...(request.notes??[]));
  const days=training?draft.days.map(day=>enrichWorkout(day,profile,request,draft.equipment)):[];
  const quality=training?programmeQuality(days,planCandidates(profile).filter(e=>!request.excludedExerciseIds.includes(e.id)),request):{warnings:[]};
  return validatePlanPayload({...draft,schemaVersion:2,scope:request.scope,trainingRationale:training?draft.rationale:undefined,nutritionRationale:nutrition?draft.rationale:undefined,primaryGoal:request.goal,savedProfileGoal:profile.goals[0]??null,goalSource:request.goalSource,trainingGoal:training?request.goal:null,nutritionGoal:nutrition?request.goal:null,sessionMinutes:request.minutes,targetMuscles:request.targetMuscles,excludedExerciseIds:request.excludedExerciseIds,progression:training?progressionFor(request.goal):undefined,qualityWarnings:quality.warnings,assumptions:[...new Set([...assumptions,...draft.assumptions])].slice(0,8),days},profile,foods,recipes);
 }
 return validatePlanPayload({...draft,primaryGoal:profile.goals[0]??'general_fitness',assumptions:[...new Set([...assumptions,...draft.assumptions])].slice(0,8),days:draft.days.map(day=>({weekday:day.weekday,name:day.name,exercises:day.exerciseIds.map(id=>{const e=exercises.find(e=>e.id===id);if(!e)invalid('The proposal contains an unknown exercise.','exercise');return {exerciseId:id,...prescribe(e,draft.experience)};})}))},profile,foods,recipes);
}
