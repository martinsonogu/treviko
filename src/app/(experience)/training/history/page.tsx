import {Suspense} from 'react';
import Link from 'next/link';
import {requirePageUser} from '@/lib/auth/session';
import {listWorkouts} from '@/lib/workouts/service';
import WorkoutHistory from '@/components/workouts/WorkoutHistory';
async function Content({cursor}:{cursor?:{before:string;beforeId:string}}){const context=await requirePageUser('/training/history');const history=await listWorkouts(context,cursor);return <div className="stack"><Link className="textbutton" href="/training">← Training</Link><h1>Training history</h1>{history.active&&<Link className="button" href={`/training/workouts/${history.active.id}`}>Resume unfinished workout →</Link>}<WorkoutHistory sessions={history.recent} count={history.completedCount}/>{history.next&&<Link className="button" href={`/training/history?before=${encodeURIComponent(history.next.before)}&beforeId=${history.next.beforeId}`}>Older workouts →</Link>}{cursor&&<Link className="textbutton" href="/training/history">Latest workouts →</Link>}</div>;}
export default async function History({searchParams}:{searchParams:Promise<{before?:string;beforeId?:string}>}){const query=await searchParams;return <Suspense fallback={<p role="status">Loading training history…</p>}><Content cursor={query.before?{before:query.before,beforeId:query.beforeId??''}:undefined}/></Suspense>;}
