import 'server-only';
import {resolveActiveWorkout} from './training-state';
import {supportsExternalLoad} from './measurement';
import {z} from 'zod';
import type {AuthContext} from '../auth/session';
import {ApiError} from '../api/http';
import {getActivePlan} from '../coaching/service';
import {exercises} from '../exercises';
import {createAdminSupabase} from '../supabase/admin';
import {startSchema,updateSchema,sessionSchema,snapshotSchema,emptyPerformance,type WorkoutSession} from './schema';
const columns='id,plan_id,plan_version,weekday,status,snapshot,performance,load_unit,version,started_at,updated_at,finished_at';
function databaseError(error:{message:string}|null){
 if(!error)return;
 if(/VERSION_CONFLICT/.test(error.message))throw new ApiError(409,'VERSION_CONFLICT','This workout or plan changed. Reload saved data before continuing; your local edits have not been applied.');
 if(/WORKOUT_CLOSED/.test(error.message))throw new ApiError(409,'WORKOUT_CLOSED','This workout is already finished or discarded. Reload its saved details.');
 if(/NOT_FOUND/.test(error.message))throw new ApiError(404,'NOT_FOUND','Workout or active plan not found.');
 throw new ApiError(503,'WORKOUT_NOT_SAVED','The workout save could not be confirmed. Keep your edits and retry, or reload saved data.');
}
export async function getWorkout(context:AuthContext,id:string){z.string().uuid().parse(id);const {data,error}=await context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('id',id).maybeSingle();databaseError(error);if(!data)throw new ApiError(404,'NOT_FOUND','Workout not found.');return sessionSchema.parse(data);}
export async function listWorkouts(context:AuthContext,cursor?:{before:string;beforeId:string}){
 let query=context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('status','completed').order('finished_at',{ascending:false}).order('id',{ascending:false}).limit(31);
 if(cursor){const before=z.iso.datetime({offset:true}).parse(cursor.before);const id=z.string().uuid().parse(cursor.beforeId);query=query.or(`finished_at.lt.${before},and(finished_at.eq.${before},id.lt.${id})`);}
 const [recent,active,total]=await Promise.all([query,
 context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('status','in_progress').maybeSingle(),
 context.db.from('workout_sessions').select('id',{count:'exact',head:true}).eq('user_id',context.userId).eq('status','completed')]);
 for(const result of [recent,active,total])databaseError(result.error);
 const rows=z.array(sessionSchema).parse(recent.data??[]);const last=rows[29];return {recent:rows.slice(0,30),next:rows.length>30&&last?{before:last.finished_at!,beforeId:last.id}:null,active:resolveActiveWorkout(active.data?sessionSchema.parse(active.data):null,rows),completedCount:total.count??0};
}
export function snapshotDay(plan:NonNullable<Awaited<ReturnType<typeof getActivePlan>>>,weekday:number){
 const day=plan.payload.days.find(day=>day.weekday===weekday);if(!day)throw new ApiError(422,'SESSION_UNAVAILABLE','Choose a session from your active training plan.');
 return snapshotSchema.parse({title:day.name,weekday,warmup:day.warmup,recovery:day.recovery,exercises:day.exercises.map(item=>{
 const exercise=exercises.find(exercise=>exercise.id===item.exerciseId);if(!exercise)throw new ApiError(422,'EXERCISE_UNAVAILABLE','A prescribed exercise is unavailable. Review your plan with Kivo.');
 return {exerciseId:exercise.id,name:exercise.name,slug:exercise.slug,sets:item.sets,reps:item.reps,unit:item.unit,restSeconds:item.restSeconds,cue:item.cue,reason:item.reason,repetitionsInReserve:item.repetitionsInReserve,progression:item.progression,instructions:exercise.instructions,bodyweight:exercise.requiredEquipment.length===0,loadApplicable:supportsExternalLoad(exercise)};})});
}
export async function startWorkout(context:AuthContext,input:unknown){
 const body=startSchema.parse(input);
 // Return an already-persisted retry/unfinished workout before consulting a possibly revised plan.
 const existing=await context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('start_key',body.startKey).maybeSingle();databaseError(existing.error);if(existing.data)return sessionSchema.parse(existing.data);
 const active=await context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('status','in_progress').maybeSingle();databaseError(active.error);if(active.data)return sessionSchema.parse(active.data);
 const plan=await getActivePlan(context);if(!plan||plan.status!=='active'||plan.id!==body.planId)throw new ApiError(422,'NO_ACTIVE_PLAN','Save an active training plan before starting a workout.');if(plan.version!==body.planVersion)throw new ApiError(409,'VERSION_CONFLICT','Your plan changed. Reload Training before starting.');
 const snapshot=snapshotDay(plan,body.weekday);
 const profile=await context.db.from('profiles').select('units').eq('user_id',context.userId).single();databaseError(profile.error);if(!profile.data)throw new ApiError(503,'PROFILE_UNAVAILABLE','Your units could not load. Retry before starting.');
 const {data,error}=await createAdminSupabase().rpc('start_workout_session',{p_user:context.userId,p_plan:plan.id,p_plan_version:plan.version,p_weekday:body.weekday,p_key:body.startKey,p_snapshot:snapshot,p_performance:emptyPerformance(snapshot),p_unit:profile.data.units==='imperial'?'lb':'kg'});databaseError(error);return sessionSchema.parse(data);
}
export async function updateWorkout(context:AuthContext,id:string,input:unknown){
 z.string().uuid().parse(id);const body=updateSchema.parse(input);const current=await getWorkout(context,id);
 if(body.performance.exercises.length!==current.snapshot.exercises.length)throw new ApiError(400,'INVALID_INPUT','Keep the prescribed exercise order.');
 const {data,error}=await createAdminSupabase().rpc('update_workout_session',{p_user:context.userId,p_session:id,p_version:body.version,p_operation:body.operationId,p_action:body.action,p_performance:body.performance});databaseError(error);return sessionSchema.parse(data);
}
export async function previousWorkouts(context:AuthContext,current:WorkoutSession){
 const {data,error}=await context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('status','completed').lt('finished_at',current.started_at).order('finished_at',{ascending:false}).limit(30);databaseError(error);return z.array(sessionSchema).parse(data??[]);
}
// Query each scheduled slot, not just the latest history page: old completions remain visible.
export async function trainingCompletions(context:AuthContext,plan:{id:string;payload:{days:{weekday:number}[]}}|null){
 if(!plan)return {} as Record<number,WorkoutSession>;
 const pairs=await Promise.all(plan.payload.days.map(async day=>{const {data,error}=await context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('plan_id',plan.id).eq('weekday',day.weekday).eq('status','completed').order('finished_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();databaseError(error);return [day.weekday,data?sessionSchema.parse(data):null] as const;}));
 return Object.fromEntries(pairs.filter((pair):pair is readonly [number,WorkoutSession]=>pair[1]!==null));
}
// Deterministic, owner-scoped completed-history reads used by Coach; no model-authored query.
export async function queryCompletedWorkouts(context:AuthContext,options:{limit:number;ids?:string[];from?:string;until?:string;before?:string}){
 const limit=z.number().int().min(1).max(30).parse(options.limit);
 let query=context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('status','completed').order('finished_at',{ascending:false}).order('id',{ascending:false}).limit(limit);
 if(options.ids)query=query.in('id',z.array(z.string().uuid()).min(1).max(2).parse(options.ids));
 if(options.from)query=query.gte('finished_at',z.iso.datetime().parse(options.from));
 if(options.until)query=query.lt('finished_at',z.iso.datetime().parse(options.until));
 if(options.before)query=query.lt('finished_at',z.iso.datetime({offset:true}).parse(options.before));
 const {data,error}=await query;if(error)throw new ApiError(503,'WORKOUT_HISTORY_UNAVAILABLE','Your saved workouts could not be loaded. Please try again; your logs have not changed.');return z.array(sessionSchema).parse(data??[]);
}
export async function getActiveWorkout(context:AuthContext){const {data,error}=await context.db.from('workout_sessions').select(columns).eq('user_id',context.userId).eq('status','in_progress').maybeSingle();if(error)throw new ApiError(503,'WORKOUT_HISTORY_UNAVAILABLE','Your current workout could not be checked. Please try again.');return data?sessionSchema.parse(data):null;}
