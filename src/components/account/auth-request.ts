import {safeNext} from '@/lib/auth/schemas';
export type AuthMode='login'|'signup'|'recover'|'password';
export class AuthRequestError extends Error{}
export function authErrorMessage(code:unknown,mode:AuthMode){
 switch(code){
  case 'LOGIN_FAILED':return 'We couldn’t sign you in. Check your email address and password, then try again.';
  case 'EMAIL_VERIFICATION_REQUIRED':return 'Verify your email using the link in your inbox, then sign in.';
  case 'AUTH_RATE_LIMITED':return 'Too many attempts. Please wait a little before trying again.';
  case 'AUTH_REQUIRED':return mode==='password'?'Your session or reset link is no longer valid. Request a new password reset email.':'Please sign in again to continue.';
  case 'PASSWORD_REQUIREMENTS':return 'Choose a unique password with at least 12 characters that meets the account password requirements.';
  case 'PASSWORD_UPDATE_FAILED':return 'Your password could not be updated. Open a new reset link or sign in again.';
  case 'INVALID_INPUT':return mode==='recover'?'Check your email address and try again.':mode==='password'?'Use a unique password with at least 12 characters.':'Check your email address and password requirements, then try again.';
  case 'AUTH_UNAVAILABLE':case 'UNAVAILABLE':case 'NOT_CONFIGURED':return 'Account access is temporarily unavailable. Please try again later.';
  default:return mode==='login'?'We couldn’t sign you in. Please try again.':'We couldn’t complete this request. Please try again later.';
 }
}
export async function submitAuth(mode:AuthMode,values:{email:string;password:string},next:string,dependencies:{lock:{busy:boolean};request:typeof fetch;navigate:(path:string)=>void;clearPassword:()=>void}){
 // Call fetch without binding it to the dependency object (Window requires this).
 const {request}=dependencies;
 if(dependencies.lock.busy)return {kind:'ignored' as const};dependencies.lock.busy=true;let navigating=false;
 try{
  let response;try{response=await request(`/api/v1/auth/${mode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='recover'?{email:values.email}:mode==='password'?{password:values.password}:values),signal:AbortSignal.timeout(20000)});}catch{throw new AuthRequestError('Couldn’t connect. Check your connection and try again.');}
  let body;try{body=await response.json();}catch{throw new AuthRequestError('Account access is temporarily unavailable. Please try again later.');}
  if(!response.ok)throw new AuthRequestError(authErrorMessage(body.error?.code,mode));
  if(mode==='login'&&body.data?.authenticated!==true)throw new AuthRequestError('Sign-in could not be confirmed. Please try again.');
  if(mode==='password'&&body.data?.updated!==true)throw new AuthRequestError('Your password update could not be confirmed. Please try again.');
  if((mode==='signup'||mode==='recover')&&typeof body.data?.message!=='string')throw new AuthRequestError('This request could not be confirmed. Please try again.');
  dependencies.clearPassword();
  if(mode==='login'||(mode==='signup'&&body.data?.authenticated===true)){navigating=true;dependencies.navigate(mode==='login'?safeNext(next,'/'):'/onboarding');return {kind:'navigating' as const};}
  return {kind:'success' as const,message:mode==='password'?'Your password has been updated.':mode==='signup'?'If registration can proceed, check your email to verify your account before signing in.':'If an eligible account exists, a password reset email will be sent. Check your inbox and spam folder.'};
 }finally{if(!navigating)dependencies.lock.busy=false;}
}
