import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import {requirePageUser} from '@/lib/auth/session';
import {ApiError} from '@/lib/api/http';
import {getWorkout,previousWorkouts} from '@/lib/workouts/service';
import WorkoutEditor from '@/components/workouts/WorkoutEditor';
async function Content({id,review}:{id:string;review:boolean}){const context=await requirePageUser(`/training/workouts/${id}`);let session;try{session=await getWorkout(context,id);}catch(error){if(error instanceof ApiError&&error.status===404)notFound();throw error;}let previous:Awaited<ReturnType<typeof previousWorkouts>>=[];let unavailable=false;if(session.status==='in_progress')try{previous=await previousWorkouts(context,session);}catch{unavailable=true;}return <WorkoutEditor key={`${session.id}:${session.version}`} initial={session} previous={previous} previousUnavailable={unavailable} reviewCompleted={review}/>;}
export default async function WorkoutPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{view?:string}>}){const {id}=await params;const query=await searchParams;return <Suspense fallback={<p role="status">Loading saved workout…</p>}><Content id={id} review={query?.view==='details'}/></Suspense>;}
