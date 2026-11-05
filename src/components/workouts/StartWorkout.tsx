'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {sessionSchema,type WorkoutSession} from '@/lib/workouts/schema';
export default function StartWorkout({planId,planVersion,weekday,name,repeat=false,disabled=false,stateRevision}:{planId:string;planVersion:number;weekday:number;name:string;repeat?:boolean;disabled?:boolean;stateRevision?:string}){
 const router=useRouter(),lock=useRef(false),active=useRef<AbortController|null>(null);const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState<{session:WorkoutSession;revision?:string}|null>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 async function start(){if(lock.current||disabled)return;if(repeat&&!window.confirm('Start another session of this workout? Your previous workout will stay in history.'))return;lock.current=true;setBusy(true);setError('');const controller=new AbortController();active.current=controller;
 const key=`treviko:workout-start:${planId}:${planVersion}:${weekday}`;try{if(!globalThis.crypto?.randomUUID)throw new Error('Open Treviko over HTTPS or localhost to start a workout securely.');let startKey=crypto.randomUUID();try{const stored=sessionStorage.getItem(key);if(stored&&/^[0-9a-f-]{36}$/i.test(stored))startKey=stored;sessionStorage.setItem(key,startKey);}catch{/* Database uniqueness still prevents duplicate active workouts. */}
 const response=await fetch('/api/v1/workouts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId,planVersion,weekday,startKey}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Starting the workout could not be confirmed. Retry to resume safely.');const session=sessionSchema.parse(body.data);if(controller.signal.aborted)return;try{sessionStorage.removeItem(key);}catch{}setReady({session,revision:stateRevision});router.push(`/training/workouts/${session.id}${session.status==='completed'?'/completed':''}`);}
 catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error&&cause.name!=='TimeoutError'?cause.message:'Starting the workout could not be confirmed. Retry to resume safely.');}
 finally{lock.current=false;setBusy(false);active.current=null;}}
 // A start receipt is only current until the next owner-scoped server read.
 const currentReady=ready?.revision===stateRevision?ready?.session:null;
 if(currentReady)return <div className="workoutReady"><p role="status">{currentReady.status==='in_progress'?'Your saved workout is ready.':'This saved session has already ended.'}</p><Link className="button" href={`/training/workouts/${currentReady.id}${currentReady.status==='completed'?'/completed':''}`}>{currentReady.status==='in_progress'?'Resume workout':'Review workout'} →</Link>{currentReady.status!=='in_progress'&&<button type="button" className="textbutton" onClick={()=>{setReady(null);router.refresh();}}>Back to workout choices</button>}</div>;
 return <div><button className="button" type="button" disabled={busy||disabled} onClick={()=>void start()} aria-label={`${repeat?'Repeat':'Start'} workout: ${name}`}>{busy?'Starting…':repeat?'Repeat workout':'Start workout'}</button>{error&&<p role="alert" className="notice">{error}</p>}</div>;
}
