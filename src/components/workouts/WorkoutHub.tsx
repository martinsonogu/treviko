import type {AuthContext} from '@/lib/auth/session';
import type {ActivePlan} from '@/lib/coaching/schema';
import {listWorkouts} from '@/lib/workouts/service';
import WorkoutChoices from './WorkoutChoices';
export default async function WorkoutHub({context,plan,needsReview=false,today}:{context:AuthContext;plan:ActivePlan|null;needsReview?:boolean;today?:number}){
 let history;try{history=await listWorkouts(context);}catch{return <section className="card cardbody"><h2>Your workouts</h2><p role="alert">Your saved workout progress could not load. Reload to retry before starting another workout.</p></section>;}
 return <WorkoutChoices plan={plan} active={history.active} count={history.completedCount} needsReview={needsReview} today={today}/>;
}
