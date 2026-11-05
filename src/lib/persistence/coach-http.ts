import 'server-only';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { requireUser } from '../auth/session';
import { ApiError,apiFailure,readJson } from '../api/http';
import { getProfile } from '../profile/service';
import {getActivePlan,getProposal} from '../coaching/service';
import { profileForCoach } from '../profile/personalisation';
import { getConversation,containsSecret,uuidSchema } from './conversations';
import { acquireSharedRequest,persistentUsageMonitor } from './shared-ai';
import {appendCoachTurn} from './coach-turn';
import {workoutHistoryRequest} from '../coach/workout-history-intent';
import {loadWorkoutEvidence} from '../coach/workout-history';
import type {CoachInput} from '../coach/schemas';
import { coachRequestSchema,profileSchema,scopeSchema } from '../coach/schemas';
import { getCoachConfig,configurationMessage } from '../coach/config';
import { createOpenAIProvider,ProviderFailure } from '../coach/provider';
import { runCoach } from '../coach/service';
import {buildTaskContext,contextualTaskScope} from '../coach/task-context';
import {planConversationPreferences,profileForPlan,missingPlanInformation,inheritPlanPreferences} from '../coaching/conversation-preferences';
import {formatResponse} from '../coach/format';
import {buildCoachHistory} from '../coach/history';
import {preflightScope,isConversationalGreeting} from '../coach/scope';
import {classifyConversationAction,proposalScopeForIntent,type ConversationIntent} from '../coach/action-intent';
import {proposePlan} from '../coaching/workflow';
import {latestProposalReference} from '../coaching/proposal-reference';
import { CoachLimitError,coachLimitMessage } from '../coach/limits';
const persistentRequestSchema=z.object({message:z.string().trim().min(1).max(2000),conversationId:uuidSchema,profile:profileSchema.optional(),conversationFirst:z.literal(true).optional(),proposalId:uuidSchema.optional()}).strict().refine(value=>!containsSecret(value),'Do not submit credentials');
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
  const input:CoachInput={...coachRequestSchema.parse({message:body.message,profile,history}),savedPlanContext:activePlan?{version:activePlan.version,goal:activePlan.payload.primaryGoal,trainingGoal:activePlan.payload.trainingGoal,nutritionGoal:activePlan.payload.nutritionGoal,scope:activePlan.payload.scope,training:activePlan.payload.days.map(d=>({weekday:d.weekday,name:d.name,exerciseIds:d.exercises.map(e=>e.exerciseId)})),meals:activePlan.payload.meals.map(m=>({slot:m.slot,name:m.name})),sessionMinutes:activePlan.payload.sessionMinutes}:null};
  const monitor=persistentUsageMonitor(context.userId,config);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(config.requestTimeoutMs)]);
  const historySelection=workoutHistoryRequest(body.message,history);
  let routed:ConversationIntent|undefined;let clarification:string|undefined;
  if((body.conversationFirst||historySelection)&&!preflightScope(input)){
   const unavailable=configurationMessage(config);if(unavailable)throw new ApiError(503,'AI_NOT_CONFIGURED',unavailable);
   const reference=body.proposalId??latestProposalReference(conversation.messages);
   let preview=null;
   if(reference){try{preview=await getProposal(context,reference);}catch(error){if(!(error instanceof ApiError&&error.status===404&&!body.proposalId))throw error;}}
   const selectedPreview=preview?.status==='pending'&&new Date(preview.expires_at).getTime()>Date.now()&&preview.base_version===(activePlan?.version??0)?preview:null;
   routed=await classifyConversationAction(input,{activePlan:activePlan?{goal:activePlan.payload.primaryGoal,hasTraining:activePlan.payload.days.length>0,hasNutrition:activePlan.payload.meals.length>0}:null,selectedPreview:selectedPreview?{goal:selectedPreview.payload.primaryGoal,scope:selectedPreview.payload.scope}:null},config,monitor,signal);
   if(historySelection&&['allowed','ambiguous'].includes(routed.outcome)&&routed.safety==='none'&&!routed.injection&&!['unrelated','safety_sensitive'].includes(routed.category))input.workoutEvidence=await loadWorkoutEvidence(context,body.conversationId,conversation.messages,historySelection,saved.timeZone);
   const task=buildTaskContext(input);
   const contextual=contextualTaskScope(input,routed,Boolean(selectedPreview),Boolean(activePlan));
   if(contextual==='review'||(task.acceptance&&preview?.status==='pending'&&new Date(preview.expires_at).getTime()<=Date.now())){
    const review=selectedPreview??preview!;
    const {error}=await appendCoachTurn({p_user:context.userId,p_conversation:body.conversationId,p_message:body.message,p_reply:`Proposed plan (not active): ${review.payload.rationale}\nReview proposal ${review.id} in the plan preview before confirming.`,p_category:'fitness',p_status:'ok',p_mode:'policy',p_exercise_ids:[]},input.workoutEvidence);
    if(error)throw new ApiError(503,'SAVE_FAILED','The review response could not be saved. Reload before retrying.');
    return NextResponse.json({kind:'proposal',proposal:review,conversationId:body.conversationId,historySaved:true},{headers:{'Cache-Control':'private, no-store'}});
   }
   const scope=isConversationalGreeting(input.message)||historySelection&&!historySelection.adjustPlan&&!task.direct?null:task.acceptance&&!contextual?null:contextual??proposalScopeForIntent(routed,Boolean(activePlan||selectedPreview));
   if(task.acceptance&&!contextual)clarification='What would you like me to continue with?';
   if(scope&&body.conversationFirst){
    const conversationPreferences={...inheritPlanPreferences(saved,selectedPreview?.payload.conversationPreferences??activePlan?.payload.conversationPreferences),...planConversationPreferences(task.facts.facts)};
    const effective=profileForPlan(saved,conversationPreferences);
    const missing=scope==='nutrition_only'?null:missingPlanInformation(effective);
    if(missing)clarification=missing==='equipment'?'To build your weekly workout, what equipment do you have available? You can also choose bodyweight only.':'To finish your workout plan, how many days per week can you train?';
    else {
    const goal=task.goal==='muscle gain'?'muscle_gain':task.goal==='strength'?'strength':task.goal==='fat loss'?'fat_loss':undefined;
    const result=await proposePlan(context,{message:body.message,conversationId:body.conversationId,scope,...(selectedPreview?{proposalId:selectedPreview.id}:{})},{signal},{conversationId:body.conversationId,config,conversationPreferences,conversationGoal:goal,workoutEvidence:input.workoutEvidence});
    return NextResponse.json({kind:'proposal',...result},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }
   }
  }
  const result=clarification?{httpStatus:200,body:formatResponse({message:clarification,category:'ambiguous',status:'clarification',mode:'policy'})}:await runCoach(input,config,()=>{const provider=createOpenAIProvider(config,monitor);return routed?{...provider,classify:async()=>scopeSchema.strip().parse(routed)}:provider;},signal);
  if(result.httpStatus===200){
   if(containsSecret(result.body.message))throw new ApiError(502,'INVALID_RESPONSE','The response could not be safely saved. Please try again.');
   const {error}=await appendCoachTurn({p_user:context.userId,p_conversation:body.conversationId,p_message:body.message,p_reply:result.body.message,p_category:result.body.category,p_status:result.body.status,p_mode:result.body.mode,p_exercise_ids:result.body.exerciseIds},input.workoutEvidence);
   if(error)throw new ApiError(503,'SAVE_FAILED','The response could not be saved. Reload the conversation before retrying.');
  }
  return NextResponse.json({...result.body,conversationId:body.conversationId,saved:result.httpStatus===200},{status:result.httpStatus,headers:{'Cache-Control':'private, no-store',...(result.retryAfter?{'Retry-After':String(result.retryAfter)}:{})}});
 }catch(error){if(error instanceof ProviderFailure)return apiFailure(new ApiError(error.code==='PROVIDER_TIMEOUT'?504:502,error.code,error.code==='PROVIDER_TIMEOUT'?'Kivo took too long to respond. Your saved plan was not changed.':'Kivo could not validate the next action. Please try again.'));if(error instanceof CoachLimitError)return NextResponse.json({message:coachLimitMessage(error),status:'rate_limited',mode:'unavailable',code:error.code},{status:429,headers:{'Retry-After':String(error.retryAfter),'Cache-Control':'private, no-store'}});return apiFailure(error);}
 finally{if(release)await release().catch(()=>{});}
}
