import {Suspense} from 'react';
import {requirePageUser} from '@/lib/auth/session';
import {getProfile} from '@/lib/profile/service';
import {profileForCoach} from '@/lib/profile/personalisation';
import CoachChat from '@/components/coach/CoachChat';
async function Content(){const context=await requirePageUser('/coach');const profile=await getProfile(context).catch(()=>null);if(!profile)return <p className="notice" role="alert">Saved preferences could not load. Check Supabase migrations and reload.</p>;return <CoachChat initialProfile={profileForCoach(profile)}/>;}
export default function Coach(){return <Suspense fallback={<p role="status">Getting Kivo ready…</p>}><Content/></Suspense>;}
