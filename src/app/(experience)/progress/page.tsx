import {Suspense} from 'react';
import {requirePageUser} from '@/lib/auth/session';
import ProgressOverview from '@/components/workouts/ProgressOverview';
import {listWorkouts} from '@/lib/workouts/service';
async function Content(){const context=await requirePageUser('/progress');let history;try{history=await listWorkouts(context);}catch{return <p role="alert">Workout totals could not load. Reload to retry.</p>;}return <ProgressOverview count={history.completedCount} recent={history.recent[0]??null} active={history.active}/>;}
export default function Progress(){return <Suspense fallback={<p role="status">Loading your progress…</p>}><Content/></Suspense>;}
