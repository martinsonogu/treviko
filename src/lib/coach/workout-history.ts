import 'server-only';
import {z} from 'zod';
import type {AuthContext} from '../auth/session';
import {ApiError} from '../api/http';
import {queryCompletedWorkouts,getActiveWorkout,previousWorkouts} from '../workouts/service';
import type {WorkoutSession} from '../workouts/schema';
import {workoutRegion,completedWorkoutSummary,type WorkoutHistorySummary} from '../workouts/history-summary';
import {feedbackSchema} from '../workouts/feedback';
import {containsSecret} from '../persistence/conversations';
import type {WorkoutHistoryRequest} from './workout-history-intent';
import {projectWorkout,compareWorkouts,type WorkoutEvidence} from './workout-evidence';
function day(value:Date,zone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);return ['year','month','day'].map(key=>parts.find(part=>part.type===key)!.value).join('-');}
// Find local calendar boundaries rather than assuming every day is 24 hours.
export function workoutDateWindow(requested:string,zone:string,now=new Date()){
 const today=day(now,zone),offset=requested==='yesterday'?-1:0;
 const key=/^\d{4}-\d{2}-\d{2}$/.test(requested)?requested:new Date(Date.parse(today+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
 if(!Number.isFinite(Date.parse(key+'T00:00:00Z'))||new Date(key+'T00:00:00Z').toISOString().slice(0,10)!==key)throw new ApiError(422,'INVALID_WORKOUT_DATE','Please use a valid workout date.');
 const next=new Date(Date.parse(key+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 const boundary=(target:string)=>{const anchor=Date.parse(target+'T00:00:00Z');let low=anchor-36*3600000,high=anchor+36*3600000;while(high-low>1){const mid=Math.floor((low+high)/2);if(day(new Date(mid),zone)<target)low=mid;else high=mid;}return new Date(high).toISOString();};
 return {from:boundary(key),until:boundary(next)};
}
const normalize=(text:string)=>text.toLowerCase().replaceAll('-',' ').replace(/\s+/g,' ').trim();
function matches(row:WorkoutSession,request:WorkoutHistoryRequest){
 const byExercise=!request.exerciseIds.length&&!request.exerciseText||row.snapshot.exercises.some(item=>request.exerciseIds.includes(item.exerciseId)||Boolean(request.exerciseText&&normalize(item.name).includes(request.exerciseText)));
 if(!byExercise)return false;if(!request.region)return true;
 return workoutRegion(row.snapshot.title)===request.region;
}
function comparable(a:WorkoutSession,b:WorkoutSession){const shared=a.snapshot.exercises.filter(item=>b.snapshot.exercises.some(old=>old.exerciseId===item.exerciseId&&old.unit===item.unit)).length;return shared>0&&(a.plan_id===b.plan_id&&a.weekday===b.weekday||shared>=Math.min(2,a.snapshot.exercises.length,b.snapshot.exercises.length));}
export async function loadWorkoutEvidence(context:AuthContext,conversationId:string,messages:{id?:string;role:string;content:string}[],request:WorkoutHistoryRequest,timeZone:string):Promise<WorkoutEvidence>{
 let selected:WorkoutSession[]=[];let searchLimit=1;let summary:WorkoutHistorySummary|undefined;
 const base:WorkoutEvidence={status:'no_completed',timeZone,request,searchLimit,contextLimited:false,sessions:[],comparisons:[]};
 try{
 if(request.mode==='overview'||request.mode==='comparison'||request.region){
  const range=request.date?workoutDateWindow(request.date,timeZone):{};
  summary=await completedWorkoutSummary(context,{region:request.region,...range,offset:request.mode==='overview'?request.offset:0});
  summary.rows=summary.rows.map(row=>({...row,name:containsSecret(row.name)?'Recorded workout (title omitted)':row.name}));
  if(request.mode==='overview')return {...base,status:summary.matchedCount?'found':summary.totalCompleted?'no_match':'no_completed',summary,searchLimit:30};
 }
 if(request.sessionId){selected=await queryCompletedWorkouts(context,{ids:[request.sessionId],limit:1});if(!selected.length)return {...base,status:'no_match'};
 }else if(request.useReference){
  const messageIds=messages.slice(-10).filter(row=>row.role==='assistant'&&row.id).map(row=>row.id!);
  if(!messageIds.length)return {...base,status:'reference_missing'};
  const reference=await context.db.from('coach_workout_context').select('workout_ids').eq('user_id',context.userId).eq('conversation_id',conversationId).in('message_id',messageIds).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(reference.error)throw reference.error;if(!reference.data)return {...base,status:'reference_missing'};
  const ids=z.array(z.string().uuid()).min(1).max(2).parse(reference.data.workout_ids);
  const rows=await queryCompletedWorkouts(context,{ids,limit:2});selected=ids.flatMap(id=>rows.find(row=>row.id===id)?[rows.find(row=>row.id===id)!]:[]);
  if(selected.length!==ids.length)return {...base,status:'reference_missing'};
  if(request.exerciseIds.length||request.exerciseText)if(!selected.some(row=>matches(row,{...request,region:undefined})))return {...base,status:'no_match'};
 }else{
  const filtered=Boolean(request.region||request.exerciseIds.length||request.exerciseText||request.date);searchLimit=filtered?30:1;
  const range=request.date?workoutDateWindow(request.date,timeZone):{};
  const rows=summary?summary.rows.length?await queryCompletedWorkouts(context,{ids:summary.rows.slice(0,request.compare?2:1).map(row=>row.id),limit:2}):[]:await queryCompletedWorkouts(context,{limit:searchLimit,...range});selected=rows.filter(row=>matches(row,request)).slice(0,request.compare?2:1);
  if(!selected.length){const active=request.completionCheck?await getActiveWorkout(context):null;return {...base,status:filtered?'no_match':'no_completed',summary,searchLimit,active:active?{id:active.id,name:containsSecret(active.snapshot.title)?'Recorded workout (title omitted)':active.snapshot.title,status:'in_progress'}:null};}
 }
 if(request.compare&&selected.length===1){const earlier=await previousWorkouts(context,selected[0]);searchLimit=30;const match=earlier.find(row=>matches(row,request)&&comparable(selected[0],row));if(match)selected.push(match);}
 const feedback=await context.db.from('workout_feedback').select('session_id,effort,created_at').eq('user_id',context.userId).in('session_id',selected.map(row=>row.id));
 const feedbackRows=feedback.error?null:z.array(feedbackSchema).parse(feedback.data??[]);
 let sessions=selected.map(row=>{const found=feedbackRows?.find(item=>item.session_id===row.id);const result=projectWorkout(row,{status:feedbackRows===null?'unavailable':found?'recorded':'not_recorded',value:found?.effort??null});if(containsSecret(result.name))result.name='Recorded workout (title omitted)';return result;});
 let comparisons=compareWorkouts(selected[0],selected[1]),contextLimited=false;
 if(JSON.stringify({sessions,comparisons}).length>18000){sessions=sessions.slice(0,1);comparisons=[];contextLimited=true;}
 if(JSON.stringify({sessions,comparisons}).length>18000)throw new Error('WORKOUT_CONTEXT_TOO_LARGE');
 const active=request.completionCheck?await getActiveWorkout(context):null;
 return {...base,status:'found',summary,searchLimit,contextLimited,sessions,comparisons,active:active?{id:active.id,name:containsSecret(active.snapshot.title)?'Recorded workout (title omitted)':active.snapshot.title,status:'in_progress'}:null};
 }catch(error){if(error instanceof ApiError&&error.code==='INVALID_WORKOUT_DATE')throw error;throw new ApiError(503,'WORKOUT_HISTORY_UNAVAILABLE','Your saved workout history could not be loaded. Please try again; your logs have not changed.');}
}
