import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource} from './load-source.mjs';
const {default:Indicator,typingLabel}=loadSource('src/components/coach/KivoTypingIndicator.tsx');
const Loading=loadSource('src/components/coach/CoachLoadingStatus.tsx').default;
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
test('typing bubble uses Kivo identity and three decorative dots; announcements have no animated characters',()=>{
 const html=render(Indicator,{});assert.match(html,/chatEntry coach typingEntry/);assert.match(html,/bubble coach typingBubble/);assert.match(html,/kivoAvatar/);assert.match(html,/Kivo is typing/);assert.match(html,/aria-hidden="true"/);assert.match(html,/<span class="typingDots"><span><\/span><span><\/span><span><\/span><\/span>/);
 const status=render(Loading,{restoring:false,busy:true,generating:true,typingLabel:typingLabel()});assert.match(status,/role="status"/);assert.match(status,/aria-live="polite"/);assert.match(status,/visuallyHidden/);assert.doesNotMatch(status,/typingDots|loadingSpinner/);
});
test('known UI operations have truthful preparation labels without claiming success',()=>{
 for(const [operation,word] of [['workout','workout'],['meals','meal plan'],['combined','training and meal plan']]){assert.match(render(Indicator,{operation}),new RegExp(`Kivo is preparing your ${word}`));assert.doesNotMatch(render(Indicator,{operation}),/ready|saved|complete/i);}
});
test('scroll tracking distinguishes following the conversation from reading older messages',()=>{
 const {nearConversationBottom}=loadSource('src/components/coach/conversation-scroll.ts');
 assert.equal(nearConversationBottom({scrollHeight:1000,scrollTop:600,clientHeight:400}),true);assert.equal(nearConversationBottom({scrollHeight:1000,scrollTop:540,clientHeight:400}),true);assert.equal(nearConversationBottom({scrollHeight:1000,scrollTop:100,clientHeight:400}),false);
});
