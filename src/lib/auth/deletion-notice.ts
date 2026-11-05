import 'server-only';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import type {NextResponse} from 'next/server';
export const deletionCookie='treviko-deletion-complete';
export const deletionNoticeSeconds=120;
export function deletionNoticeSecret(){const secret=process.env.SUPABASE_SECRET_KEY;if(!secret)throw new Error('Account deletion is temporarily unavailable.');return secret;}
const sign=(value:string,secret:string)=>createHmac('sha256',secret).update('treviko:deletion-notice:'+value).digest('base64url');
export function issueDeletionNotice(secret:string,now=Date.now()){
 const value=Buffer.from(JSON.stringify({purpose:'account_deleted',at:now,nonce:randomUUID()})).toString('base64url');return value+'.'+sign(value,secret);
}
export function verifyDeletionNotice(token:string|undefined,secret:string|undefined,now=Date.now()){
 if(!token||!secret||token.length>512||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return false;
 try{const [value,signature,...extra]=token.split('.');if(!value||!signature||extra.length)return false;const actual=Buffer.from(signature,'base64url'),expected=Buffer.from(sign(value,secret),'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;const payload=JSON.parse(Buffer.from(value,'base64url').toString());return payload.purpose==='account_deleted'&&typeof payload.nonce==='string'&&typeof payload.at==='number'&&Number.isFinite(payload.at)&&payload.at<=now+5000&&now-payload.at<deletionNoticeSeconds*1000;}catch{return false;}
}
const noticeOptions={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',path:'/login'};
export function setDeletionNotice(response:NextResponse,secret:string){response.cookies.set(deletionCookie,issueDeletionNotice(secret),{...noticeOptions,maxAge:deletionNoticeSeconds});return response;}
export function clearDeletionNotice(response:NextResponse){response.cookies.set(deletionCookie,'',{...noticeOptions,maxAge:0});return response;}
export async function hasDeletionCompletion(){const jar=await cookies();return verifyDeletionNotice(jar.get(deletionCookie)?.value,process.env.SUPABASE_SECRET_KEY);}
export function clearAuthCookies(request:Request,response:NextResponse){
 const projectUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!projectUrl)return response;
 const base=`sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
 for(const entry of (request.headers.get('cookie')??'').split(';')){const name=entry.trim().split('=')[0];if(name===base||name===base+'-code-verifier'||name.startsWith(base+'.')||name.startsWith(base+'-code-verifier.'))response.cookies.set(name,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});}
 return response;
}
