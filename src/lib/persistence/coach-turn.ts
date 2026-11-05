import 'server-only';
import {createAdminSupabase} from '../supabase/admin';
import type {WorkoutEvidence} from '../coach/workout-evidence';
export function appendCoachTurn(parameters:{p_user:string;p_conversation:string;p_message:string;p_reply:string;p_category:string;p_status:string;p_mode:string;p_exercise_ids:string[]},evidence?:WorkoutEvidence){
 const ids=evidence?.status==='found'?evidence.sessions.map(session=>session.id):[];
 return createAdminSupabase().rpc(ids.length?'append_coach_turn_with_workouts':'append_coach_turn',{...parameters,...(ids.length?{p_workouts:ids}:{})});
}
