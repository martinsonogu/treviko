import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource as load} from './load-source.mjs';
const {persistProfileAndNavigate,profileSaveDestination}=load('src/components/account/profile-save.ts');
const {emptyProfile}=load('src/lib/profile/schema.ts');
const Loading=load('src/components/coach/CoachLoadingStatus.tsx').default;
function harness(request){
 const events=[],errors=[],saved=[];const lock={inFlight:false};
 const dependencies={lock,request:request??(async(_path,options)=>{events.push(['request']);return Response.json({data:JSON.parse(options.body),error:null});}),router:{replace:path=>events.push(['replace',path]),refresh:()=>events.push(['refresh'])},onStart:()=>events.push(['start']),onSaved:(profile,destination)=>{saved.push(profile);events.push(['saved',destination]);},onError:message=>{errors.push(message);events.push(['error']);},onFinish:()=>events.push(['finished'])};
 return {dependencies,events,errors,saved,lock};
}
const finalOptions=onboarding=>({nextStep:6,finish:true,destination:profileSaveDestination(onboarding)});

test('successful onboarding verifies the saved response, persists completion and navigates to Coach',async()=>{
 const state=harness();const profile={...emptyProfile(),experience:'intermediate',equipment:['dumbbells'],onboardingStep:6};
 assert.equal(await persistProfileAndNavigate(profile,finalOptions(true),state.dependencies),'saved');
 assert.equal(state.saved[0].onboardingComplete,true);assert.equal(state.saved[0].onboardingStep,6);assert.deepEqual(state.events.map(e=>e[0]),['start','request','saved','replace','refresh']);assert.deepEqual(state.events.find(e=>e[0]==='replace'),['replace','/coach']);assert.equal(state.lock.inFlight,true);
});
test('finishing an incomplete profile on /profile redirects to the dashboard',async()=>{
 const state=harness();await persistProfileAndNavigate(emptyProfile(),finalOptions(false),state.dependencies);
 assert.equal(state.saved[0].onboardingComplete,true);assert.deepEqual(state.events.find(e=>e[0]==='replace'),['replace','/']);
});
test('failed save stays on the form, shows an error and permits a retry',async()=>{
 const state=harness(async()=>Response.json({data:null,error:{message:'Your preferences were not saved. Please try again.'}},{status:503}));
 assert.equal(await persistProfileAndNavigate(emptyProfile(),finalOptions(true),state.dependencies),'error');assert.equal(state.saved.length,0);assert.match(state.errors[0],/not saved/);assert.ok(!state.events.some(e=>e[0]==='replace'||e[0]==='refresh'));assert.equal(state.lock.inFlight,false);assert.equal(state.events.at(-1)[0],'finished');
 state.dependencies.request=async(_path,options)=>Response.json({data:JSON.parse(options.body),error:null});assert.equal(await persistProfileAndNavigate(emptyProfile(),finalOptions(true),state.dependencies),'saved');
});
test('HTTP 200 with an incomplete or mismatched save never navigates or claims success',async()=>{
 const expected={...emptyProfile(),onboardingStep:6,onboardingComplete:true};
 for(const data of [{},null,{...expected,onboardingComplete:false},{...expected,onboardingStep:0},{...expected,displayName:'Unexpected data'}]){
  const state=harness(async()=>Response.json({data,error:null}));assert.equal(await persistProfileAndNavigate(emptyProfile(),finalOptions(false),state.dependencies),'error');assert.equal(state.saved.length,0);assert.ok(!state.events.some(e=>e[0]==='replace'));assert.match(state.errors[0],/did not confirm/);
 }
});
test('duplicate submissions before a render and during navigation send only one PATCH',async()=>{
 let resolve;let requests=0;const waiting=new Promise(r=>{resolve=r;});
 const state=harness(async(_path,options)=>{requests++;await waiting;return Response.json({data:JSON.parse(options.body),error:null});});
 const first=persistProfileAndNavigate(emptyProfile(),finalOptions(false),state.dependencies);
 assert.equal(await persistProfileAndNavigate(emptyProfile(),finalOptions(false),state.dependencies),'ignored');assert.equal(requests,1);assert.ok(!state.events.some(e=>e[0]==='replace'));
 resolve();await first;assert.equal(await persistProfileAndNavigate(emptyProfile(),finalOptions(false),state.dependencies),'ignored');assert.equal(requests,1);
});
test('existing profile edits can save and keep editing without forced navigation or completion changes',async()=>{
 const profile={...emptyProfile(),onboardingComplete:true,onboardingStep:6,allergies:['peanuts']};const state=harness();
 await persistProfileAndNavigate(profile,{nextStep:6,finish:false,refresh:true},state.dependencies);
 assert.deepEqual(state.saved[0],profile);assert.ok(!state.events.some(e=>e[0]==='replace'));assert.ok(state.events.some(e=>e[0]==='refresh'));assert.equal(state.lock.inFlight,false);
 const partial=harness();await persistProfileAndNavigate(emptyProfile(),{nextStep:2,finish:false},partial.dependencies);assert.equal(partial.saved[0].onboardingComplete,false);assert.ok(!partial.events.some(e=>e[0]==='replace'));
});
test('validation and connection failures retain the form and do not redirect',async()=>{
 const invalid=harness();await persistProfileAndNavigate({...emptyProfile(),timeZone:'not-a-time-zone'},finalOptions(false),invalid.dependencies);assert.match(invalid.errors[0],/timeZone/);assert.ok(!invalid.events.some(e=>e[0]==='request'||e[0]==='replace'));
 const offline=harness(async()=>{throw new Error('private connection diagnostics');});await persistProfileAndNavigate(emptyProfile(),finalOptions(false),offline.dependencies);assert.match(offline.errors[0],/Check your connection/);assert.doesNotMatch(offline.errors[0],/private/);assert.equal(offline.lock.inFlight,false);
});
function contentOfPage(file){const tree=load(file).default();const children=React.Children.toArray(tree.props.children);const suspense=children.find(child=>React.isValidElement(child)&&child.type===Symbol.for('react.suspense'));return suspense.props.children.type;}
test('completed onboarding redirects home while /profile still renders saved preferences for editing',async()=>{
 const session=load('src/lib/auth/session.ts'),service=load('src/lib/profile/service.ts');const previousUser=session.requirePageUser,previousProfile=service.getProfile;
 const saved={...emptyProfile(),displayName:'Saved user',equipment:['dumbbells'],onboardingComplete:true,onboardingStep:6};const requested=[];
 session.requirePageUser=async path=>{requested.push(path);return {userId:'verified-user'};};service.getProfile=async()=>structuredClone(saved);
 try{
  await assert.rejects(()=>contentOfPage('src/app/(experience)/onboarding/page.tsx')(),error=>String(error.digest).includes('NEXT_REDIRECT')&&String(error.digest).includes(';/;'));
  const editor=await contentOfPage('src/app/(experience)/profile/page.tsx')();assert.deepEqual(editor.props.initial,saved);assert.equal(editor.props.onboarding,false);
  service.getProfile=async()=>({...saved,onboardingComplete:false});const onboarding=await contentOfPage('src/app/(experience)/onboarding/page.tsx')();assert.equal(onboarding.props.onboarding,true);assert.equal(onboarding.props.initial.onboardingComplete,false);assert.deepEqual(requested,['/onboarding','/profile','/onboarding']);
 }finally{session.requirePageUser=previousUser;service.getProfile=previousProfile;}
});
test('Coach loading status is accessible, distinguishes generation and disappears when idle',()=>{
 const generating=renderToStaticMarkup(React.createElement(Loading,{restoring:false,busy:true,generating:true}));assert.match(generating,/role="status"/);assert.match(generating,/aria-live="polite"/);assert.match(generating,/visuallyHidden/);assert.doesNotMatch(generating,/loadingSpinner/);assert.match(generating,/Kivo is typing/);
 const idle=renderToStaticMarkup(React.createElement(Loading,{restoring:false,busy:false,generating:false}));assert.doesNotMatch(idle,/loadingSpinner|preparing your response/);
 const restoring=renderToStaticMarkup(React.createElement(Loading,{restoring:true,busy:false,generating:false}));assert.match(restoring,/Loading your saved conversation/);
 const managing=renderToStaticMarkup(React.createElement(Loading,{restoring:false,busy:true,generating:false}));assert.match(managing,/Updating your conversation/);assert.doesNotMatch(managing,/preparing your response/);
});
