import 'server-only';
import type {AuthContext} from '../auth/session';
import {ApiError} from '../api/http';
import {logPlanDiagnostic,planFailure,planStep} from './errors';
import {preferenceFingerprint} from './preferences';
import {includesNutrition,type PlanScope} from './scope';
import type {UserProfile} from '../profile/schema';
import type {Food,Recipe} from '../nutrition/schema';
import {getProfile} from '../profile/service';
import {profileForCoach} from '../profile/personalisation';
import {getCoachConfig} from '../coach/config';
import {preflightScope} from '../coach/scope';
import {safetyMessages} from '../coach/safety';
import {listFoods,listRecipes} from '../nutrition/service';
import {createConversation,getConversation,containsSecret} from '../persistence/conversations';
import {buildCoachHistory} from '../coach/history';
import {acquireSharedRequest,persistentUsageMonitor} from '../persistence/shared-ai';
import {createAdminSupabase} from '../supabase/admin';
import {getActivePlan,getProfileGuard,getPendingProposal,getProposal,storeProposal,publishProposal} from './service';
import {generatePlanProposal} from './generation';
import {validatePlanPayload} from './validation';

export async function proposePlan(context:AuthContext,body:{message:string;conversationId?:string;scope?:PlanScope;goal?:UserProfile['goals'][number]},request:Request){
 if(containsSecret(body))throw new ApiError(400,'CREDENTIALS_REJECTED','Do not submit credentials.');
 const config=await planStep('configuration',()=>getCoachConfig());let release:(()=>Promise<void>)|undefined;let createdConversationId:string|undefined;let proposalReady=false;
 try{
  // Reuse the existing user/global concurrency and admission controls, including for new plans.
  const savedConversation=body.conversationId?await planStep('conversation',()=>getConversation(context,body.conversationId!,10)):null;
  const conversation=savedConversation??await planStep('conversation',()=>createConversation(context,'Personal coaching plan'));
  if(!savedConversation)createdConversationId=conversation.id;
  release=await planStep('admission',()=>acquireSharedRequest(context.userId,conversation.id,config));
  const profileGuard=await planStep('profile',()=>getProfileGuard(context));
  const [profile,existing,pending]=await Promise.all([planStep('profile',()=>getProfile(context)),planStep('active_plan',()=>getActivePlan(context)),planStep('pending_proposal',()=>getPendingProposal(context))]);
  const history=savedConversation?buildCoachHistory(savedConversation.messages,body.message):[];
  const payload=await generatePlanProposal({message:body.message,scope:body.scope,goal:body.goal,profile,existing,proposalUnderReview:pending?.base_version===(existing?.version??0)?pending.payload:undefined,foods:[],recipes:[],loadNutrition:async()=>{const [{foods},recipes]=await Promise.all([listFoods(context),listRecipes(context)]);return {foods,recipes};},history},config,await planStep('admission',()=>persistentUsageMonitor(context.userId,config)),AbortSignal.any([request.signal,AbortSignal.timeout(config.requestTimeoutMs)]));
  const proposal=await planStep('persistence',()=>storeProposal(context,payload,existing?.version??0,preferenceFingerprint(profile),profileGuard));
  proposalReady=true;
  let historySaved=true;
  try{
  const {error}=await createAdminSupabase().rpc('append_coach_turn',{p_user:context.userId,p_conversation:conversation.id,p_message:body.message,p_reply:`Proposed plan (not active): ${payload.rationale}\nReview proposal ${proposal.id} in the plan preview before confirming.`,p_category:'mixed',p_status:'ok',p_mode:'live',p_exercise_ids:[]});
  if(error)throw new ApiError(503,'HISTORY_NOT_SAVED','Conversation update unavailable.');
  }catch(error){historySaved=false;logPlanDiagnostic('history',error,1,'warning');}
  // A valid stored preview can still be reviewed if optional chat synchronisation fails.
  return {proposal,conversationId:conversation.id,historySaved};
 }catch(error){if(error instanceof ApiError)throw error;logPlanDiagnostic('persistence',error);throw planFailure('persistence',error);}
 finally{
  if(release)await release().catch(error=>logPlanDiagnostic('cleanup',error,1,'warning'));
  if(createdConversationId&&!proposalReady){try{const {error}=await context.db.from('coach_conversations').delete().eq('id',createdConversationId).eq('user_id',context.userId);if(error)logPlanDiagnostic('cleanup',new ApiError(503,'EMPTY_CONVERSATION_CLEANUP_FAILED','Cleanup unavailable.'),1,'warning');}catch(error){logPlanDiagnostic('cleanup',error,1,'warning');}}
 }

}
export async function confirmPlan(context:AuthContext,proposalId:string){
 const proposal=await getProposal(context,proposalId);
 if(proposal.status==='confirmed')return publishProposal(context,proposalId);
 if(proposal.status!=='pending'||new Date(proposal.expires_at).getTime()<=Date.now())throw new ApiError(409,'PROPOSAL_UNAVAILABLE','This proposal expired or was cancelled. Request a fresh one.');
 const [profile,[{foods},recipes]]=await Promise.all([getProfile(context),includesNutrition(proposal.payload.scope)?Promise.all([listFoods(context),listRecipes(context)]):Promise.resolve([{foods:[] as Food[]},[] as Recipe[]] as [{foods:Food[]},Recipe[]])]);
 if(preferenceFingerprint(profile)!==proposal.preference_fingerprint)throw new ApiError(409,'PREFERENCES_CHANGED','Your preferences changed. Generate a new proposal with your current restrictions.');
 const risk=preflightScope({message:'Review my training and meal plan.',profile:profileForCoach(profile),history:[]});
 if(risk?.safety&&risk.safety!=='none')throw new ApiError(422,'SAFETY_REVIEW',safetyMessages[risk.safety]);
 validatePlanPayload(proposal.payload,profile,foods,recipes);
 return publishProposal(context,proposalId);
}
