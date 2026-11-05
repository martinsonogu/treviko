import Link from 'next/link';
import {getPageUser} from '@/lib/auth/page-user';
import {getCoachingView} from '@/lib/coaching/view';
import {TrainingPlan} from './DailyDashboard';
export default async function AccountPlan(){
 const context=await getPageUser();if(!context)return <section className="card cardbody"><h2>Your training, connected.</h2><p>Sign in for your personal training plan, with nutrition coaching when you want it. The exercise library is open to everyone.</p><Link className="button" href="/login?next=/training">Sign in to plan →</Link></section>;
 let view;try{view=await getCoachingView(context);}catch{return <p className="notice" role="alert">Your saved training plan could not load. Reload to retry; your plan has not been changed.</p>;}
 return <TrainingPlan view={view}/>;
}
