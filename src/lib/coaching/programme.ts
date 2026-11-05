import {z} from 'zod';
import {exercises} from '../exercises';
import {programmingMetadata,broadPattern} from '../training/programming';
import {isEquipmentCompatible,prescribe} from '../training/service';
import type {Exercise,Experience,Equipment,Muscle} from '../training/types';
import type {UserProfile} from '../profile/schema';
export const programmePolicySchema=z.object({minSessionSets:z.number().int().min(2).max(8),maxSessionSets:z.number().int().min(8).max(32),maxWeeklyMuscleSets:z.number().int().min(12).max(40),patternExposures:z.number().int().min(1).max(3)});
export type ProgrammePolicy=z.infer<typeof programmePolicySchema>;
export function getProgrammePolicy():ProgrammePolicy{return programmePolicySchema.parse({minSessionSets:Number(process.env.PLAN_MIN_SESSION_SETS??6),maxSessionSets:Number(process.env.PLAN_MAX_SESSION_SETS??24),maxWeeklyMuscleSets:Number(process.env.PLAN_MAX_WEEKLY_MUSCLE_SETS??24),patternExposures:Number(process.env.PLAN_PATTERN_EXPOSURES??2)});}
export type ProgrammeContext={goal:UserProfile['goals'][number];minutes:number;trainingDays:number;targetMuscles:Muscle[];excludedExerciseIds:string[];policy?:ProgrammePolicy};
export function progressionFor(goal:ProgrammeContext['goal']){return goal==='strength'?'Keep every repetition controlled with about two repetitions still possible. When every set reaches the top of its range comfortably, add a small amount of resistance next session; never test a maximum by default.':'Start with resistance that leaves two or three controlled repetitions still possible. When all sets reach the top of the range with good technique, increase resistance slightly next time. For bodyweight movements, build controlled repetitions or hold time first; use a compatible progression only when ready.';}
export function programmePrescription(exercise:Exercise,experience:Experience,goal:ProgrammeContext['goal'],equipment:Equipment[],excluded:string[]=[]){
 const metadata=programmingMetadata(exercise),base=prescribe(exercise,experience);
 const sets=goal==='general_fitness'?2:base.sets;
 const reps=goal==='strength'&&metadata.compound&&base.unit==='reps'?'6–8':base.reps;
 const restSeconds=metadata.compound?(goal==='strength'?120:90):metadata.pattern==='core'?45:60;
 const repetitionsInReserve=experience==='beginner'?3:2;
 const rank=['beginner','intermediate','advanced'].indexOf(experience);
 const alternatives=exercises.filter(e=>e.id!==exercise.id&&!excluded.includes(e.id)&&['beginner','intermediate','advanced'].indexOf(e.difficulty)<=rank&&isEquipmentCompatible(e.requiredEquipment,equipment)&&broadPattern(programmingMetadata(e).pattern)===broadPattern(metadata.pattern));
 const preferred=alternatives.find(e=>exercise.alternatives.includes(e.slug))??alternatives.find(e=>e.primaryMuscles.some(m=>exercise.primaryMuscles.includes(m)));
 return {exerciseId:exercise.id,sets,reps,unit:base.unit,restSeconds,repetitionsInReserve,
  cue:exercise.instructions[1]??exercise.instructions[0],reason:`${exercise.primaryMuscles.join(' and ')} work supporting ${goal.replaceAll('_',' ')}; ${metadata.pattern.replaceAll('_',' ')} movement.`,
  progression:exercise.requiredEquipment.includes('dumbbells')||exercise.requiredEquipment.some(e=>e.endsWith('machine'))?'Reach the top of the repetition range across all sets with controlled technique, then add the smallest comfortable resistance increase.':'Build controlled repetitions or hold time within the range first. Keep technique consistent and stop before form breaks down.',substitutionId:preferred?.id??null};
}
export type ProgrammeExercise=ReturnType<typeof programmePrescription>;
export function estimateWorkoutDuration(items:Pick<ProgrammeExercise,'exerciseId'|'sets'|'reps'|'unit'|'restSeconds'>[],warmupMinutes:number){
 let workingSeconds=0,restSeconds=0;
 for(const item of items){const exercise=exercises.find(e=>e.id===item.exerciseId);if(!exercise)throw new Error('Unknown exercise in duration estimate');const high=Math.max(...(item.reps.match(/\d+/g)??[]).map(Number));if(!Number.isFinite(high)||high<=0)throw new Error('Invalid duration prescription');const sides=programmingMetadata(exercise).sides;workingSeconds+=item.sets*high*(item.unit==='seconds'?1:3)*sides;restSeconds+=Math.max(0,item.sets-1)*item.restSeconds;}
 const transitionSeconds=Math.max(0,items.length-1)*60;
 const totalSeconds=warmupMinutes*60+workingSeconds+restSeconds+transitionSeconds;
 return {estimatedMinutes:Math.ceil(totalSeconds/300)*5,workingSeconds,restSeconds,transitionSeconds,warmupMinutes,conditioningSeconds:0};
}
export function enrichWorkout(day:{weekday:number;name:string;exerciseIds:string[]},profile:UserProfile,context:ProgrammeContext,equipment:Equipment[]){
 const ordered=day.exerciseIds.map(id=>{const exercise=exercises.find(e=>e.id===id);if(!exercise)throw new Error('Unknown exercise');return exercise;}).sort((a,b)=>Number(programmingMetadata(b).compound)-Number(programmingMetadata(a).compound));
 const items=ordered.map(e=>programmePrescription(e,profile.experience??'beginner',context.goal,equipment,context.excludedExerciseIds));
 const warmupMinutes=context.minutes<=15?3:5;
 return {weekday:day.weekday,name:day.name,exercises:items,...estimateWorkoutDuration(items,warmupMinutes),
  warmup:'Start with easy movement, then rehearse the first movements without load or with light resistance. Build up gradually; warm-up sets are separate from the working sets.',
  recovery:'Keep the suggested effort manageable. Rest between sets, stop movements that cause pain and allow recovery before repeating hard work for the same muscles.'};
}
export type ProgrammeDay=ReturnType<typeof enrichWorkout>;
export function programmeQuality(days:ProgrammeDay[],candidates:Exercise[],context:ProgrammeContext){
 const policy=context.policy??getProgrammePolicy();const errors:{rule:string;detail:string}[]=[],warnings:string[]=[];
 const exposures=new Map<string,Set<number>>(),weekly=new Map<string,number>();
 for(const day of days){
  const sets=day.exercises.reduce((n,e)=>n+e.sets,0);const min=context.minutes<=15?2:context.minutes<=25?Math.min(4,policy.minSessionSets):policy.minSessionSets;
  if(sets<min||sets>policy.maxSessionSets)errors.push({rule:'volume',detail:`Day ${day.weekday} needs ${min}–${policy.maxSessionSets} working sets for this time budget.`});
  if(day.estimatedMinutes>context.minutes)errors.push({rule:'duration',detail:`Day ${day.weekday} is estimated at ${day.estimatedMinutes} minutes; the maximum is ${context.minutes}. Choose fewer compatible movements.`});
  const families=new Map<string,number>();
  for(const item of day.exercises){const exercise=exercises.find(e=>e.id===item.exerciseId)!;const m=programmingMetadata(exercise);families.set(m.family,(families.get(m.family)??0)+1);const pattern=broadPattern(m.pattern);if(!exposures.has(pattern))exposures.set(pattern,new Set());exposures.get(pattern)!.add(day.weekday);for(const muscle of exercise.primaryMuscles)weekly.set(muscle,(weekly.get(muscle)??0)+item.sets);}
  const maxRelated=context.targetMuscles.length&&context.minutes>=45?3:2;
  if([...families.values()].some(n=>n>maxRelated))errors.push({rule:'similar_movements',detail:`Day ${day.weekday} repeats more than ${maxRelated} closely related movements.`});
 }
 for(const [muscle,sets] of weekly)if(sets>policy.maxWeeklyMuscleSets)errors.push({rule:'volume',detail:`Direct weekly work for ${muscle} exceeds the configured ${policy.maxWeeklyMuscleSets}-set guard.`});
 const fullProgramme=context.targetMuscles.length===0;
 if(fullProgramme&&context.minutes>=20){
  const available=new Set<string>(candidates.map(e=>broadPattern(programmingMetadata(e).pattern)));
  for(const pattern of ['push','pull','knee','hip']){
   if(!available.has(pattern)){warnings.push(`The current library/equipment cannot cover ${pattern} work; ask Kivo about suitable additional options.`);continue;}
   const minimum=context.goal==='muscle_gain'&&days.length>=3&&context.minutes>=30?Math.min(policy.patternExposures,days.length):1;
   if((exposures.get(pattern)?.size??0)<minimum)errors.push({rule:'weekly_balance',detail:`Include available ${pattern} work on at least ${minimum} day(s) across the week.`});
  }
 }
 for(const day of days){const next=days.find(d=>d.weekday===(day.weekday%7)+1);if(!next)continue;const muscles=(d:ProgrammeDay)=>new Set(d.exercises.flatMap(e=>exercises.find(x=>x.id===e.exerciseId)!.primaryMuscles));const shared=[...muscles(day)].filter(m=>muscles(next).has(m));const repeated=day.exercises.filter(e=>exercises.find(x=>x.id===e.exerciseId)!.primaryMuscles.some(m=>shared.includes(m))).reduce((n,e)=>n+e.sets,0);if(repeated>=6)errors.push({rule:'recovery',detail:`Days ${day.weekday} and ${next.weekday} repeat substantial work for the same muscles without a recovery day. Redistribute it.`});}
 if(fullProgramme&&context.minutes<20&&['push','pull','knee','hip'].some(pattern=>!exposures.has(pattern)))warnings.push('These short sessions do not cover every major movement pattern yet. Ask Kivo to rotate movements across days as your time allows.');
 if(days.length===1)warnings.push('One training day is a starting option. Frequency and total work can grow as your availability allows.');
 if(context.targetMuscles.length)warnings.push('This is a focused muscle programme; it does not claim full-body coverage.');
 if(context.goal==='muscle_gain'&&context.minutes<30)warnings.push('Short sessions prioritise a manageable starting dose; add volume gradually if recovery and availability allow.');
 return {errors,warnings,weeklyDirectSets:Object.fromEntries(weekly)};
}
