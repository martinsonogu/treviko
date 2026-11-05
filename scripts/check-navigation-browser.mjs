// Isolated shell layout checks with real CSS and navigation, without login or network requests.
// CHROME_BIN may point to another Chromium-compatible browser.
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {proposal as sampleProposal} from '../tests/conversation-fixture.mjs';
import {withAppRouter} from '../tests/app-router-fixture.mjs';
import {loadSource} from '../tests/load-source.mjs';
const {AppNavigation}=loadSource('src/components/Nav.tsx');
const Brand=loadSource('src/components/Brand.tsx').default;
const {ProfileSettingsLink}=loadSource('src/components/account/ProfileAvatar.tsx');
const profileLink=renderToStaticMarkup(React.createElement(ProfileSettingsLink,{displayName:'Alex Morgan'}));
const logo=(await readFile('public/branding/treviko-logo.png')).toString('base64');
const brand=renderToStaticMarkup(React.createElement(Brand)).replace('src="/branding/treviko-logo.png"',`src="data:image/png;base64,${logo}"`);
const coachFixture=process.env.NAV_FIXTURE==='coach';
const settingsFixture=process.env.NAV_FIXTURE==='settings';
const content=coachFixture?renderToStaticMarkup(withAppRouter(React.createElement(loadSource('src/components/coach/CoachChat.tsx').default,{initialProfile:{}}))):'<h1>Your training</h1><a class="textbutton" href="/training">← Exercise library</a>';
const settingsProfile={...loadSource('src/lib/profile/schema.ts').emptyProfile(),displayName:'Alex Morgan',experience:'intermediate',goals:['muscle_gain'],trainingDays:3,equipment:['dumbbells','bench','resistance-band','lat-pulldown-machine'],dietaryPattern:'vegetarian',cuisines:['Nigerian','Indian'],allergies:['peanuts'],onboardingComplete:true};
const settingsContent=settingsFixture?'<div class="stack settingsLayout"><header class="settingsHeader"><p class="eyebrow">YOUR ACCOUNT</p><h1>Profile &amp; settings</h1></header>'+renderToStaticMarkup(React.createElement(loadSource('src/components/account/SettingsOverview.tsx').default,{profile:settingsProfile,email:'alex.morgan.long.email.address@example.test'}))+renderToStaticMarkup(React.createElement(loadSource('src/components/account/SettingsPanel.tsx').default))+'</div>':'';
const render=variant=>renderToStaticMarkup(React.createElement(AppNavigation,{pathname:settingsFixture?'/settings':coachFixture?'/coach':'/training/exercises/dumbbell-shrug',variant}));
const css=await readFile('src/app/globals.css','utf8');
const profile=await mkdtemp(path.join(tmpdir(),'treviko-nav-'));
const browser=spawn(process.env.CHROME_BIN??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:['ignore','ignore','pipe']});
let socket;
try{
 const endpoint=await new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(new Error('Browser did not start within 20 seconds')),20000);
  browser.once('error',error=>{clearTimeout(timer);reject(error);});
  browser.stderr.on('data',chunk=>{output+=chunk;const found=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(found){clearTimeout(timer);resolve(found[1]);}});
 });
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map();
 socket.addEventListener('message',event=>{const result=JSON.parse(event.data);const entry=pending.get(result.id);if(entry){clearTimeout(entry.timer);pending.delete(result.id);if(result.error)entry.reject(new Error(result.error.message));else entry.resolve(result.result);}});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(new Error(`Browser command timed out: ${method}`));},10000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params,sessionId}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const command=(method,params)=>send(method,params,sessionId);
 const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
 await command('Page.enable');
 const {frameTree}=await command('Page.getFrameTree');
 for(const [width,safe] of [[375,0],[390,0],[430,0],[390,34],[768,34],[850,0],[1280,0]]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<850});
  await command('Page.setDocumentContent',{frameId:frameTree.frame.id,html:`<!doctype html><html style="--app-safe-bottom:${safe}px"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body><div class="shell authenticatedShell"><header class="topbar">${brand}${render('desktop')}${profileLink}</header><main class="main" id="main-content">${settingsFixture?settingsContent:coachFixture?content:content+'<div style="height:1400px"></div><form><label class="field">Workout notes<input autocomplete="off"></label><button id="last-action" class="button">Save workout</button></form>'}</main>${render('mobile')}</div></body></html>`});
  if(coachFixture){
   const sample=renderToStaticMarkup(React.createElement(loadSource('src/components/coach/CoachMessage.tsx').default,{entry:{role:'coach',text:'Here is your proposal. Review before saving.',response:{mode:'live'}}}))+renderToStaticMarkup(React.createElement(loadSource('src/components/coach/InlineProposal.tsx').default,{proposal:sampleProposal,onConfirm(){},onReject(){},onChange(){}}));
   await evaluate(`document.querySelector('.conversationMessages').innerHTML=${JSON.stringify(sample)};document.querySelector('.conversationForm button').disabled=false;document.querySelector('.conversationForm button').id='last-action'`);
   const layout=await evaluate(`({composer:document.querySelector('.conversationComposer').getBoundingClientRect().bottom,frame:document.querySelector('.coachConversation').getBoundingClientRect().bottom,scroll:document.documentElement.scrollHeight,height:innerHeight,forms:document.querySelectorAll('.conversationForm').length})`);
   assert.equal(layout.forms,1);assert.ok(layout.scroll<=layout.height+1,JSON.stringify(layout));
  }
  if(settingsFixture){
   await evaluate(`document.querySelector('.settingsSecondaryButton').id='last-action';document.querySelector('.settingsDeletion summary').focus()`);
   await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   assert.equal(await evaluate("document.querySelector('.settingsDeletion').open"),true,JSON.stringify(await evaluate("({focused:document.activeElement.tagName,text:document.activeElement.textContent?.slice(0,30)})")));
   const targets=await evaluate("[...document.querySelectorAll('.settingsRowLink,.profileSettingsLink,.settingsDeletion summary,.settingsSecondaryButton')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))");for(const target of targets){assert.ok(target.width>=44);assert.ok(target.height>=44);}
  }
  const metrics=await evaluate(`(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.scrollTo(0,document.documentElement.scrollHeight);await new Promise(r=>requestAnimationFrame(r));const visible=[...document.querySelectorAll('.appNav')].filter(n=>getComputedStyle(n).display!=='none');const nav=visible[0],rect=nav.getBoundingClientRect(),action=document.querySelector('#last-action');action.focus();return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,visible:visible.length,variant:nav.className,navTop:rect.top,navBottom:rect.bottom,navHeight:rect.height,actionBottom:action.getBoundingClientRect().bottom,active:[...nav.querySelectorAll('[aria-current="page"]')].map(a=>a.textContent),targets:[...nav.querySelectorAll('a')].map(a=>({width:a.getBoundingClientRect().width,height:a.getBoundingClientRect().height})),bottomPadding:parseFloat(getComputedStyle(nav).paddingBottom)};})()`);
  assert.equal(metrics.width,width);assert.equal(metrics.overflow,false);assert.equal(metrics.visible,1);assert.deepEqual(metrics.active,settingsFixture?[]:[coachFixture?'Coach':'Training']);
  if(coachFixture){const identity=await evaluate(`({name:document.querySelector('.conversationIdentity h1').textContent,avatarWidth:document.querySelector('.conversationIdentity .kivoAvatar').getBoundingClientRect().width,messageWidth:document.querySelector('.chatSpeaker .kivoAvatar').getBoundingClientRect().width})`);assert.equal(identity.name,'Kivo');assert.equal(identity.avatarWidth,36);assert.equal(identity.messageWidth,24);}
  assert.ok(metrics.variant.includes(width<850?'mobile':'desktop'));
  for(const target of metrics.targets){assert.ok(target.width>=44);assert.ok(target.height>=44);}
  if(width<850){assert.ok(metrics.actionBottom<=metrics.navTop-16,JSON.stringify(metrics));assert.equal(metrics.navBottom,844);assert.equal(metrics.navHeight,72+safe);assert.equal(metrics.bottomPadding,6+safe);
   await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   assert.equal(await evaluate('document.activeElement.textContent'),'Home');
   assert.equal(await evaluate("document.activeElement.matches(':focus-visible')"),true);
  }
  if(process.env.NAV_SCREENSHOT_DIR&&safe===0&&(width===390||width===1280)){
   await evaluate('window.scrollTo(0,0)');
   const screenshot=await command('Page.captureScreenshot',{format:'png'});await mkdir(process.env.NAV_SCREENSHOT_DIR,{recursive:true});await writeFile(path.join(process.env.NAV_SCREENSHOT_DIR,`navigation-${width}.png`),Buffer.from(screenshot.data,'base64'));
  }
  if(coachFixture){
   await evaluate(`document.querySelector('[aria-label="Open conversation history"]').focus();document.querySelector('dialog').showModal()`);
   assert.equal(await evaluate(`document.querySelector('dialog').open`),true);
   await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   assert.equal(await evaluate(`document.querySelector('dialog').open`),false);
   if(width<850){
    await command('Emulation.setDeviceMetricsOverride',{width,height:500,deviceScaleFactor:1,mobile:true});
    await evaluate(`document.documentElement.classList.add('coachKeyboardOpen');document.querySelector('.conversationForm textarea').value='A longer message\\n'.repeat(6)`);
    const keyboard=await evaluate(`(async()=>{await new Promise(r=>requestAnimationFrame(r));return {bottom:document.querySelector('.conversationComposer').getBoundingClientRect().bottom,width:document.documentElement.scrollWidth,textarea:document.querySelector('.conversationForm textarea').getBoundingClientRect().height,scroll:document.documentElement.scrollHeight,height:innerHeight};})()`);
    assert.ok(keyboard.bottom<=500,JSON.stringify(keyboard));assert.ok(keyboard.scroll<=keyboard.height+1,JSON.stringify(keyboard));assert.ok(keyboard.width<=width);assert.ok(keyboard.textarea<=136);
    await evaluate(`document.documentElement.classList.remove('coachKeyboardOpen')`);
   }
  }
  console.log(`Passed ${settingsFixture?'settings · ':''}${width}px${safe?' + simulated '+safe+'px bottom inset':''}: navigation, active route, touch targets, overflow and content clearance`);
 }
 await send('Browser.close');
}finally{
 socket?.close();browser.kill();
 await new Promise(resolve=>{if(browser.exitCode!==null)resolve();else{browser.once('exit',resolve);setTimeout(resolve,2000).unref();}});
 await rm(profile,{recursive:true,force:true});
}
