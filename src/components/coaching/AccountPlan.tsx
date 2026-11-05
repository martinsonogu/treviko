import Link from 'next/link';
import {requireUser,AuthenticationError} from '@/lib/auth/session';
import {SupabaseConfigurationError} from '@/lib/supabase/config';
import {getCoachingView} from '@/lib/coaching/view';
import {TrainingPlan} from './DailyDashboard';
export default async function AccountPlan(){
 let view;try{const context=await requireUser();view=await getCoachingView(context);}
 catch(error){if(error instanceof AuthenticationError||error instanceof SupabaseConfigurationError)return <section className="card cardbody"><h2>Your training, connected.</h2><p>Sign in to create a personal training and nutrition plan. The exercise library is open to everyone.</p><Link className="button" href="/login?next=/training">Sign in to plan →</Link></section>;return <p className="notice" role="alert">Your saved training plan could not load. Reload to retry; your plan has not been changed.</p>;}
 return <TrainingPlan view={view}/>;
}
