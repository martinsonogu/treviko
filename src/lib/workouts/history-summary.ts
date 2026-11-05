import 'server-only';
import {z} from 'zod';
import type {AuthContext} from '../auth/session';
import {ApiError} from '../api/http';
export const workoutRegions=['upper','lower','full','unknown'] as const;
export type WorkoutRegion=typeof workoutRegions[number];
// Only explicit saved session labels establish a region. Never guess from movement names.
export function workoutRegion(title:string):WorkoutRegion{
 const text=title.trim().toLowerCase().replace(/[- ]+/g,' ');
 if(/^upper(?: body)?(?: [ab]| [0-9]+)?$/.test(text))return 'upper';
 if(/^lower(?: body)?(?: [ab]| [0-9]+)?$/.test(text))return 'lower';
 if(/^full ?body(?: [ab]| [0-9]+)?$/.test(text))return 'full';
 return 'unknown';
}
const nonnegative=z.number().int().nonnegative();
export const historySummarySchema=z.object({totalCompleted:nonnegative,matchedCount:nonnegative,countsByRegion:z.object({upper:nonnegative,lower:nonnegative,full:nonnegative,unknown:nonnegative}),offset:nonnegative,limit:z.literal(30),hasMore:z.boolean(),rows:z.array(z.object({id:z.string().uuid(),name:z.string().max(100),completedAt:z.string(),planId:z.string().uuid(),weekday:z.number().int().min(1).max(7),region:z.enum(workoutRegions)})).max(30)});
export type WorkoutHistorySummary=z.infer<typeof historySummarySchema>;
export async function completedWorkoutSummary(context:AuthContext,options:{region?:WorkoutRegion;from?:string;until?:string;offset?:number}={}){
 const offset=z.number().int().min(0).max(1000000).parse(options.offset??0);
 const {data,error}=await context.db.rpc('completed_workout_history',{p_region:options.region?z.enum(workoutRegions).parse(options.region):null,p_from:options.from?z.iso.datetime().parse(options.from):null,p_until:options.until?z.iso.datetime().parse(options.until):null,p_offset:offset});
 if(error)throw new ApiError(503,'WORKOUT_HISTORY_UNAVAILABLE','Your saved workout history could not be checked. Please try again; your logs have not changed.');
 return historySummarySchema.parse(data);
}
