import {test} from 'node:test';
import {withAppRouter} from './app-router-fixture.mjs';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource as load} from './load-source.mjs';
const render=(Component,props={})=>renderToStaticMarkup(withAppRouter(React.createElement(Component,props)));

test('Coach names Kivo as AI, with a labelled input and no repeated scripted introduction',()=>{
 const Coach=load('src/components/coach/CoachChat.tsx').default;
 const html=render(Coach,{initialProfile:{}});
 assert.match(html,/<h1>Kivo<\/h1>/);assert.match(html,/Your personal coach/);assert.match(html,/· AI/);assert.match(html,/Message Kivo/);assert.match(html,/Ask Kivo about your training/);assert.match(html,/Open conversation history/);assert.match(html,/aria-label="Conversation with Kivo, your AI personal coach"/);
 assert.doesNotMatch(html,/I&#x27;m Kivo|I’m Kivo|Treviko · Live AI/);
});
test('Kivo avatar has an accessible standalone label and is decorative beside names',()=>{
 const Avatar=load('src/components/coach/KivoAvatar.tsx').default;
 const standalone=render(Avatar),decorative=render(Avatar,{decorative:true});
 assert.match(standalone,/role="img"/);assert.match(standalone,/aria-label="Kivo, your AI personal coach"/);assert.match(standalone,/focusable="false"/);
 assert.match(decorative,/aria-hidden="true"/);assert.doesNotMatch(decorative,/aria-label=|role="img"/);
});
test('restored historical messages retain exact contents and are displayed under the current Kivo identity',()=>{
 const {savedChatEntries}=load('src/components/coach/conversation-state.ts');
 const Message=load('src/components/coach/CoachMessage.tsx').default;
 const content='I am Treviko. Your saved workout uses dumbbells. <script>private</script>';
 const original={id:'old-chat',title:'Original title',messages:[{id:'old-message',role:'assistant',content,response_mode:'live',response_status:'ok',exercises:[]}]};
 const snapshot=JSON.stringify(original);const [entry]=savedChatEntries(original);
 assert.equal(entry.text,content);assert.equal(entry.id,'old-message');assert.equal(JSON.stringify(original),snapshot);
 const html=render(Message,{entry});assert.match(html,/Kivo · Live AI/);assert.match(html,/I am Treviko/);assert.match(html,/&lt;script&gt;private&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
 const user=render(Message,{entry:{role:'user',text:'My original request'}});assert.match(user,/>You<\/span>/);assert.doesNotMatch(user,/kivoAvatar/);
});
test('Treviko remains the app and Coach remains the navigation destination while Home introduces Kivo',async()=>{
 const {AppNavigation,primaryDestinations}=load('src/components/Nav.tsx');
 const {PublicLanding}=load('src/components/coaching/HomeContent.tsx');
 const manifest=load('src/app/manifest.ts').default();
 assert.equal(manifest.short_name,'Treviko');assert.deepEqual(primaryDestinations.find(d=>d.href==='/coach')?.label,'Coach');
 assert.match(render(AppNavigation,{pathname:'/coach'}),/href="\/coach"/);
 assert.match(render(PublicLanding),/Kivo, Treviko’s AI personal coach/);
 const response=await load('src/app/api/v1/health/route.ts').GET();assert.equal((await response.json()).app,'Treviko');
});
