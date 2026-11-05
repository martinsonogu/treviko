'use client';
import {navigateAfterAuth} from './navigation';
import Link from 'next/link';
import { useState,type FormEvent } from 'react';
export default function AuthForm({mode,configured,next='/profile'}:{mode:'login'|'signup'|'recover'|'password';configured:boolean;next?:string}) {
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');setMessage('');try{
  const response=await fetch(`/api/v1/auth/${mode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='recover'?{email}:mode==='password'?{password}:{email,password})});const body=await response.json();
  if(!response.ok)throw new Error(body.error?.message||'Could not complete this request.');
  setPassword('');if(mode==='login'){navigateAfterAuth(next);}else setMessage(body.data.message);
 }catch(cause){setError(cause instanceof Error?cause.message:'Could not connect.');}finally{setBusy(false);}}
 return <form className="card cardbody stack accountForm" onSubmit={submit}>
  {!configured&&<p className="notice" role="status">Accounts need Supabase configuration. Add the project URL and publishable key to .env.local and apply the migrations. Existing public Training remains available.</p>}
  {mode!=='password'&&<label className="field">Email<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
  {mode!=='recover'&&<label className="field">{mode==='password'?'New password':'Password'}<input type="password" required minLength={mode==='login'?1:12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/>{mode!=='login'&&<small className="muted">At least 12 characters. Use a unique password.</small>}</label>}
  {error&&<p role="alert" className="notice">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
  <button className="button" disabled={busy||!configured}>{busy?'Working…':mode==='login'?'Sign in':mode==='signup'?'Create account':mode==='recover'?'Send reset email':'Update password'}</button>
  <div className="chips"><Link className="textbutton" href="/login">Sign in</Link><Link className="textbutton" href="/signup">Create account</Link><Link className="textbutton" href="/forgot-password">Forgot password?</Link></div>
 </form>;
}
