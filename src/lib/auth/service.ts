import 'server-only';
import { z } from 'zod';
import { createServerSupabase,createPasswordVerifier } from '../supabase/server';
import { createAdminSupabase } from '../supabase/admin';
import { ApiError, readJson, json, apiFailure, checkOrigin } from '../api/http';
import { requireUser } from './session';
import {authServiceError} from './errors';
import {clearAuthCookies,clearDeletionNotice,deletionNoticeSecret,setDeletionNotice} from './deletion-notice';
import { signupSchema,loginSchema,recoverySchema,resetPasswordSchema,deletionSchema } from './schemas';
export function appOrigin() {
  const value=process.env.APP_ORIGIN || (process.env.NODE_ENV!=='production'?'http://localhost:3000':'');
  const parsed=z.string().url().parse(value); const url=new URL(parsed);
  if(url.pathname!=='/' || url.search || url.hash || url.username || url.password || (url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))) throw new ApiError(503,'ORIGIN_CONFIGURATION','Configure APP_ORIGIN on the server.');
  return url.origin;
}
export function authHandler(action:'signup'|'login'|'logout'|'recovery'|'password'|'delete') {
 return async(request:Request)=>{
  try {
   checkOrigin(request);
   if(action==='delete') {
    const context=await requireUser(request);const body=await readJson(request,deletionSchema,4000);
    // Use a separate nonpersistent client: reauthentication cannot replace the browser session.
    const admin=createAdminSupabase();const noticeSecret=deletionNoticeSecret();
    const verification=createPasswordVerifier();
    const {data,error}=await verification.auth.signInWithPassword({email:context.email,password:body.password});
    if(error||data.user?.id!==context.userId) throw new ApiError(401,'REAUTH_REQUIRED','The current password could not be verified.');
    const removed=await admin.auth.admin.deleteUser(context.userId,false);
    await verification.auth.signOut({scope:'local'}).catch(()=>{});
    if(removed.error) throw new ApiError(503,'DELETION_FAILED','Your account was not deleted. Please try again.');
    await context.db.auth.signOut({scope:'local'}).catch(()=>{});
    return setDeletionNotice(clearAuthCookies(request,json({deleted:true,message:'Your account and owned application records have been deleted. Provider backups and external-provider records follow their own retention policies.'})),noticeSecret);
   }
   const db=await createServerSupabase(request);
   if(action==='signup') {
    const body=await readJson(request,signupSchema,4000);const {data,error}=await db.auth.signUp({...body,options:{emailRedirectTo:appOrigin()+'/auth/confirm'}});
    if(error&&!['user_already_exists','email_exists'].includes(error.code??''))throw authServiceError(error,'signup');
    return clearDeletionNotice(json({authenticated:!error&&Boolean(data?.session&&data.user?.email_confirmed_at),message:'If registration can proceed, check your email to verify your account before signing in.'}));
   }
   if(action==='login') {
    const body=await readJson(request,loginSchema,4000);const {data,error}=await db.auth.signInWithPassword(body);
    if(error)throw authServiceError(error,'login');
    if(!data.user||data.user.is_anonymous)throw authServiceError(null,'login');
    if(!data.user.email_confirmed_at){await db.auth.signOut({scope:'local'}).catch(()=>{});throw new ApiError(401,'EMAIL_VERIFICATION_REQUIRED','Verify your email using the link in your inbox, then sign in.');}
    return clearDeletionNotice(json({authenticated:true}));
   }
   if(action==='recovery') {
    const {email}=await readJson(request,recoverySchema,4000);const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:appOrigin()+'/auth/confirm?next=/reset-password'});
    if(error&&error.code!=='user_not_found')throw authServiceError(error,'recovery');
    return json({message:'If an eligible account exists, a password reset email will be sent. Check your inbox and spam folder.'});
   }
   if(action==='password') {
    await requireUser(request); const body=await readJson(request,resetPasswordSchema,4000);const {error}=await db.auth.updateUser(body);
    if(error)throw authServiceError(error,'password');
    return clearDeletionNotice(json({updated:true,message:'Your password was updated.'}));
   }
   const {error}=await db.auth.signOut({scope:'local'});
   if(error) throw new ApiError(503,'LOGOUT_FAILED','Could not sign out. Please try again.');
   return clearDeletionNotice(clearAuthCookies(request,json({signedOut:true})));
  } catch(error){return apiFailure(error);}
 };
}
