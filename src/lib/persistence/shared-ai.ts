import 'server-only';
import { z } from 'zod';
import { createAdminSupabase } from '../supabase/admin';
import { ApiError } from '../api/http';
import { CoachLimitError } from '../coach/limits';
import type { CoachConfig } from '../coach/config';
import type { ProviderUsage,UsageStage,UsageMonitor } from '../coach/usage';
function check(error:{message:string}|null){if(!error)return;if(/RATE_LIMITED|BUSY|TOKEN_BUDGET|COST_BUDGET/.test(error.message))throw new CoachLimitError(/BUSY/.test(error.message)?'BUSY':'TOKEN_BUDGET',60);if(/NOT_FOUND/.test(error.message))throw new ApiError(404,'NOT_FOUND','Conversation not found.');throw new ApiError(503,'SHARED_CONTROLS_UNAVAILABLE','Shared AI access controls are unavailable. Check server configuration and migrations.');}
function budgets(){const positive=z.coerce.number().positive();return {globalTokens:z.coerce.number().int().min(1000).max(100000000).default(1000000).parse(process.env.COACH_GLOBAL_DAILY_TOKEN_LIMIT||undefined),dailyCost:process.env.COACH_DAILY_COST_USD?positive.parse(process.env.COACH_DAILY_COST_USD):null,globalCost:process.env.COACH_GLOBAL_DAILY_COST_USD?positive.parse(process.env.COACH_GLOBAL_DAILY_COST_USD):null};}
export async function acquireSharedRequest(userId:string,conversationId:string,config:CoachConfig) {
 const admin=createAdminSupabase();const {data,error}=await admin.rpc('acquire_coach_request',{p_user:userId,p_conversation:conversationId,p_user_rpm:config.requestsPerMinute,p_global_rpm:config.globalRequestsPerMinute,p_concurrency:config.maxConcurrent,p_ttl:Math.ceil(config.requestTimeoutMs/1000)+30});check(error);const lease=z.string().uuid().parse(data);
 return async()=>{const {error}=await admin.rpc('release_coach_request',{p_lease:lease,p_user:userId});check(error);};
}
export function persistentUsageMonitor(userId:string,config:CoachConfig):UsageMonitor {
 const admin=createAdminSupabase();const limits=budgets();
 if((limits.dailyCost!==null||limits.globalCost!==null)&&(config.inputPricePerMillion===undefined||config.outputPricePerMillion===undefined))throw new ApiError(503,'PRICING_REQUIRED','Configure model input/output prices before enabling USD usage budgets.');
 return {async reserve(tokens,limit,context){
  if(!context)throw new Error('Usage context missing');
  const {data,error}=await admin.rpc('reserve_ai_usage',{p_user:userId,p_stage:context.stage,p_model:context.model,p_input:tokens-context.maxOutput,p_output:context.maxOutput,p_daily_tokens:limit,p_global_tokens:limits.globalTokens,p_input_price:config.inputPricePerMillion??null,p_output_price:config.outputPricePerMillion??null,p_daily_cost:limits.dailyCost,p_global_cost:limits.globalCost});check(error);const event=z.string().uuid().parse(data);
  return async(_stage:UsageStage,_model:string,success:boolean,usage:ProviderUsage|null)=>{const {error}=await admin.rpc('settle_ai_usage',{p_event:event,p_user:userId,p_success:success,p_input:usage?.inputTokens??null,p_output:usage?.outputTokens??null});check(error);};
 }};
}
