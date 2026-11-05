import AuthForm from '@/components/account/AuthForm';
import {isSupabaseConfigured} from '@/lib/supabase/config';
import {safeNext} from '@/lib/auth/schemas';
import {Suspense} from 'react';
async function Form({searchParams}:{searchParams:Promise<{next?:string;verification?:string}>}){const query=await searchParams;return <>{query.verification==='failed'&&<p role="alert" className="notice">That verification link is invalid or expired. Request a new email or sign in.</p>}<AuthForm mode="password" configured={isSupabaseConfigured()} next={safeNext(query.next)}/></>;}
export default function Page(props:{searchParams:Promise<{next?:string;verification?:string}>}){return <div className="stack"><header><p className="eyebrow">TREVIKO ACCOUNT</p><h1>Choose a new password.</h1><p className="muted">Open your recovery email link first, or sign in to update your password.</p></header><Suspense fallback={<p role="status">Loading account form…</p>}><Form {...props}/></Suspense></div>;}
