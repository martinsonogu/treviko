import 'server-only';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { requireUser } from '../auth/session';
import { ApiError,apiFailure,readJson } from '../api/http';
import { getProfile } from '../profile/service';
import {getActivePlan} from '../coaching/service';
import { profileForCoach } from '../profile/personalisation';
import { getConversation,containsSecret,uuidSchema } from './conversations';
import { acquireSharedRequest,persistentUsageMonitor } from './shared-ai';
import { createAdminSupabase } from '../supabase/admin';
import { coachRequestSchema,profileSchema } from '../coach/schemas';
import { getCoachConfig } from '../coach/config';
import { createOpenAIProvider } from '../coach/provider';
import { runCoach } from '../coach/service';
import {buildCoachHistory} from '../coach/history';
import { CoachLimitError } from '../coach/limits';
const persistentRequestSchema=z.object({message:z.string().trim().min(1).max(2000),conversationId:uuidSchema,profile:profileSchema.optional()}).strict().refine(value=>!containsSecret(value),'Do not submit credentials');
export async function persistentCoachHandler(request:Request) {
 let release:(()=>Promise<void>)|undefined;
 try {
  const context=await requireUser(request);const body=await readJson(request,persistentRequestSchema);
  const config=getCoachConfig();
  release=await acquireSharedRequest(context.userId,body.conversationId,config);
  const [saved,conversation,activePlan]=await Promise.all([getProfile(context),getConversation(context,body.conversationId,10),getActivePlan(context)]);
  const stored=profileForCoach(saved);
  // Session-only overrides cannot erase saved safety disclosures/allergies.
  const profile={...stored,...body.profile,goals:[...new Set([stored.goals,body.profile?.goals].filter(Boolean))].join('; ').slice(0,500)||undefined,allergies:[...new Set([stored.allergies,body.profile?.allergies].filter(Boolean))].join('; ').slice(0,500)||undefined};
  const history=buildCoachHistory(conversation.messages,body.message);
  const input={...coachRequestSchema.parse({message:body.message,profile,history}),savedPlanContext:activePlan?{version:activePlan.version,goal:activePlan.payload.primaryGoal,trainingGoal:activePlan.payload.trainingGoal,nutritionGoal:activePlan.payload.nutritionGoal,scope:activePlan.payload.scope,training:activePlan.payload.days.map(d=>({weekday:d.weekday,name:d.name,exerciseIds:d.exercises.map(e=>e.exerciseId)})),meals:activePlan.payload.meals.map(m=>({slot:m.slot,name:m.name})),sessionMinutes:activePlan.payload.sessionMinutes}:null};
  const monitor=persistentUsageMonitor(context.userId,config);
  const result=await runCoach(input,config,()=>createOpenAIProvider(config,monitor),AbortSignal.any([request.signal,AbortSignal.timeout(config.requestTimeoutMs)]));
  if(result.httpStatus===200){
   if(containsSecret(result.body.message))throw new ApiError(502,'INVALID_RESPONSE','The response could not be safely saved. Please try again.');
   const {error}=await createAdminSupabase().rpc('append_coach_turn',{p_user:context.userId,p_conversation:body.conversationId,p_message:body.message,p_reply:result.body.message,p_category:result.body.category,p_status:result.body.status,p_mode:result.body.mode,p_exercise_ids:result.body.exerciseIds});
   if(error)throw new ApiError(503,'SAVE_FAILED','The response could not be saved. Reload the conversation before retrying.');
  }
  return NextResponse.json({...result.body,conversationId:body.conversationId,saved:result.httpStatus===200},{status:result.httpStatus,headers:{'Cache-Control':'private, no-store',...(result.retryAfter?{'Retry-After':String(result.retryAfter)}:{})}});
 }catch(error){if(error instanceof CoachLimitError)return NextResponse.json({message:'Coach usage or concurrency limit reached. Try again shortly.',status:'rate_limited',mode:'unavailable',code:error.code},{status:429,headers:{'Retry-After':String(error.retryAfter),'Cache-Control':'private, no-store'}});return apiFailure(error);}
 finally{if(release)await release().catch(()=>{});}
}
