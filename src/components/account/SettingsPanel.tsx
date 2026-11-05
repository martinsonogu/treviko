'use client';
import {deleteAccount} from './delete-account';
import {signOutAccount} from './sign-out';
import {navigateAfterAuth} from './navigation';
import Link from 'next/link';
import {useRef,useState,type FormEvent} from 'react';
export default function SettingsPanel(){
 const lock=useRef(false);const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [pending,setPending]=useState<'delete'|'logout'|null>(null);const [error,setError]=useState<{action:'delete'|'logout';message:string}|null>(null);const busy=pending!==null;
 async function logout(){
  if(lock.current)return;lock.current=true;setPending('logout');setError(null);let navigating=false;
  try{await signOutAccount({request:fetch,navigate:path=>{navigating=true;navigateAfterAuth(path);}});}catch(cause){setError({action:'logout',message:cause instanceof Error?cause.message:'Could not confirm sign-out. Please try again.'});}finally{if(!navigating){lock.current=false;setPending(null);}}
 }
 async function remove(event:FormEvent){
  event.preventDefault();if(lock.current)return;lock.current=true;setPending('delete');setError(null);let navigating=false;
  try{await deleteAccount({password,confirmation},{request:fetch,clearCredentials:()=>{setPassword('');setConfirmation('');},navigate:path=>{navigating=true;navigateAfterAuth(path);}});}catch(cause){setError({action:'delete',message:cause instanceof Error?cause.message:'Could not confirm the deletion result. Reload before retrying.'});}finally{if(!navigating){lock.current=false;setPending(null);}}
 }
 return <>
  <section className="card settingsGroup" aria-labelledby="settings-security"><h2 id="settings-security">Security</h2><p className="muted">Use a password reset email to choose a new password.</p><Link className="settingsRowLink" href="/forgot-password"><span>Request a password reset</span><span aria-hidden="true">→</span></Link></section>
  <section className="card settingsGroup" aria-labelledby="settings-privacy"><h2 id="settings-privacy">Privacy &amp; account</h2><details className="settingsDeletion"><summary>Delete account</summary><div className="settingsDeletionBody"><p id="delete-warning">This permanently deletes your account, preferences, saved conversations, coaching plans, meal plans and owned usage records from the application database. It cannot be undone. Provider backups, hosting logs and external AI-provider records follow their own retention policies.</p><form method="post" aria-busy={pending==='delete'} aria-describedby="delete-warning" onSubmit={remove}><fieldset disabled={busy} className="stack"><legend className="visuallyHidden">Confirm account deletion</legend><label className="field">Current password<input type="password" required autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="field">Type DELETE MY ACCOUNT<input required maxLength={17} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}/></label><button className="button dangerButton" disabled={busy||confirmation!=='DELETE MY ACCOUNT'||!password}>{pending==='delete'?'Deleting account…':'Permanently delete my account'}</button></fieldset></form></div></details>{error?.action==='delete'&&<p className="notice" role="alert">{error.message}</p>}</section>
  <section className="settingsSignOut" aria-label="Sign out"><button type="button" className="settingsSecondaryButton" disabled={busy} onClick={()=>{void logout();}}>{pending==='logout'?'Signing out…':'Sign out'}</button>{error?.action==='logout'&&<p className="notice" role="alert">{error.message}</p>}</section>
 </>;
}
