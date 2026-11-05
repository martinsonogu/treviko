import {redirect} from 'next/navigation';
import Link from 'next/link';
import ReloadButton from '@/components/layout/ReloadButton';
import AuthForm from '@/components/account/AuthForm';
import type {AuthMode} from '@/components/account/auth-request';
import {isSupabaseConfigured} from '@/lib/supabase/config';
import {getPageUser} from '@/lib/auth/page-user';
import {safeNext} from '@/lib/auth/schemas';
import {hasDeletionCompletion} from '@/lib/auth/deletion-notice';
export type AuthQuery=Record<string,string|string[]|undefined>;
const headings={login:['Welcome back','Continue your coaching journey.'],signup:['Your next chapter starts here','Create your account. Build a training rhythm that fits your life.'],recover:['Forgot your password?','We’ll help you get back to your coaching.'],password:['Choose a new password','A fresh password for your next step.']};
export function DeletedAccountState(){return <section className="authPanel stack"><span className="authStateMark" aria-hidden="true">✓</span><header><p className="eyebrow">ACCOUNT DELETED</p><h1>Your account has been deleted.</h1><p>Your Treviko account has been removed. You can create a new account whenever you’re ready.</p></header><Link className="button authSubmit" href="/signup">Create a new account</Link><Link className="authQuietLink" href="/login">Sign in to another account</Link></section>;}
export function ResetLinkState(){return <section className="authPanel stack"><header><p className="eyebrow">PASSWORD RECOVERY</p><h1>Reset link unavailable</h1><p role="alert">This password reset link is invalid or expired. Request a new link to choose your password.</p></header><Link className="button authSubmit" href="/forgot-password">Request a new reset link</Link><Link className="authQuietLink" href="/login">Back to sign in</Link></section>;}
export async function AuthContent({mode,searchParams}:{mode:AuthMode;searchParams:Promise<AuthQuery>}){
 const query=await searchParams;let context;
 try{context=await getPageUser();}catch{return <section className="authPanel stack"><h1>Let’s reconnect.</h1><p role="alert">Account access is temporarily unavailable. Please reload and try again.</p><ReloadButton/></section>;}
 if(context&&(mode==='login'||mode==='signup'))redirect(safeNext(typeof query.next==='string'?query.next:undefined,'/'));
 if(mode==='login'&&query.deleted==='true'&&await hasDeletionCompletion())return <DeletedAccountState/>;
 if(mode==='password'&&!isSupabaseConfigured())return <section className="authPanel stack"><h1>Account access unavailable</h1><p role="alert">Password reset is temporarily unavailable. Please try again later.</p><ReloadButton/></section>;
 if(mode==='password'&&(!context||query.error==='expired'))return <ResetLinkState/>;
 return <section className="authPanel"><header className="authHeading"><p className="eyebrow">YOUR TREVIKO ACCOUNT</p><h1>{headings[mode][0]}</h1><p>{headings[mode][1]}</p></header>{query.deleted==='true'&&mode==='login'&&<p className="notice" role="status">This link alone can’t confirm a deletion. You can sign in to another account or create an account.</p>}{query.verification==='failed'&&<p role="alert" className="authError">That email link couldn’t be verified. It may have expired or already been used. Sign in or request a new password reset link.</p>}<AuthForm mode={mode} configured={isSupabaseConfigured()} next={safeNext(typeof query.next==='string'?query.next:undefined,'/')}/></section>;
}
