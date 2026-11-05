import {Suspense} from 'react';
import Link from 'next/link';
import {requirePageUser} from '@/lib/auth/session';
import {getProfile} from '@/lib/profile/service';
import ProfileEditor from '@/components/account/ProfileEditor';
async function Content(){const context=await requirePageUser('/profile');const profile=await getProfile(context).catch(()=>null);if(!profile)return <p className="notice" role="alert">Your profile could not load. Apply the Supabase migrations and try again.</p>;return <ProfileEditor initial={profile} onboarding={false}/>;}
export default function Page(){return <div className="stack"><header><p className="eyebrow">YOUR TREVIKO</p><h1>Your preferences.</h1><p className="muted">Choose what fits your life. Optional details stay optional.</p><Link className="textbutton" href="/settings">Account settings →</Link></header><Suspense fallback={<p role="status">Loading preferences…</p>}><Content/></Suspense></div>;}
