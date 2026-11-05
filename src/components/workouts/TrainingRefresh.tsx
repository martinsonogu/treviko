'use client';
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
// Reconcile restored App Router/PWA views with persisted state, without polling.
export default function TrainingRefresh(){const router=useRouter(),path=usePathname();useEffect(()=>{if(path!=='/training')return;const refresh=()=>{if(document.visibilityState==='visible')router.refresh();};refresh();window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);document.removeEventListener('visibilitychange',refresh);};},[path,router]);return null;}
