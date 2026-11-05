'use client';
import {navigateAfterAuth} from './navigation';
import Link from 'next/link';
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {submitAuth,AuthRequestError,type AuthMode} from './auth-request';
export default function AuthForm({mode,configured,next='/'}:{mode:AuthMode;configured:boolean;next?:string}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const lock=useRef({busy:false});const id=useId();const errorRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 async function submit(event:FormEvent){event.preventDefault();if(lock.current.busy)return;setBusy(true);setError('');setMessage('');try{
  const result=await submitAuth(mode,{email,password},next,{lock:lock.current,request:fetch,navigate:navigateAfterAuth,clearPassword:()=>{setPassword('');setVisible(false);}});
  if(result.kind==='success')setMessage(result.message);
 }catch(cause){setError(cause instanceof AuthRequestError?cause.message:'We couldn’t complete this request. Please try again.');}finally{if(!lock.current.busy)setBusy(false);}}
 if(message)return <section className="authSuccess stack" role="status"><span className="authStateMark" aria-hidden="true">✓</span><h2>{mode==='password'?'Password updated':'Check your inbox'}</h2><p>{message}</p>{mode==='password'?<button className="button" onClick={()=>navigateAfterAuth('/')}>Continue to my coaching</button>:<Link className="button" href="/login">Back to sign in</Link>}{mode==='recover'&&<button className="textbutton" onClick={()=>{setMessage('');setPassword('');}}>Use a different email address</button>}</section>;
 return <form method="post" aria-label={mode==='login'?'Sign in':mode==='signup'?'Create account':mode==='recover'?'Password recovery':'Update password'} className="authForm stack" onSubmit={submit} aria-busy={busy}>
 {!configured&&<p className="notice" role="status">Account access is temporarily unavailable. Please try again later. You can still explore the exercise library.</p>}
 <fieldset className="stack" disabled={busy||!configured}>
 {mode!=='password'&&<label className="field" htmlFor={id+'-email'}>Email address<input id={id+'-email'} name="email" type="email" inputMode="email" required maxLength={254} autoComplete={mode==='login'?'username':'email'} autoCapitalize="none" spellCheck={false} value={email} onChange={e=>{setEmail(e.target.value);setError('');}} aria-describedby={error?id+'-error':undefined}/></label>}
 {mode!=='recover'&&<div className="field"><label htmlFor={id+'-password'}>{mode==='password'?'New password':'Password'}</label><div className="passwordControl"><input id={id+'-password'} name="password" type={visible?'text':'password'} required minLength={mode==='login'?1:12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>{setPassword(e.target.value);setError('');}} aria-describedby={[mode!=='login'?id+'-hint':'',error?id+'-error':''].filter(Boolean).join(' ')||undefined}/><button type="button" className="passwordToggle" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} aria-controls={id+'-password'} onClick={()=>setVisible(v=>!v)}>{visible?'Hide':'Show'}</button></div>{mode!=='login'&&<small id={id+'-hint'} className="muted">At least 12 characters. Use a unique password.</small>}</div>}
 </fieldset>
 {mode==='login'&&<div className="authRecovery"><Link href="/forgot-password">Forgot password?</Link></div>}
 {error&&<p id={id+'-error'} ref={errorRef} tabIndex={-1} role="alert" className="authError">{error}{mode==='password'&&<><br/><Link href="/forgot-password">Request a new reset link</Link></>}</p>}
 <button className="button authSubmit" disabled={busy||!configured} type="submit">{busy&&<span className="loadingSpinner" aria-hidden="true"/>}{busy?'Please wait…':mode==='login'?'Sign in':mode==='signup'?'Create account':mode==='recover'?'Send reset link':'Update password'}</button>
 <div className="authSecondary">{mode==='login'?<>New to Treviko? <Link href="/signup">Create an account</Link></>:mode==='signup'?<>Already have an account? <Link href="/login">Sign in</Link></>:<Link href="/login">Back to sign in</Link>}</div>
 </form>;
}
