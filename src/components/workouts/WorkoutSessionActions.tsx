'use client';
import Link from 'next/link';
import {useSyncExternalStore} from 'react';
import type {WorkoutSession} from '@/lib/workouts/schema';
import {completedSets} from '@/lib/workouts/schema';
import {completionSummary} from '@/lib/workouts/completion';
import {countLabel} from '@/lib/workouts/presentation';
import {workoutDayKey} from '@/lib/workouts/dates';
import {trainingSessionState,resolveActiveWorkout} from '@/lib/workouts/training-state';
import WorkoutDate from './WorkoutDate';
import StartWorkout from './StartWorkout';
function subscribe(update:()=>void){let timer:ReturnType<typeof setTimeout>;const schedule=()=>{const next=new Date();next.setHours(24,0,0,20);timer=setTimeout(()=>{update();schedule();},next.getTime()-Date.now());};schedule();for(const event of ['focus','pageshow','visibilitychange'])window.addEventListener(event,update);return()=>{clearTimeout(timer);for(const event of ['focus','pageshow','visibilitychange'])window.removeEventListener(event,update);};}
const snapshot=()=>{const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;return zone+'|'+workoutDayKey(new Date().toISOString(),zone);};
const serverSnapshot=()=>'';
export default function WorkoutSessionActions({planId,planVersion,weekday,name,active:suppliedActive,previous,stateRevision}:{planId:string;planVersion:number;weekday:number;name:string;active:WorkoutSession|null;previous:WorkoutSession|null;stateRevision?:string}){
 const active=resolveActiveWorkout(suppliedActive,previous?[previous]:[]);
 const calendar=useSyncExternalStore(subscribe,snapshot,serverSnapshot);const zone=calendar.split('|')[0]||null;
 const status=trainingSessionState(planId,planVersion,weekday,active,previous,zone,new Date().toISOString());
 const complete=previous?.status==='completed'&&previous.plan_id===planId&&previous.weekday===weekday?previous:null;
 // A terminal record changes the client boundary, clearing the prior start receipt.
 const startBoundary=`${planId}:${planVersion}:${weekday}:${complete?.id??'not-started'}`;
 return <div className="workoutSessionActions" data-workout-state={status}>{status==='in_progress'&&active?<><span className="pill">In progress</span>{complete&&complete.id!==active.id&&<div className="previousWorkoutSummary"><p>Previous session · {completionSummary(complete).partial?'Completed partially':'Completed'} · <WorkoutDate value={complete.finished_at!}/></p><Link className="textbutton" href={`/training/workouts/${complete.id}/completed`}>Review previous workout →</Link><p>This repeat is a separate session.</p></div>}<p>{countLabel(completedSets(active.performance),'completed set')} saved.</p><Link className="button" href={`/training/workouts/${active.id}`}>Resume workout →</Link></>:<>{complete&&<><span className="pill">{completionSummary(complete).partial?'Completed partially':status==='completed_today'?'Completed':'Completed previously'}</span><p>{status==='completed_today'?'Completed today':'Last completed'} · <WorkoutDate value={complete.finished_at!}/></p><p>{countLabel(completedSets(complete.performance),'completed set')} · {completionSummary(complete).partial?'Partial workout — some prescribed sets were not completed.':'Prescribed set counts reached.'}{complete.plan_version!==planVersion?` · Earlier plan version ${complete.plan_version}`:''}</p><Link className="textbutton" href={`/training/workouts/${complete.id}/completed`}>Review workout →</Link></>}<StartWorkout key={startBoundary} planId={planId} planVersion={planVersion} weekday={weekday} name={name} repeat={Boolean(complete)} stateRevision={stateRevision} disabled={active?.status==='in_progress'}/>{active?.status==='in_progress'&&<p className="muted">Resume or discard your current workout before starting another.</p>}</>}</div>;
}
