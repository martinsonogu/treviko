import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import {loadSource as load} from './load-source.mjs';
const html=element=>renderToStaticMarkup(element);
const render=(Component,props={})=>html(React.createElement(Component,props));
const pageUser=load('src/lib/auth/page-user.ts'),notices=load('src/lib/auth/deletion-notice.ts'),session=load('src/lib/auth/session.ts'),server=load('src/lib/supabase/server.ts'),admin=load('src/lib/supabase/admin.ts');
const {authHandler}=load('src/lib/auth/service.ts');
const {submitAuth}=load('src/components/account/auth-request.ts');
const {safeNext}=load('src/lib/auth/schemas.ts');
const user={id:'11111111-1111-4111-8111-111111111111',email:'user@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false};
const context={userId:user.id,email:user.email,db:{auth:{signOut:async()=>({error:null})}}};
const request=(body,method='POST',headers={})=>new Request('http://localhost/api/v1/auth/test',{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
async function stubs(entries,work){const old=entries.map(([object,key,value])=>{const prior=object[key];object[key]=value;return [object,key,prior];});try{return await work();}finally{for(const [object,key,value]of old.reverse())object[key]=value;}}
const fields={email:user.email,password:'a-unique-long-password'};
test('all public authentication screens use the dedicated shell without app or redundant sign-in navigation',async()=>{
 const Layout=load('src/app/(auth)/layout.tsx').default,{AuthContent}=load('src/components/auth/AuthContent.tsx');
 await stubs([[pageUser,'getPageUser',async()=>null]],async()=>{for(const mode of ['login','signup','recover','password']){const content=await AuthContent({mode,searchParams:Promise.resolve({})});const markup=render(Layout,{children:content});assert.equal(markup.includes('Mobile navigation'),false);assert.equal(markup.includes('Main navigation'),false);assert.equal(markup.includes('Your account'),false);assert.match(markup,/authShell/);if(mode==='login'){assert.match(markup,/Welcome back/);assert.match(markup,/Continue your coaching journey/);assert.equal((markup.match(/href="\/login"/g)??[]).length,0);}}});
});
test('public chrome offers sign-in/discovery; only verified signed-in users receive app navigation and settings',async()=>{
 const Frame=load('src/components/layout/ExperienceFrame.tsx').default;
 await stubs([[pageUser,'getPageUser',async()=>null]],async()=>{const markup=html(await Frame({children:'Public content'}));assert.match(markup,/Public navigation/);assert.match(markup,/href="\/training"/);assert.match(markup,/href="\/login"/);assert.equal(markup.includes('Mobile navigation'),false);assert.equal(markup.includes('Main navigation'),false);});
 await stubs([[pageUser,'getPageUser',async()=>context]],async()=>{const markup=html(await Frame({children:'Personal coaching'}));assert.match(markup,/Main navigation/);assert.match(markup,/Mobile navigation/);assert.match(markup,/aria-label="Open profile and settings"/);assert.doesNotMatch(markup,/Account &amp; sign out/);assert.equal(markup.includes('Public navigation'),false);});
 await stubs([[pageUser,'getPageUser',async()=>{throw new session.SessionUnavailableError();}]],async()=>{const markup=html(await Frame({children:'PRIVATE_CONTENT'}));assert.equal(markup.includes('PRIVATE_CONTENT'),false);assert.equal(markup.includes('Public navigation'),false);assert.match(markup,/couldn’t check your session/);});
});
test('login fields are labelled, keyboard accessible, correctly autocompleted and initially blank/hidden',()=>{
 const markup=render(load('src/components/account/AuthForm.tsx').default,{mode:'login',configured:true});assert.match(markup,/Email address/);assert.match(markup,/type="email"/);assert.match(markup,/autoComplete="username"/i);assert.match(markup,/autoComplete="current-password"/i);assert.match(markup,/type="password"/);assert.match(markup,/aria-label="Show password"/);assert.match(markup,/aria-pressed="false"/);assert.match(markup,/aria-controls=/);assert.match(markup,/Forgot password/);assert.match(markup,/New to Treviko/);assert.equal(markup.includes(user.email),false);assert.match(markup,/name="password"[^>]*value=""/);
});
test('successful login returns to a safe destination; failure stays put with useful private-safe errors',async()=>{
 const navigation=[],lock={busy:false};let cleared=0;const dependencies={lock,navigate:path=>navigation.push(path),clearPassword:()=>cleared++,request:async()=>Response.json({data:{authenticated:true}})};
 assert.equal((await submitAuth('login',fields,'/coach',dependencies)).kind,'navigating');assert.deepEqual(navigation,['/coach']);assert.equal(cleared,1);assert.equal(lock.busy,true);
 lock.busy=false;dependencies.request=async()=>Response.json({error:{code:'LOGIN_FAILED',message:'PRIVATE_SUPABASE_DIAGNOSTIC'}},{status:401});await assert.rejects(submitAuth('login',fields,'/nutrition',dependencies),error=>/Check your email address and password/.test(error.message)&&!error.message.includes('PRIVATE'));assert.deepEqual(navigation,['/coach']);assert.equal(lock.busy,false);
 dependencies.request=async()=>{throw new Error('PRIVATE_NETWORK_DIAGNOSTIC');};await assert.rejects(submitAuth('login',fields,'/',dependencies),/Check your connection/);
 dependencies.request=async()=>Response.json({data:{}});await assert.rejects(submitAuth('login',fields,'/',dependencies),/could not be confirmed/);
});
test('rapid duplicate clicks cannot create duplicate auth submissions',async()=>{
 let complete,calls=0;const dependencies={lock:{busy:false},navigate:()=>{},clearPassword:()=>{},request:()=>{calls++;return new Promise(resolve=>complete=resolve);}};
 const first=submitAuth('login',fields,'/coach',dependencies);assert.equal((await submitAuth('login',fields,'/coach',dependencies)).kind,'ignored');assert.equal(calls,1);complete(Response.json({data:{authenticated:true}}));await first;
});
test('redirects reject external, encoded and authentication-loop destinations',()=>{
 for(const target of ['https://evil.test','//evil.test','/%2fevil.test','/%255cevil.test','/login','/login?next=/login','/signup','/reset-password','/forgot-password','/auth/confirm'])assert.equal(safeNext(target,'/'),'/');assert.equal(safeNext('/nutrition'),'/nutrition');assert.equal(safeNext('/coach?plan=1'),'/coach?plan=1');
});
test('deletion proof is short-lived, non-identifying, signed and rejects tampering or query-only claims',async()=>{
 const secret='test-proof-signing-secret',now=1000000,token=notices.issueDeletionNotice(secret,now);assert.equal(notices.verifyDeletionNotice(token,secret,now),true);assert.equal(notices.verifyDeletionNotice(token+'tampered',secret,now),false);assert.equal(notices.verifyDeletionNotice(token+'!',secret,now),false);assert.equal(notices.verifyDeletionNotice(token,'wrong',now),false);assert.equal(notices.verifyDeletionNotice(token,secret,now+120001),false);assert.equal(notices.verifyDeletionNotice(undefined,secret,now),false);assert.equal(token.includes(user.email),false);
 const {AuthContent}=load('src/components/auth/AuthContent.tsx');await stubs([[pageUser,'getPageUser',async()=>null],[notices,'hasDeletionCompletion',async()=>false]],async()=>{const markup=html(await AuthContent({mode:'login',searchParams:Promise.resolve({deleted:'true'})}));assert.equal(markup.includes('Your account has been deleted.'),false);assert.match(markup,/link alone can’t confirm/);});
 await stubs([[pageUser,'getPageUser',async()=>null],[notices,'hasDeletionCompletion',async()=>true]],async()=>{const markup=html(await AuthContent({mode:'login',searchParams:Promise.resolve({deleted:'true',verification:'failed'})}));assert.match(markup,/Your account has been deleted/);assert.match(markup,/Create a new account/);assert.equal(markup.includes('Welcome back'),false);assert.equal(markup.includes('<input'),false);assert.equal(markup.includes('verification link'),false);assert.equal(markup.includes('role="alert"'),false);});
});
test('real deletion success clears cookie chunks even when SDK sign-out fails; failure never issues proof',async()=>{
 const prior=process.env.NEXT_PUBLIC_SUPABASE_URL;process.env.NEXT_PUBLIC_SUPABASE_URL='https://testproject.supabase.co';let removed=false;
 const failingSignout={...context,db:{auth:{signOut:async()=>{throw new Error('PRIVATE_SIGNOUT');}}}};
 try{await stubs([[notices,'deletionNoticeSecret',()=> 'test-proof-signing-secret'],[session,'requireUser',async()=>failingSignout],[server,'createPasswordVerifier',()=>({auth:{signInWithPassword:async()=>({data:{user},error:null}),signOut:async()=>({error:null})}})],[admin,'createAdminSupabase',()=>({auth:{admin:{deleteUser:async()=>{removed=true;return {error:null};}}}})]],async()=>{
  const response=await authHandler('delete')(request({password:fields.password,confirmation:'DELETE MY ACCOUNT'},'DELETE',{cookie:'sb-testproject-auth-token.0=private-one; sb-testproject-auth-token.1=private-two; unrelated=keep'}));assert.equal(response.status,200);assert.equal(removed,true);assert.equal((await response.json()).data.deleted,true);const cookie=response.cookies.get(notices.deletionCookie);assert.ok(cookie);assert.equal(notices.verifyDeletionNotice(cookie.value,'test-proof-signing-secret'),true);assert.equal(response.cookies.get('sb-testproject-auth-token.0').value,'');assert.equal(response.cookies.get('sb-testproject-auth-token.1').value,'');assert.equal(response.cookies.get('unrelated'),undefined);assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/SameSite=lax/);
 });
 await stubs([[notices,'deletionNoticeSecret',()=> 'test-proof-signing-secret'],[session,'requireUser',async()=>context],[server,'createPasswordVerifier',()=>({auth:{signInWithPassword:async()=>({data:{user},error:null}),signOut:async()=>({error:null})}})],[admin,'createAdminSupabase',()=>({auth:{admin:{deleteUser:async()=>({error:{message:'PRIVATE_FAILURE'}})}}})]],async()=>{const response=await authHandler('delete')(request({password:fields.password,confirmation:'DELETE MY ACCOUNT'},'DELETE'));assert.equal(response.status,503);assert.equal(response.cookies.get(notices.deletionCookie),undefined);});
 }finally{if(prior===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=prior;}
});
test('login errors distinguish rate limits and service failure without enumerating arbitrary emails',async()=>{
 for(const [error,status,code] of [[{code:'invalid_credentials',message:'PRIVATE'},401,'LOGIN_FAILED'],[{code:'email_not_confirmed',message:'PRIVATE'},401,'LOGIN_FAILED'],[{status:429,message:'PRIVATE'},429,'AUTH_RATE_LIMITED'],[{name:'AuthRetryableFetchError',status:0,message:'PRIVATE'},503,'AUTH_UNAVAILABLE']])await stubs([[server,'createServerSupabase',async()=>({auth:{signInWithPassword:async()=>({data:{user:null},error})}})]],async()=>{const response=await authHandler('login')(request(fields));assert.equal(response.status,status);const body=await response.json();assert.equal(body.error.code,code);assert.equal(JSON.stringify(body).includes('PRIVATE'),false);if(status===429)assert.equal(response.headers.get('retry-after'),'60');});
 await stubs([[server,'createServerSupabase',async()=>({auth:{signInWithPassword:async()=>({data:{user:{...user,email_confirmed_at:null}},error:null}),signOut:async()=>({error:null})}})]],async()=>{const body=await (await authHandler('login')(request(fields))).json();assert.equal(body.error.code,'EMAIL_VERIFICATION_REQUIRED');});
});
test('recovery and reset retain non-enumerating success, confirmation and clear expired-link UI',async()=>{
 const dependencies={lock:{busy:false},navigate:()=>assert.fail('must stay for recovery/reset'),clearPassword:()=>{},request:async()=>Response.json({data:{message:'If an eligible account exists, check email.'}})};
 assert.match((await submitAuth('recover',fields,'/',dependencies)).message,/If an eligible account exists/);dependencies.request=async()=>Response.json({data:{updated:true}});assert.match((await submitAuth('password',fields,'/',dependencies)).message,/password has been updated/);
 const {AuthContent}=load('src/components/auth/AuthContent.tsx');await stubs([[load('src/lib/supabase/config.ts'),'isSupabaseConfigured',()=>true],[pageUser,'getPageUser',async()=>null]],async()=>{const markup=html(await AuthContent({mode:'password',searchParams:Promise.resolve({error:'expired'})}));assert.match(markup,/invalid or expired/);assert.match(markup,/Request a new reset link/);assert.equal(markup.includes('<input'),false);});
});
test('already authenticated login redirects to intended app route and cannot loop back to authentication',async()=>{
 const {AuthContent}=load('src/components/auth/AuthContent.tsx');await stubs([[pageUser,'getPageUser',async()=>context]],async()=>{for(const [next,destination] of [['/coach','/coach'],['/login','/']])await assert.rejects(AuthContent({mode:'login',searchParams:Promise.resolve({next})}),error=>error.digest?.includes(';'+destination+';'));});
});
test('public library stays present; progress empty state has no milestone labels or made-up activity',async()=>{
 const training=load('src/app/(experience)/training/page.tsx').default;assert.match(render(training),/Exercise library/);assert.match(render(load('src/components/account/ProgressEmpty.tsx').default),/No workout history yet/);assert.equal(render(load('src/components/account/ProgressEmpty.tsx').default).includes('Milestone'),false);
 const css=await readFile('src/app/globals.css','utf8');assert.match(css,/\.authMain\{[^}]*max-width:420px/);assert.match(css,/@media\(min-width:850px\)/);assert.match(css,/\.appNav-mobile\{display:none/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/\.authForm input\{font-size:16px/);
});

test('deletion frontend clears both credentials before a fresh redirect and never claims failed deletion succeeded',async()=>{
 const {deleteAccount}=load('src/components/account/delete-account.ts');const events=[];const dependencies={request:async()=>Response.json({data:{deleted:true}}),clearCredentials:()=>events.push('clear-password-and-confirmation'),navigate:path=>events.push(path)};
 await deleteAccount({password:fields.password,confirmation:'DELETE MY ACCOUNT'},dependencies);assert.deepEqual(events,['clear-password-and-confirmation','/login?deleted=true']);events.length=0;
 dependencies.request=async()=>Response.json({error:{code:'REAUTH_REQUIRED',message:'PRIVATE_PASSWORD'}},{status:401});await assert.rejects(deleteAccount({password:'incorrect',confirmation:'DELETE MY ACCOUNT'},dependencies),/current password/);assert.deepEqual(events,[]);
 dependencies.request=async()=>Response.json({data:{deleted:false}});await assert.rejects(deleteAccount({password:fields.password,confirmation:'DELETE MY ACCOUNT'},dependencies),/could not be confirmed/);assert.deepEqual(events,[]);
});
test('verification callbacks preserve onboarding/recovery destinations and strip tokens on failure',async()=>{
 const {GET}=load('src/app/auth/confirm/route.ts');
 await stubs([[server,'createServerSupabase',async()=>({auth:{verifyOtp:async()=>({error:null}),exchangeCodeForSession:async()=>({error:null})}})]],async()=>{
  const verified=await GET(new Request('http://localhost/auth/confirm?token_hash=test-token&type=signup'));assert.equal(new URL(verified.headers.get('location')).pathname,'/onboarding');
  const recovery=await GET(new Request('http://localhost/auth/confirm?code=test-code&next=/reset-password'));assert.equal(new URL(recovery.headers.get('location')).pathname,'/reset-password');
  const external=await GET(new Request('http://localhost/auth/confirm?code=test-code&next=https://evil.test'));assert.equal(new URL(external.headers.get('location')).pathname,'/onboarding');
 });
 await stubs([[server,'createServerSupabase',async()=>({auth:{verifyOtp:async()=>({error:{message:'PRIVATE_CALLBACK_ERROR'}})}})]],async()=>{
  const failed=await GET(new Request('http://localhost/auth/confirm?token_hash=PRIVATE_TOKEN&type=recovery'));assert.equal(failed.headers.get('location'),'http://localhost/reset-password?error=expired');assert.doesNotMatch(failed.headers.get('location'),/PRIVATE/);assert.equal(failed.headers.get('cache-control'),'private, no-store');
 });
});
test('registration never exposes existing-account identity and reset succeeds only for an authenticated user',async()=>{
 const previous=process.env.APP_ORIGIN;process.env.APP_ORIGIN='http://localhost';try{await stubs([[server,'createServerSupabase',async()=>({auth:{signUp:async()=>({data:null,error:{code:'user_already_exists'}}),updateUser:async()=>({error:null})}})],[session,'requireUser',async()=>context]],async()=>{
  const signup=await authHandler('signup')(request(fields));assert.equal(signup.status,200);const body=await signup.json();assert.equal(body.data.authenticated,false);assert.match(body.data.message,/If registration can proceed/);
  const reset=await authHandler('password')(request({password:fields.password}));assert.equal(reset.status,200);assert.equal((await reset.json()).data.updated,true);
 });}finally{if(previous===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previous;}
});

test('Home renders a personal dashboard for a verified account and public marketing only for visitors',async()=>{
 const {HomeContent}=load('src/components/coaching/HomeContent.tsx'),viewModule=load('src/lib/coaching/view.ts');const view={plan:null,today:{weekday:'Monday',workout:null},greeting:'Good morning',displayName:'Test member',onboardingComplete:true,dietaryPattern:'unspecified',meals:[],totals:{energyKcal:null,proteinG:null,carbohydrateG:null,fatG:null},shopping:[]};
 await stubs([[pageUser,'getPageUser',async()=>null]],async()=>{const markup=html(await HomeContent());assert.match(markup,/Get started/);assert.equal(markup.includes('Test member'),false);});
 await stubs([[pageUser,'getPageUser',async()=>context],[viewModule,'getCoachingView',async()=>view]],async()=>{const markup=html(await HomeContent());assert.match(markup,/Test member/);assert.match(markup,/Create my training plan/);assert.equal(markup.includes('MEET YOUR EVERYDAY COACH'),false);});
});

test('temporary identity-provider errors never become an anonymous marketing decision',async()=>{
 for(const status of [0,429,503])await stubs([[load('src/lib/supabase/config.ts'),'isSupabaseConfigured',()=>true],[server,'createServerSupabase',async()=>({auth:{getUser:async()=>({data:{user:null},error:{status,name:'AuthApiError'}})}})]],async()=>{await assert.rejects(session.requireUser(),session.SessionUnavailableError);});
});
