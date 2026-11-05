import type {WorkoutSession} from './schema';
import {workoutDayKey} from './dates';
// Terminal lifecycle status is irreversible. A distinct ID is required for a repeat.
export function resolveActiveWorkout(active:WorkoutSession|null,known:WorkoutSession[]=[]){
 if(!active||active.status!=='in_progress'||active.finished_at!==null)return null;
 if(known.some(row=>row.id===active.id&&(row.status==='completed'||row.status==='discarded')))return null;
 return active;
}
export function trainingSessionState(planId:string,planVersion:number,weekday:number,active:WorkoutSession|null,previous:WorkoutSession|null,timeZone:string|null,now:string){
 const match=(row:WorkoutSession)=>row.plan_id===planId&&row.weekday===weekday;
 const current=resolveActiveWorkout(active,previous?[previous]:[]);
 if(current&&match(current))return 'in_progress' as const;
 if(previous?.status==='completed'&&previous.finished_at&&match(previous))return previous.plan_version===planVersion&&timeZone&&workoutDayKey(previous.finished_at,timeZone)===workoutDayKey(now,timeZone)?'completed_today' as const:'completed_previously' as const;
 return 'not_started' as const;
}
