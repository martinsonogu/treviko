import 'server-only';
import {z} from 'zod';
import {safeValidationIssues as validationIssues} from '../coach/diagnostics';
export {safeValidationIssues as validationIssues} from '../coach/diagnostics';
import {ApiError} from '../api/http';
import {ProviderFailure} from '../coach/provider';
import {CoachLimitError} from '../coach/limits';
export type PlanStage='request'|'configuration'|'conversation'|'admission'|'profile'|'active_plan'|'nutrition'|'pending_proposal'|'input'|'scope'|'draft'|'validation'|'review'|'persistence'|'history'|'cleanup';
export function logPlanDiagnostic(stage:PlanStage,error:unknown,attempt=1,outcome:'failed'|'repairing'|'warning'='failed'){
 const category=error instanceof ApiError||error instanceof ProviderFailure||error instanceof CoachLimitError?error.code:error instanceof z.ZodError?'SCHEMA_INVALID':'UNEXPECTED_ERROR';
 // No raw error messages, values, IDs, prompts, model text, profiles or credentials.
 console.warn(JSON.stringify({event:'coaching_plan',stage,outcome,attempt,category,...(error instanceof ProviderFailure?error.diagnostic:{}),...(error instanceof z.ZodError?{issues:validationIssues(error)}:{})}));
}
export function planFailure(stage:PlanStage,error:unknown):ApiError{
 if(error instanceof ApiError)return error;
 if(error instanceof CoachLimitError)return new ApiError(429,error.code,'Coach usage or concurrency limit reached. Try again shortly.');
 if(error instanceof ProviderFailure){
  switch(error.code){
   case 'PROVIDER_TIMEOUT':return new ApiError(504,'PLAN_PROVIDER_TIMEOUT','The AI service timed out while preparing your plan. Your saved plan was not changed. Please try again.');
   case 'OUTPUT_TRUNCATED':return new ApiError(502,'PLAN_OUTPUT_TRUNCATED','The AI response ended before the plan was complete. Try a shorter plan request. Your saved plan was not changed.');
   case 'PROVIDER_CONFIGURATION':return new ApiError(503,'PLAN_PROVIDER_CONFIGURATION','The AI service rejected the model or output settings. Check the server configuration before retrying.');
   case 'PROVIDER_AUTH':return new ApiError(503,'PLAN_PROVIDER_AUTH','The AI service could not authenticate the server. Check the server API configuration.');
   case 'PROVIDER_RATE_LIMITED':return new ApiError(429,'PLAN_PROVIDER_RATE_LIMITED','The AI service is busy or its usage quota is reached. Try again later.');
   case 'PROVIDER_REFUSAL':return new ApiError(422,'PLAN_PROVIDER_REFUSAL','The AI service could not safely propose this plan. Try a general training and meal request or discuss individual needs with a qualified professional.');
   case 'INVALID_OUTPUT':return new ApiError(502,'PLAN_OUTPUT_INVALID',`The AI returned an invalid ${stage==='review'?'plan review':'plan response'}. No new plan was saved. Please try again.`);
   default:return new ApiError(502,'PLAN_PROVIDER_UNAVAILABLE','The AI service could not complete the request. Your saved plan was not changed. Please try again later.');
  }
 }
 if(error instanceof z.ZodError){
  if(stage==='configuration'||stage==='admission')return new ApiError(503,'PLAN_CONFIGURATION_INVALID','AI generation or usage settings are invalid. Check the server configuration.');
  if(stage==='draft'||stage==='validation'||stage==='review')return new ApiError(502,'PLAN_OUTPUT_INVALID','The generated proposal did not match the plan format. No new plan was saved. Please try again.');
  if(stage==='request')return new ApiError(400,'INVALID_INPUT','Check the supplied fields and try again.');
  return new ApiError(503,'PLAN_CONTEXT_INVALID','Saved coaching or reference data could not be validated. Reload your preferences and try again.');
 }
 return new ApiError(503,stage==='persistence'?'PROPOSAL_NOT_SAVED':'PLAN_CONTEXT_UNAVAILABLE',stage==='persistence'?'Your proposal could not be stored. Reload the workspace before retrying.':'Your coaching context could not be loaded. Please reload and try again.');
}
export async function planStep<T>(stage:PlanStage,work:()=>Promise<T>|T){try{return await work();}catch(error){logPlanDiagnostic(stage,error);throw planFailure(stage,error);}}
