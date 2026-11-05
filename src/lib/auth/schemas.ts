import { z } from 'zod';
export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128);
export const signupSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const recoverySchema = z.object({ email: emailSchema }).strict();
export const resetPasswordSchema = z.object({ password: passwordSchema }).strict();
export const deletionSchema = z.object({ password: z.string().min(1).max(128), confirmation: z.literal('DELETE MY ACCOUNT') }).strict();
export function safeNext(value: string | null | undefined, fallback = '/profile') {
  if(!value||value.length>2000)return fallback;
  let decoded=value;
  try{for(let index=0;index<3;index++){const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}}catch{return fallback;}
  if(!/^\/(?!\/)/.test(decoded)||/[\\\r\n]/.test(decoded)||decoded.startsWith('/auth/')||['/login','/signup','/forgot-password','/reset-password'].includes(decoded.split(/[?#]/)[0].replace(/\/$/,'')))return fallback;
  const url=new URL(decoded,'https://treviko.invalid');
  return url.origin==='https://treviko.invalid'?value:fallback;
}
