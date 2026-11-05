import 'server-only';
import {z} from 'zod';
import type {AuthContext} from '../auth/session';
import {ApiError} from '../api/http';
import {createAdminSupabase} from '../supabase/admin';
import {planPayloadSchema,proposalRowSchema,type ActivePlan,type PlanPayload} from './schema';
export async function getActivePlan(context:AuthContext):Promise<ActivePlan|null>{
 const {data,error}=await context.db.from('coaching_plans').select('id,preference_fingerprint,training_preference_fingerprint,nutrition_preference_fingerprint,version,status,created_at,updated_at,nutrition_plan_references(meal_plan_id)').eq('user_id',context.userId).maybeSingle();
 if(error)throw new ApiError(503,'PLAN_UNAVAILABLE','Your coaching plan could not load. Apply the coaching-plan migration and retry.');
 if(!data)return null;
 const revision=await context.db.from('plan_revisions').select('snapshot').eq('plan_id',data.id).eq('version',data.version).single();
 if(revision.error)throw new ApiError(503,'PLAN_UNAVAILABLE','Your saved plan revision could not load.');
 const header=z.object({id:z.string().uuid(),preference_fingerprint:z.string(),training_preference_fingerprint:z.string().nullable().optional(),nutrition_preference_fingerprint:z.string().nullable().optional(),version:z.number().int().positive(),status:z.enum(['active','paused']),created_at:z.string(),updated_at:z.string(),nutrition_plan_references:z.union([z.array(z.object({meal_plan_id:z.string().uuid().nullable()})),z.object({meal_plan_id:z.string().uuid().nullable()}).nullable()]).transform(value=>Array.isArray(value)?value:value?[value]:[])}).parse(data);
 return {id:header.id,preferenceFingerprint:header.preference_fingerprint,trainingPreferenceFingerprint:header.training_preference_fingerprint,nutritionPreferenceFingerprint:header.nutrition_preference_fingerprint,version:header.version,status:header.status,createdAt:header.created_at,updatedAt:header.updated_at,payload:planPayloadSchema.parse(revision.data.snapshot),mealPlanId:header.nutrition_plan_references[0]?.meal_plan_id??null};
}
export async function getProposal(context:AuthContext,id:string){
 z.string().uuid().parse(id);const {data,error}=await context.db.from('plan_proposals').select('id,base_version,preference_fingerprint,payload,status,created_at,expires_at').eq('user_id',context.userId).eq('id',id).maybeSingle();
 if(error)throw new ApiError(503,'PROPOSAL_UNAVAILABLE','The proposal could not load.');
 if(!data)throw new ApiError(404,'NOT_FOUND','Proposal not found.');return proposalRowSchema.parse(data);
}
export async function storeProposal(context:AuthContext,payload:PlanPayload,baseVersion:number,fingerprint:string,profileGuard:unknown){
 const {data,error}=await createAdminSupabase().from('plan_proposals').insert({user_id:context.userId,base_version:baseVersion,preference_fingerprint:fingerprint,profile_guard:profileGuard,payload:planPayloadSchema.parse(payload)}).select('id,base_version,preference_fingerprint,payload,status,created_at,expires_at').single();
 if(error)throw new ApiError(503,'PROPOSAL_NOT_SAVED','The proposal could not be saved. Try again.');return proposalRowSchema.parse(data);
}
export async function cancelProposal(context:AuthContext,id:string){
 const proposal=await getProposal(context,id);
 if(proposal.status!=='pending')throw new ApiError(409,'PROPOSAL_UNAVAILABLE','Only a pending proposal can be cancelled.');
 const {data,error}=await createAdminSupabase().from('plan_proposals').update({status:'cancelled'}).eq('id',id).eq('user_id',context.userId).eq('status','pending').select('id');
 if(error)throw new ApiError(503,'CANCEL_FAILED','Could not cancel the proposal.');if(!data?.length)throw new ApiError(409,'PROPOSAL_UNAVAILABLE','This proposal changed in another tab. Reload to see its current status.');return {cancelled:true};
}
export async function publishProposal(context:AuthContext,id:string){
 const {error}=await createAdminSupabase().rpc('confirm_coaching_proposal',{p_user:context.userId,p_proposal:id,p_confirm:true});
 if(error){if(/PREFERENCES_CHANGED/.test(error.message))throw new ApiError(409,'PREFERENCES_CHANGED','Your preferences changed. Generate a fresh proposal.');if(/VERSION_CONFLICT/.test(error.message))throw new ApiError(409,'VERSION_CONFLICT','Your plan changed in another tab. Reload and request a fresh proposal.');if(/NOT_FOUND/.test(error.message))throw new ApiError(404,'NOT_FOUND','Proposal not found.');if(/PROPOSAL_UNAVAILABLE/.test(error.message))throw new ApiError(409,'PROPOSAL_UNAVAILABLE','This proposal expired or was cancelled. Request a fresh one.');throw new ApiError(503,'PLAN_NOT_SAVED','Your plan was not saved. Please retry.');}
 return getActivePlan(context);
}

export async function getPendingProposal(context:AuthContext){
 const {data,error}=await context.db.from('plan_proposals').select('id,base_version,preference_fingerprint,payload,status,created_at,expires_at').eq('user_id',context.userId).eq('status','pending').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)throw new ApiError(503,'PROPOSAL_UNAVAILABLE','Pending proposals could not load.');return data?proposalRowSchema.parse(data):null;
}

export async function getProfileGuard(context:AuthContext){
 const {data,error}=await createAdminSupabase().rpc('coaching_profile_guard',{p_user:context.userId});
 if(error||!data)throw new ApiError(503,'PROFILE_UNAVAILABLE','Your saved preferences could not be checked.');return data;
}
