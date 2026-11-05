import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {withAppRouter} from './app-router-fixture.mjs';
import {loadSource as load} from './load-source.mjs';
import {conversationId,userId,proposal,intent} from './conversation-fixture.mjs';
const actions=load('src/lib/coach/action-intent.ts');
const provider=load('src/lib/coach/provider.ts'),configModule=load('src/lib/coach/config.ts'),session=load('src/lib/auth/session.ts'),profiles=load('src/lib/profile/service.ts'),conversations=load('src/lib/persistence/conversations.ts'),shared=load('src/lib/persistence/shared-ai.ts'),admin=load('src/lib/supabase/admin.ts'),plans=load('src/lib/coaching/service.ts'),generation=load('src/lib/coaching/generation.ts'),workflow=load('src/lib/coaching/workflow.ts');
const {ApiError}=load('src/lib/api/http.ts');
const {persistentCoachHandler}=load('src/lib/persistence/coach-http.ts');
const config=configModule.getCoachConfig({NODE_ENV:'test',OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock'});
const saved={...load('src/lib/profile/schema.ts').emptyProfile(),equipment:['dumbbells'],trainingDays:2};
const render=(Component,props={})=>renderToStaticMarkup(withAppRouter(React.createElement(Component,props)));
async function stubs(entries,work){const old=entries.map(([object,key,value])=>{const before=object[key];object[key]=value;return [object,key,before];});try{return await work();}finally{for(const [object,key,value]of old.reverse())object[key]=value;}}
const request=(body)=>new Request('http://localhost/api/v1/coach/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId,conversationFirst:true,...body})});

test('intent routing requires explicit, safe plan intent; nutrition and preview revisions stay opt-in',()=>{
 const route=actions.proposalScopeForIntent;
 for(const value of [intent(),intent('training_plan',{explicitPlanRequest:false}),intent('nutrition_plan'),intent('training_plan',{safety:'injury'}),intent('training_plan',{injection:true}),intent('training_plan',{outcome:'unrelated'})])assert.equal(route(value,true),null);
 assert.equal(route(intent('training_plan'),false),'training_only');assert.equal(route(intent('exercise_substitution'),true),'training_only');assert.equal(route(intent('exercise_substitution'),false),null);
 assert.equal(route(intent('nutrition_plan',{nutritionRequested:true}),true),'nutrition_only');assert.equal(route(intent('combined_plan',{nutritionRequested:true}),false),'training_and_nutrition');
 assert.equal(actions.conversationIntentSchema.safeParse({...intent(),intent:'save_plan'}).success,false);
});
test('semantic routing uses metered structured output and distinguishes advice from explicit requests in instructions',async()=>{
 let captured;
 await stubs([[provider,'createStructuredCaller',()=>async(stage,schema,instructions,input)=>{captured={stage,instructions,input};return schema.parse(intent());}]],async()=>{await actions.classifyConversationAction({message:'How best can I bulk given my weight and height?',profile:{dietaryPreferences:'PRIVATE_DIET',foodBudget:'PRIVATE_BUDGET'},history:[]},null,config,{},new AbortController().signal);});
 assert.equal(captured.input.request.profile.dietaryPreferences,undefined);assert.equal(captured.input.request.profile.foodBudget,undefined);assert.equal(captured.stage,'scope');assert.match(captured.instructions,/How best can I bulk/);assert.match(captured.instructions,/bare yes\/confirm\/save/);assert.match(captured.instructions,/Saved dietary preferences\/history alone/);assert.equal(captured.input.request.message,'How best can I bulk given my weight and height?');
});
test('one message endpoint routes advice, creation, substitution and nutrition with one lease and no implicit publication',async()=>{
 let routed=intent(),activePlan=null,generated=0,appended=0,admitted=0,released=0;
 const context={userId,email:'owner@example.test',db:{}};
 const records=[];
 const entries=[
  [session,'requireUser',async()=>context],[profiles,'getProfile',async()=>({...saved,equipment:['dumbbells']})],[configModule,'getCoachConfig',()=>config],
  [conversations,'getConversation',async(owner,id)=>{assert.equal(owner.userId,userId);assert.equal(id,conversationId);return {id,messages:records};}],
  [shared,'acquireSharedRequest',async()=>{admitted++;return async()=>{released++;};}],[shared,'persistentUsageMonitor',()=>({reserve:async()=>async()=>{}})],
  [actions,'classifyConversationAction',async()=>routed],[plans,'getActivePlan',async()=>activePlan],[plans,'getProfileGuard',async()=>({saved:true})],
  [generation,'generatePlanProposal',async context=>{generated++;assert.equal(context.profile.goals.length,0);return {...proposal.payload,scope:context.scope,...(context.scope==='nutrition_only'?{days:[],meals:[{slot:1,name:'Lentil dinner',guidance:'Review ingredients and labels.',recipeId:null}]}:{})};}],
  [plans,'storeProposal',async(_owner,payload)=>({...proposal,payload})],[plans,'publishProposal',async()=>assert.fail('Messages cannot publish plans')],
  [admin,'createAdminSupabase',()=>({rpc:async(name)=>{assert.equal(name,'append_coach_turn');appended++;return {error:null};}})],
  [provider,'createOpenAIProvider',()=>({classify:async()=>assert.fail('Do not pay for a second chat classification'),generate:async()=>({message:'Use gradual progressive training and recovery. We can discuss your available time.',exerciseIds:[]}),review:async()=>({inScope:true,safe:true,groundedExercises:true,honestNutrition:true,private:true})})],
 ];
 await stubs(entries,async()=>{
  for(const message of ['How best can I bulk given my weight and height?','Explain my current workout.','How should I recover between sessions?','Yes, save it.']){routed=intent();const response=await persistentCoachHandler(request({message}));assert.equal(response.status,200);assert.equal((await response.json()).kind,undefined);}
  assert.equal(generated,0);
  routed=intent('training_plan');let response=await persistentCoachHandler(request({message:'Create a two-day muscle-building programme.'}));let body=await response.json();assert.equal(response.status,200);assert.equal(body.kind,'proposal');assert.equal(body.proposal.payload.scope,'training_only');assert.equal(body.proposal.payload.meals.length,0);
  activePlan={version:1,payload:proposal.payload};routed=intent('exercise_substitution');response=await persistentCoachHandler(request({message:'Replace lat pulldowns with a dumbbell exercise.'}));assert.equal((await response.json()).kind,'proposal');
  routed=intent('nutrition_plan',{nutritionRequested:true});response=await persistentCoachHandler(request({message:'Create a meal plan to support my workouts.'}));body=await response.json();assert.equal(body.proposal.payload.scope,'nutrition_only');
  assert.equal(generated,3);assert.equal(admitted,7);assert.equal(released,7);assert.equal(appended,7);
 });
});
test('unowned conversations and proposal references fail before routing, and safety preflight avoids paid classification',async()=>{
 let classified=0,generated=0;
 await stubs([[session,'requireUser',async()=>({userId,email:'owner@example.test',db:{}})],[configModule,'getCoachConfig',()=>config],[shared,'acquireSharedRequest',async()=>async()=>{}],[shared,'persistentUsageMonitor',()=>({})],[profiles,'getProfile',async()=>saved],[plans,'getActivePlan',async()=>null],[actions,'classifyConversationAction',async()=>{classified++;return intent('training_plan');}],[workflow,'proposePlan',async()=>{generated++;}],[conversations,'getConversation',async()=>{throw new ApiError(404,'NOT_FOUND','Conversation not found.');}]],async()=>{assert.equal((await persistentCoachHandler(request({message:'Create a plan.'}))).status,404);});
 assert.equal(classified,0);assert.equal(generated,0);
 const common=[[session,'requireUser',async()=>({userId,email:'owner@example.test',db:{}})],[configModule,'getCoachConfig',()=>config],[shared,'acquireSharedRequest',async()=>async()=>{}],[shared,'persistentUsageMonitor',()=>({})],[profiles,'getProfile',async()=>saved],[plans,'getActivePlan',async()=>null],[conversations,'getConversation',async()=>({id:conversationId,messages:[]})],[actions,'classifyConversationAction',async()=>assert.fail('Unsafe input must bypass paid routing')],[provider,'createOpenAIProvider',()=>assert.fail('Safety preflight must not instantiate a provider')],[admin,'createAdminSupabase',()=>({rpc:async()=>({error:null})})]];
 await stubs(common,async()=>{const response=await persistentCoachHandler(request({message:'I have severe chest pain while exercising.'}));const body=await response.json();assert.equal(response.status,200);assert.equal(body.status,'safety');});
});
test('an unconfirmed preview can be revised without an active plan and its source is ownership-checked',async()=>{
 let supplied;
 await stubs([[session,'requireUser',async()=>({userId,email:'owner@example.test',db:{}})],[configModule,'getCoachConfig',()=>config],[shared,'acquireSharedRequest',async()=>async()=>{}],[shared,'persistentUsageMonitor',()=>({})],[profiles,'getProfile',async()=>saved],[plans,'getActivePlan',async()=>null],[plans,'getProposal',async(_context,id)=>{assert.equal(id,proposal.id);return proposal;}],[conversations,'getConversation',async()=>({id:conversationId,messages:[]})],[actions,'classifyConversationAction',async()=>intent('plan_revision')],[workflow,'proposePlan',async(_context,body)=>{supplied=body;return {proposal,conversationId,historySaved:true};}]],async()=>{const response=await persistentCoachHandler(request({message:'Change this preview to two days.',proposalId:proposal.id}));assert.equal(response.status,200);assert.equal(supplied.proposalId,proposal.id);});
});
test('inline proposals are concise, unconfirmed, collapsible and preserve goal distinctions and confirmation',async()=>{
 const Inline=load('src/components/coach/InlineProposal.tsx').default;
 const html=render(Inline,{proposal,onConfirm(){},onReject(){},onChange(){}});
 assert.match(html,/PROPOSAL · NOT SAVED/);assert.match(html,/Confirm &amp; save/);assert.match(html,/Request changes/);assert.match(html,/Reject proposal/);assert.match(html,/<details class="inlineWorkout"><summary>/);assert.match(html,/Rest 90 seconds/);assert.match(html,/Preview substitution/);assert.match(html,/saved profile goal remains/);assert.match(html,/strength/);assert.doesNotMatch(html,/<details[^>]* open/);
 const {proposalExpired}=load('src/components/coach/InlineProposal.tsx');assert.equal(proposalExpired('2026-01-01',Date.parse('2026-02-01')),true);
 await stubs([[plans,'getProposal',async()=>({...proposal,expires_at:'2020-01-01'})],[plans,'publishProposal',async()=>assert.fail('Expired proposal published')]],async()=>{await assert.rejects(workflow.confirmPlan({userId,db:{}},proposal.id),error=>error.code==='PROPOSAL_UNAVAILABLE');});
 const confirmed=render(Inline,{proposal:{...proposal,status:'confirmed'},onConfirm(){},onReject(){},onChange(){}});assert.match(confirmed,/Explicitly confirmed and saved/);assert.doesNotMatch(confirmed,/Confirm &amp; save/);
});
test('conversation screen starts with messages and composer; secondary controls do not precede chat as forms',()=>{
 const html=render(load('src/components/coach/CoachChat.tsx').default,{initialProfile:{}});
 assert.match(html,/Open conversation history/);assert.match(html,/Your personal coach/);assert.match(html,/conversationMessages/);assert.match(html,/conversationComposer/);assert.ok(html.indexOf('conversationMessages')<html.indexOf('conversationComposer'));assert.ok(html.indexOf('conversationComposer')<html.indexOf('<dialog'));
 assert.doesNotMatch(html,/Use this message to propose|Create or adjust my training plan|PLAN WITH KIVO/);assert.match(html,/Privacy &amp; safety/);assert.match(html,/Ctrl\/⌘ \+ Enter/);
 const {savedChatEntries}=load('src/components/coach/conversation-state.ts');const content=`Proposed plan (not active): Original rationale\nReview proposal ${proposal.id} in the plan preview before confirming.`;const [entry]=savedChatEntries({messages:[{role:'assistant',content,response_mode:'live',response_status:'ok',exercises:[]}]});assert.equal(entry.text,content);assert.equal(entry.proposalId,proposal.id);
});
test('proposal retrieval route enforces authenticated ownership and private responses',async()=>{
 const GET=load('src/app/api/v1/coaching/plan/proposals/[id]/route.ts').GET;
 await stubs([[session,'requireUser',async request=>{if(!request.headers.has('authorization'))throw new session.AuthenticationError();return {userId:request.headers.get('authorization'),db:{}};}],[plans,'getProposal',async(context,id)=>{assert.equal(id,proposal.id);if(context.userId!==userId)throw new ApiError(404,'NOT_FOUND','Proposal not found.');return proposal;}]],async()=>{
  const path='http://localhost/api/v1/coaching/plan/proposals/'+proposal.id;
  assert.equal((await GET(new Request(path))).status,401);
  assert.equal((await GET(new Request(path,{headers:{authorization:'another-user'}}))).status,404);
  const response=await GET(new Request(path,{headers:{authorization:userId}}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json()).data.id,proposal.id);
 });
});
test('missing provider configuration fails before paid intent routing and releases admission',async()=>{
 let released=false;
 const missing={...config,apiKey:undefined};
 await stubs([[session,'requireUser',async()=>({userId,email:'owner@example.test',db:{}})],[configModule,'getCoachConfig',()=>missing],[shared,'acquireSharedRequest',async()=>async()=>{released=true;}],[shared,'persistentUsageMonitor',()=>({})],[profiles,'getProfile',async()=>saved],[plans,'getActivePlan',async()=>null],[conversations,'getConversation',async()=>({id:conversationId,messages:[]})],[actions,'classifyConversationAction',async()=>assert.fail('Missing key cannot route a paid request')]],async()=>{const response=await persistentCoachHandler(request({message:'Create my training plan.'}));assert.equal(response.status,503);assert.equal((await response.json()).error.code,'AI_NOT_CONFIGURED');assert.equal(released,true);});
});
