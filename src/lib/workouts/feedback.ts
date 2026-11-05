import 'server-only';
import {z} from 'zod';
import type {AuthContext} from '../auth/session';
import {ApiError} from '../api/http';
import {createAdminSupabase} from '../supabase/admin';
import {getWorkout} from './service';
export const effortOptions=['easy','about_right','hard','very_hard'] as const;
export const feedbackRequest=z.object({effort:z.enum(effortOptions)}).strict();
export const feedbackSchema=z.object({session_id:z.string().uuid(),effort:z.enum(effortOptions),created_at:z.string()});
export async function getFeedback(context:AuthContext,id:string){const workout=await getWorkout(context,id);if(workout.status!=='completed')throw new ApiError(409,'NOT_COMPLETED','Finish and save the workout before adding feedback.');const result=await context.db.from('workout_feedback').select('session_id,effort,created_at').eq('user_id',context.userId).eq('session_id',id).maybeSingle();if(result.error)throw new ApiError(503,'FEEDBACK_UNAVAILABLE','Your workout is saved, but the effort check-in could not load. Retry or skip it.');return result.data?feedbackSchema.parse(result.data):null;}
export async function saveFeedback(context:AuthContext,id:string,input:unknown){z.string().uuid().parse(id);const body=feedbackRequest.parse(input);const workout=await getWorkout(context,id);if(workout.status!=='completed')throw new ApiError(409,'NOT_COMPLETED','Finish and save the workout before adding feedback.');const {data,error}=await createAdminSupabase().rpc('save_workout_feedback',{p_user:context.userId,p_session:id,p_effort:body.effort});if(error){if(/FEEDBACK_EXISTS/.test(error.message))throw new ApiError(409,'FEEDBACK_EXISTS','Feedback was already saved in another tab. Reload the check-in to see it.');if(/NOT_FOUND/.test(error.message))throw new ApiError(404,'NOT_FOUND','Completed workout not found.');throw new ApiError(503,'FEEDBACK_NOT_SAVED','Your workout is saved, but feedback could not be confirmed. Retry the same choice or skip it.');}return feedbackSchema.parse(data);}
