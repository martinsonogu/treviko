import {Suspense} from 'react';
import {notFound,redirect} from 'next/navigation';
import {requirePageUser} from '@/lib/auth/session';
import {getWorkout} from '@/lib/workouts/service';
import {ApiError} from '@/lib/api/http';
import WorkoutCompletion from '@/components/workouts/WorkoutCompletion';
async function Content({id}:{id:string}){const context=await requirePageUser(`/training/workouts/${id}/completed`);let session;try{session=await getWorkout(context,id);}catch(error){if(error instanceof ApiError&&error.status===404)notFound();throw error;}if(session.status!=='completed'||!session.finished_at)redirect(`/training/workouts/${id}`);return <WorkoutCompletion session={session}/>;}
export default async function Completed({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense fallback={<p role="status">Loading your saved workout summary…</p>}><Content id={id}/></Suspense>;}
