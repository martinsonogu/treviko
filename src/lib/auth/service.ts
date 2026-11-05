import 'server-only';
import { z } from 'zod';
import { createServerSupabase,createPasswordVerifier } from '../supabase/server';
import { createAdminSupabase } from '../supabase/admin';
import { ApiError, readJson, json, apiFailure, checkOrigin } from '../api/http';
import { requireUser } from './session';
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
    const admin=createAdminSupabase();
    const verification=createPasswordVerifier();
    const {data,error}=await verification.auth.signInWithPassword({email:context.email,password:body.password});
    if(error||data.user?.id!==context.userId) throw new ApiError(401,'REAUTH_REQUIRED','The current password could not be verified.');
    const removed=await admin.auth.admin.deleteUser(context.userId,false);
    await verification.auth.signOut({scope:'local'}).catch(()=>{});
    if(removed.error) throw new ApiError(503,'DELETION_FAILED','Your account was not deleted. Please try again.');
    await context.db.auth.signOut({scope:'local'}).catch(()=>{});
    return json({deleted:true,message:'Your account and owned application records have been deleted. Provider backups and external-provider records follow their own retention policies.'});
   }
   const db=await createServerSupabase(request);
   if(action==='signup') {
    const body=await readJson(request,signupSchema,4000);const {error}=await db.auth.signUp({...body,options:{emailRedirectTo:appOrigin()+'/auth/confirm'}});
    if(error) throw new ApiError(error.status===429?429:503,'REGISTRATION_UNAVAILABLE','Registration could not be processed. Please try again later.');
    return json({message:'If registration can proceed, check your email to verify your account before signing in.'});
   }
   if(action==='login') {
    const body=await readJson(request,loginSchema,4000);const {data,error}=await db.auth.signInWithPassword(body);
    if(error||!data.user?.email_confirmed_at) throw new ApiError(401,'LOGIN_FAILED','Unable to sign in. Check your credentials and email verification.');
    return json({authenticated:true});
   }
   if(action==='recovery') {
    const {email}=await readJson(request,recoverySchema,4000);const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:appOrigin()+'/auth/confirm?next=/reset-password'});
    if(error) throw new ApiError(error.status===429?429:503,'RECOVERY_UNAVAILABLE','Recovery could not be processed. Please try again later.');
    return json({message:'If an eligible account exists, a password reset email will be sent. Check your inbox and spam folder.'});
   }
   if(action==='password') {
    await requireUser(request); const body=await readJson(request,resetPasswordSchema,4000);const {error}=await db.auth.updateUser(body);
    if(error) throw new ApiError(400,'PASSWORD_UPDATE_FAILED','The password was not updated. Use a valid reset link or sign in again.');
    return json({message:'Your password was updated.'});
   }
   const {error}=await db.auth.signOut({scope:'local'});
   if(error) throw new ApiError(503,'LOGOUT_FAILED','Could not sign out. Please try again.');
   return json({signedOut:true});
  } catch(error){return apiFailure(error);}
 };
}
