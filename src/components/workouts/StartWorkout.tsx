'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {sessionSchema} from '@/lib/workouts/schema';
export default function StartWorkout({planId,planVersion,weekday,name}:{planId:string;planVersion:number;weekday:number;name:string}){
 const router=useRouter(),lock=useRef(false);const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function start(){if(lock.current)return;lock.current=true;setBusy(true);setError('');const key=`treviko:workout-start:${planId}:${planVersion}:${weekday}`;let startKey=crypto.randomUUID();try{startKey=sessionStorage.getItem(key)||startKey;sessionStorage.setItem(key,startKey);}catch{/* Database uniqueness still prevents duplicate active workouts. */}
 try{const response=await fetch('/api/v1/workouts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId,planVersion,weekday,startKey}),signal:AbortSignal.timeout(20000)});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Starting the workout could not be confirmed. Retry to resume safely.');const session=sessionSchema.parse(body.data);try{sessionStorage.removeItem(key);}catch{}router.push(`/training/workouts/${session.id}`);router.refresh();}
 catch(cause){setError(cause instanceof Error&&cause.name!=='TimeoutError'?cause.message:'Starting the workout could not be confirmed. Retry to resume safely.');lock.current=false;setBusy(false);}}
 return <div><button className="button" type="button" disabled={busy} onClick={()=>void start()} aria-label={`Start workout: ${name}`}>{busy?'Starting…':'Start workout'}</button>{error&&<p role="alert" className="notice">{error}</p>}</div>;
}
