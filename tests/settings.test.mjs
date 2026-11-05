import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource as load} from './load-source.mjs';
const render=(Component,props={})=>renderToStaticMarkup(React.createElement(Component,props));
const avatar=load('src/components/account/ProfileAvatar.tsx');
const profileService=load('src/lib/profile/service.ts');
const pageUser=load('src/lib/auth/page-user.ts');
const session=load('src/lib/auth/session.ts');
const {emptyProfile}=load('src/lib/profile/schema.ts');
const Overview=load('src/components/account/SettingsOverview.tsx').default;
const {signOutAccount}=load('src/components/account/sign-out.ts');
async function stubs(entries,work){const prior=entries.map(([object,key,value])=>{const old=object[key];object[key]=value;return [object,key,old];});try{return await work();}finally{for(const [object,key,value]of prior.reverse())object[key]=value;}}

test('profile initials support saved names and neutral fallbacks, distinct from the AI avatar',()=>{
 for(const [name,expected] of [['Alex Morgan','AM'],['  Alex  ','A'],['Éva María Silva','ÉS'],['李 明','李明'],['',''],['   ',''],['🌿 --','']])assert.equal(avatar.profileInitials(name),expected);
 const link=render(avatar.ProfileSettingsLink,{displayName:'Alex Morgan'});assert.match(link,/href="\/settings"/);assert.match(link,/aria-label="Open profile and settings"/);assert.match(link,/>AM<\/span>/);assert.doesNotMatch(link,/kivoAvatar|<img/);
 const fallback=render(avatar.default);assert.match(fallback,/role="img"/);assert.match(fallback,/aria-label="Your profile avatar"/);assert.match(fallback,/<svg/);assert.doesNotMatch(fallback,/kivoAvatar/);
});
test('authenticated header reads only the owner’s saved display name and never shows email',async()=>{
 const calls=[];const query={select:fields=>{calls.push(fields);return query;},eq:(field,value)=>{calls.push([field,value]);return query;},single:async()=>({data:{display_name:'Alex Morgan'},error:null})};
 const context={userId:'owner-id',email:'private@example.test',db:{from:table=>{calls.push(table);return query;}}};
 const Frame=load('src/components/layout/ExperienceFrame.tsx').default;
 await stubs([[pageUser,'getPageUser',async()=>context]],async()=>{const html=renderToStaticMarkup(await Frame({children:'Content'}));assert.match(html,/>AM<\/span>/);assert.match(html,/href="\/settings"/);assert.match(html,/Open profile and settings/);assert.doesNotMatch(html,/private@example.test|Account &amp; sign out/);});
 assert.deepEqual(calls,['profiles','display_name',['user_id','owner-id']]);
 await stubs([[pageUser,'getPageUser',async()=>context],[profileService,'getProfileDisplayName',async()=>{throw new Error('Unavailable');}]],async()=>{const html=renderToStaticMarkup(await Frame({children:'Content'}));assert.match(html,/profileAvatar[^>]*><svg/);assert.match(html,/Open profile and settings/);});
 await stubs([[pageUser,'getPageUser',async()=>null]],async()=>{const html=renderToStaticMarkup(await Frame({children:'Public'}));assert.doesNotMatch(html,/profileAvatar|Open profile and settings|Mobile navigation/);assert.match(html,/Public navigation/);});
});
test('settings renders real saved preferences and links all editing to the existing profile editor',()=>{
 const profile={...emptyProfile(),displayName:'Alex Morgan',goals:['muscle_gain'],experience:'intermediate',trainingDays:3,equipment:['dumbbells'],dietaryPattern:'vegetarian',cuisines:['Nigerian'],dislikes:['Okra'],allergies:['peanuts'],onboardingComplete:true};
 const html=render(Overview,{profile,email:'alex@example.test'});
 for(const value of ['Alex Morgan','alex@example.test','muscle gain','intermediate','3 per week','dumbbells','vegetarian','Nigerian','Okra','peanuts','Preferences saved'])assert.ok(html.includes(value),value);
 assert.equal((html.match(/href="\/profile"/g)??[]).length,3);assert.doesNotMatch(html,/href="\/account"/);
 const empty=render(Overview,{profile:emptyProfile(),email:''});assert.match(empty,/Not set/);assert.match(empty,/Onboarding in progress/);assert.doesNotMatch(empty,/Bodyweight only|3 per week|Preferences saved/);
 const bodyweight=render(Overview,{profile:{...emptyProfile(),equipment:[]},email:''});assert.match(bodyweight,/Bodyweight only/);
 const unavailable=render(Overview,{profile:null,email:'alex@example.test'});assert.match(unavailable,/role="alert"/);assert.match(unavailable,/preferences could not load/);assert.doesNotMatch(unavailable,/Onboarding in progress|Preferences saved|Bodyweight only/);
});
test('settings route verifies identity before reading saved preferences and preserves account actions on profile failure',async()=>{
 const Page=load('src/app/(experience)/settings/page.tsx').default;
 const content=Page().props.children[1].props.children;
 const context={userId:'owner',email:'owner@example.test',db:{}};const calls=[];
 await stubs([[session,'requirePageUser',async destination=>{calls.push(destination);return context;}],[profileService,'getProfile',async owner=>{assert.equal(owner,context);return emptyProfile();}]],async()=>{const html=renderToStaticMarkup(await content.type());assert.match(html,/owner@example.test/);assert.match(html,/Privacy &amp; account/);assert.match(html,/Sign out/);});assert.deepEqual(calls,['/settings']);
 await stubs([[session,'requirePageUser',async()=>{throw new session.AuthenticationError();}],[profileService,'getProfile',async()=>{assert.fail('Anonymous profile read');}]],async()=>{await assert.rejects(content.type(),session.AuthenticationError);});
 await stubs([[session,'requirePageUser',async()=>context],[profileService,'getProfile',async()=>{throw new Error('Database unavailable');}]],async()=>{const html=renderToStaticMarkup(await content.type());assert.match(html,/preferences could not load/);assert.match(html,/Request a password reset/);assert.match(html,/Delete account/);assert.match(html,/Sign out/);});
});
test('security and deletion remain discoverable, labelled and guarded by explicit confirmation',()=>{
 const html=render(load('src/components/account/SettingsPanel.tsx').default);
 assert.match(html,/href="\/forgot-password"/);assert.match(html,/<h2[^>]*>Security/);assert.match(html,/<h2[^>]*>Privacy &amp; account/);assert.match(html,/<details class="settingsDeletion"><summary>Delete account<\/summary>/);
 assert.match(html,/cannot be undone/);assert.match(html,/coaching plans/);assert.match(html,/autoComplete="current-password"/i);assert.match(html,/Type DELETE MY ACCOUNT/);assert.match(html,/aria-describedby="delete-warning"/);assert.match(html,/<button[^>]*disabled=""[^>]*>Permanently delete my account/);assert.match(html,/<button type="button" class="settingsSecondaryButton"[^>]*>Sign out/);
});
test('sign out reuses the current endpoint, supports browser fetch and navigates only after confirmed success',async()=>{
 const navigation=[],calls=[];
 function request(url,options){assert.equal(this,undefined);calls.push([url,options.method]);return Promise.resolve(Response.json({data:{signedOut:true}}));}
 await signOutAccount({request,navigate:path=>navigation.push(path)});assert.deepEqual(calls,[['/api/v1/auth/logout','POST']]);assert.deepEqual(navigation,['/login']);
 for(const request of [async()=>Response.json({data:{}}, {status:200}),async()=>Response.json({error:{message:'PRIVATE_DIAGNOSTIC'}},{status:503}),async()=>{throw new Error('PRIVATE_DIAGNOSTIC');}]){
  await assert.rejects(signOutAccount({request,navigate:()=>assert.fail('Failed sign-out redirected')}),error=>!error.message.includes('PRIVATE_DIAGNOSTIC'));
 }
});
