import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource} from './load-source.mjs';
import {proposal} from './conversation-fixture.mjs';
const ui=loadSource('src/components/coach/conversation-ui.ts');
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
test('conversation titles preserve the actual request, normalize whitespace and bound unicode length',()=>{
 assert.equal(ui.conversationTitleFromRequest('  Create\n my\tworkout. '),'Create my workout.');
 assert.equal(ui.conversationTitleFromRequest('a\u0000b'),'a b');
 assert.equal(ui.conversationTitleFromRequest('  '),'New conversation');
 assert.equal(ui.conversationTitleFromRequest('💪'.repeat(90)).length,80);assert.equal(Array.from(ui.conversationTitleFromRequest('a'+'💪'.repeat(90))).length,40);
});
test('history reconciliation keeps a locally created or renamed conversation during an initial fetch without duplicates',()=>{
 const rows=ui.mergeConversations([{id:'a',title:'Old title',updated_at:'2026-01-01'},{id:'b',title:'Earlier',updated_at:'2025-01-01'}],[{id:'a',title:'Local title',updated_at:'2026-01-02'},{id:'c',title:'Latest',updated_at:'2026-02-01'}]);
 assert.deepEqual(rows.map(row=>row.id),['c','a','b']);assert.equal(rows[1].title,'Local title');
});
test('restored references show one latest preview per proposal without conflating revisions',()=>{
 const indexes=ui.latestProposalIndexes([{proposalId:'one'},{role:'user',text:'change this'},{proposalId:'two'},{proposalId:'one',proposal:{id:'one'}}]);
 assert.equal(indexes.get('one'),3);assert.equal(indexes.get('two'),2);assert.equal(indexes.size,2);
});
test('stale previews show a fresh-preview action and never expose confirmation',()=>{
 const Inline=loadSource('src/components/coach/InlineProposal.tsx').default;
 const html=render(Inline,{proposal,stale:true,onConfirm(){},onReject(){},onChange(){}});
 assert.match(html,/EARLIER PROPOSAL/);assert.match(html,/saved plan changed/);assert.match(html,/Request a fresh preview/);assert.doesNotMatch(html,/Confirm &amp; save/);
});
test('history labels, active state, empty state and deletion disclosure are accessible',()=>{
 const History=loadSource('src/components/coach/ConversationHistory.tsx').default;
 const props={conversations:[],activeId:null,title:'',busy:false,loading:false,error:'',onNew(){},onResume(){},onRefresh(){},onTitle(){},onRename(){},onDelete(){}};
 assert.match(render(History,props),/No saved conversations yet/);
 const failed=render(History,{...props,error:'Try refreshing history.'});assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/No conversations match/);
 const html=render(History,{...props,activeId:'a',title:'Strength',conversations:[{id:'a',title:'Strength'}]});assert.match(html,/aria-current="true"/);assert.match(html,/Find a conversation/);assert.match(html,/Delete saved conversation/);assert.doesNotMatch(html,/>Delete conversation</);
});
test('settings expose temporary training preferences while keeping optional context secondary',()=>{
 const Preferences=loadSource('src/components/coach/CoachPreferences.tsx').default;
 const html=render(Preferences,{profile:{experience:'beginner',trainingFrequency:3},saved:true,expanded:true,onChange(){}});
 assert.match(html,/^<section/);assert.match(html,/Temporary coaching preferences/);assert.match(html,/only to this conversation/);assert.match(html,/Optional food preferences/);assert.match(html,/Additional training context/);assert.match(html,/value="beginner" selected/);
});

test('legacy title fallbacks skip greetings, assistant content and empty messages',()=>{
 const {substantiveConversationTitle}=loadSource('src/lib/coach/conversation-title.ts');
 assert.equal(substantiveConversationTitle([{role:'assistant',content:'Invented title'},{role:'user',content:'Hello!'},{role:'user',content:'  Build me a two-day workout. '}]),'Build me a two-day workout.');
 assert.equal(substantiveConversationTitle([]),undefined);assert.equal(ui.conversationTitleFromRequest('Hello!'),'New conversation');
});
test('legacy history enrichment is bounded, owner-scoped, read-only and preserves renamed titles',async()=>{
 const {listConversations}=loadSource('src/lib/persistence/conversations.ts');
 const owner='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333',c='44444444-4444-4444-8444-444444444444';
 const records=[{id:a,title:'New conversation'},{id:b,title:'My renamed chat'},{id:c,title:'New conversation'}].map(row=>({...row,created_at:'2026-01-01',updated_at:'2026-01-01'}));
 const calls=[];let index=0;const results=[{data:records,error:null},{data:[{id:a,coach_messages:[{role:'user',content:'Hi'},{role:'user',content:'Build a strength plan'}]},{id:c,coach_messages:[]}],error:null}];
 const db={from(table){const n=index++;calls.push([n,'from',table]);const query={then(resolve,reject){return Promise.resolve(results[n]).then(resolve,reject);}};for(const method of ['select','eq','in','order','limit'])query[method]=(...args)=>{calls.push([n,method,...args]);return query;};return query;}};
 const rows=await listConversations({userId:owner,db});assert.equal(rows[0].title,'New conversation');assert.equal(rows[0].displayTitle,'Build a strength plan');assert.equal(rows[1].title,'My renamed chat');assert.equal(rows[1].displayTitle,undefined);assert.equal(rows[2].historyState,'empty');
 assert.ok(calls.some(row=>row[0]===1&&row[1]==='eq'&&row[2]==='user_id'&&row[3]===owner));assert.deepEqual(calls.find(row=>row[1]==='in')[3],[a,c]);assert.ok(calls.some(row=>row[0]===1&&row[1]==='limit'&&row[2]===5&&row[3].referencedTable==='coach_messages'));
 results[1]={error:{message:'Unavailable'}};index=0;assert.deepEqual(await listConversations({userId:owner,db}),records);
});
test('goal labels preserve multiple saved goals without choosing a primary or rewriting their values',()=>{
 const Preferences=loadSource('src/components/coach/CoachPreferences.tsx').default;
 const goals='muscle gain; strength; recomposition; general fitness';
 const html=render(Preferences,{profile:{goals},expanded:true,saved:true,onChange(){assert.fail('Rendering cannot save preferences');}});
 for(const goal of goals.split('; '))assert.ok(html.includes(`<li>${goal}</li>`));assert.match(html,/No primary goal is specified/);assert.match(html,/value="muscle gain; strength; recomposition; general fitness"/);assert.match(html,/do not update Profile or saved plans/);
});
test('derived history titles remain searchable and empty conversations are distinguished',()=>{
 const History=loadSource('src/components/coach/ConversationHistory.tsx').default;
 const html=render(History,{conversations:[{id:'a',title:'New conversation',displayTitle:'A saved workout request'},{id:'b',title:'New conversation',historyState:'empty'}],activeId:null,title:'',busy:false,loading:false,error:'',onNew(){},onResume(){},onRefresh(){},onTitle(){},onRename(){},onDelete(){}});
 assert.match(html,/A saved workout request/);assert.match(html,/Empty conversation/);
});
test('history reconciliation retains derived fallbacks but clears them for a user rename',()=>{
 const derived={id:'a',title:'New conversation',displayTitle:'Earlier request',historyState:'untitled'};
 assert.equal(ui.mergeConversations([derived],[{id:'a',title:'New conversation'}])[0].displayTitle,'Earlier request');
 const renamed=ui.mergeConversations([derived],[{id:'a',title:'My chosen name'}])[0];assert.equal(renamed.title,'My chosen name');assert.equal(renamed.displayTitle,undefined);
});
