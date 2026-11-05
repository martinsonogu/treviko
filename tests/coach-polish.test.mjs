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
