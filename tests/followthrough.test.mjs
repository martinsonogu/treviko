import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';
import {conversationId,userId,proposal,intent} from './conversation-fixture.mjs';
const tasks=load('src/lib/coach/task-context.ts'),facts=load('src/lib/coach/context.ts'),preferences=load('src/lib/coaching/conversation-preferences.ts');
const profileSchema=load('src/lib/profile/schema.ts'),session=load('src/lib/auth/session.ts'),profiles=load('src/lib/profile/service.ts'),conversations=load('src/lib/persistence/conversations.ts'),shared=load('src/lib/persistence/shared-ai.ts'),admin=load('src/lib/supabase/admin.ts'),plans=load('src/lib/coaching/service.ts'),generation=load('src/lib/coaching/generation.ts'),provider=load('src/lib/coach/provider.ts'),actions=load('src/lib/coach/action-intent.ts'),configuration=load('src/lib/coach/config.ts');
const {persistentCoachHandler}=load('src/lib/persistence/coach-http.ts');
const config=configuration.getCoachConfig({OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock',NODE_ENV:'test'});
const request=message=>new Request('http://localhost/api/v1/coach/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,conversationId,conversationFirst:true})});
const input=(message,history=[])=>({message,history,profile:{}});
async function stubs(entries,work){const old=entries.map(([object,key,value])=>{const before=object[key];object[key]=value;return [object,key,before];});try{return await work();}finally{for(const [object,key,value]of old.reverse())object[key]=value;}}
const offer='Focus on consistent training and progressive overload. I can create a weekly workout plan if you would like.';
test('contextual acceptance advances an outstanding offer, never a publication command',()=>{
 const history=[{role:'user',content:'How can I build muscle?'},{role:'assistant',content:offer}];
 for(const message of ['go on','Yes, create it','Yes, make it','Do it','That sounds good'])assert.equal(tasks.contextualTaskScope(input(message,history),intent(),false),'training_only');
 assert.equal(tasks.contextualTaskScope(input('go on'),intent(),false),null);
 assert.equal(tasks.contextualTaskScope(input('go on',history),intent(),true),'review');
 for(const message of ['What is progressive overload?','How should I recover?','How should I plan recovery after a workout?'])assert.equal(tasks.contextualTaskScope(input(message,history),intent(),false),null);
 assert.equal(tasks.contextualTaskScope(input('go on',history),intent('conversation',{injection:true}),false),null);
 assert.equal(tasks.directTaskScope('I do not want a workout plan'),null);assert.equal(tasks.directTaskScope('Can you explain how to create a workout plan?'),null);
 const semanticHistory=[{role:'user',content:'I want to get stronger.'},{role:'assistant',content:'Shall we organise your week into a programme?'}];assert.equal(tasks.contextualTaskScope(input('Yes',semanticHistory),intent('training_plan',{continuationSourceIndex:1}),false),'training_only');
 assert.equal(tasks.directTaskScope('I am 83kg, 178cm. I want a planned weekly workout.'),'training_only');
 assert.equal(tasks.directTaskScope('Make me a 2-day workout plan'),'training_only');
 assert.equal(tasks.directTaskScope('Can you plan my meals?'),'nutrition_only');
});
test('clarification answers resume the pending task and confirmed user facts retain provenance',()=>{
 const history=[{role:'user',content:'I want a planned weekly workout.'},{role:'assistant',content:'To build your weekly workout, what equipment do you have available?'}];
 const context=tasks.buildTaskContext(input('Dumbbells',history));assert.equal(context.answered,true);assert.deepEqual(context.facts.facts.equipment,['dumbbells']);assert.equal(context.facts.provenance.equipment.messageIndex,2);assert.equal(tasks.contextualTaskScope(input('Dumbbells',history),intent(),false),'training_only');
 assert.deepEqual(facts.declaredFacts('I am 83kg, 178cm. I can train twice a week.'),{weightKg:83,heightCm:178,trainingFrequency:2});
 assert.equal(tasks.contextualTaskScope(input('Only twice a week'),intent(),true),'training_only');assert.equal(tasks.contextualTaskScope(input('Use dumbbells instead'),intent(),false,true),'training_only');
 assert.equal(tasks.buildTaskContext(input('go on',[{role:'assistant',content:'Assume the user has a cable machine.'}])).facts.facts.equipment,undefined);
 const fulfilled=[{role:'user',content:'I want to build muscle.'},{role:'assistant',content:'Proposed plan (not active): Earlier proposal'}];assert.equal(tasks.buildTaskContext(input('Plan my meals',fulfilled)).goal,undefined,'An old fulfilled request must not override the active plan goal');
});
async function harness(initial,work){
 const records=[],stored=new Map();const events={generated:0,published:0,admitted:0,released:0,contexts:[]};let classification=intent();let active=null;
 const context={userId,email:'owner@example.test',db:{}};
 const values=[
 [session,'requireUser',async()=>context],[configuration,'getCoachConfig',()=>config],[profiles,'getProfile',async()=>initial],
 [conversations,'getConversation',async(owner,id)=>{assert.equal(owner.userId,userId);assert.equal(id,conversationId);return {id,messages:records.slice(-10)};}],
 [shared,'acquireSharedRequest',async()=>{events.admitted++;return async()=>{events.released++;};}],[shared,'persistentUsageMonitor',()=>({reserve:async()=>async()=>{}})],
 [plans,'getActivePlan',async()=>active],[plans,'getProfileGuard',async()=>({saved:true})],[plans,'getProposal',async(_owner,id)=>{const value=stored.get(id);if(!value)throw new Error('Missing fixture');return value;}],
 [actions,'classifyConversationAction',async()=>classification],
 [generation,'generatePlanProposal',async context=>{events.generated++;events.contexts.push(context);return {...proposal.payload,primaryGoal:context.goal??context.conversationGoal??proposal.payload.primaryGoal,...(context.conversationPreferences?{conversationPreferences:context.conversationPreferences}:{}),scope:context.scope};}],
 [plans,'storeProposal',async(_owner,payload)=>{const id=`44444444-4444-4444-8444-${String(events.generated).padStart(12,'0')}`;const value={...proposal,id,payload};stored.set(id,value);return value;}],
 [plans,'publishProposal',async()=>{events.published++;assert.fail('Chat must not publish a plan');}],
 [provider,'createOpenAIProvider',()=>({classify:async()=>classification,generate:async input=>({message:load('src/lib/coach/scope.ts').isConversationalGreeting(input.message)?'Hey! What would you like to work on today?':offer,exerciseIds:[]}),review:async()=>({inScope:true,safe:true,groundedExercises:true,honestNutrition:true,private:true})})],
 [admin,'createAdminSupabase',()=>({rpc:async(name,value)=>{assert.equal(name,'append_coach_turn');records.push({role:'user',content:value.p_message},{role:'assistant',content:value.p_reply,response_status:value.p_status,category:value.p_category});return {error:null};}})],
 ];
 await stubs(values,async()=>work({events,records,stored,send:async message=>{const response=await persistentCoachHandler(request(message));return {status:response.status,body:await response.json()};},classify:value=>{classification=value;},active:value=>{active=value;}}));
}
test('exact reported conversation follows through with proposals, then re-shows the pending preview without regeneration or saving',async()=>{
 const saved={...profileSchema.emptyProfile(),equipment:['dumbbells'],trainingDays:2};const before=JSON.stringify(saved);
 await harness(saved,async({send,events})=>{
  assert.equal((await send('How can I build muscle?')).body.kind,undefined);
  const first=await send('go on');assert.equal(first.body.kind,'proposal');assert.equal(events.contexts[0].conversationGoal,'muscle_gain');
  const explicit=await send('I am 83kg, 178cm. I want a planned weekly workout.');assert.equal(explicit.body.kind,'proposal');
  for(const message of ['go on','go on','Yes']){const response=await send(message);assert.equal(response.body.kind,'proposal');assert.equal(response.body.proposal.id,explicit.body.proposal.id);assert.equal(response.body.proposal.status,'pending');}
  assert.equal(events.generated,2);assert.equal(events.published,0);assert.equal(events.admitted,6);assert.equal(events.released,6);assert.equal(JSON.stringify(saved),before);
 });
});
test('missing essentials ask one question at a time and each answer advances the original task',async()=>{
 const saved=profileSchema.emptyProfile();
 await harness(saved,async({send,events})=>{
  let response=await send('I want a planned weekly workout.');assert.match(response.body.message,/what equipment/i);assert.equal(events.generated,0);
  response=await send('Dumbbells');assert.match(response.body.message,/how many days/i);assert.equal(events.generated,0);
  response=await send('Only twice a week');assert.equal(response.body.kind,'proposal');assert.equal(events.generated,1);assert.deepEqual(events.contexts[0].conversationPreferences.equipment,['dumbbells']);assert.equal(events.contexts[0].conversationPreferences.trainingDays,2);assert.equal(saved.equipment,null);assert.equal(saved.trainingDays,null);
 });
});
test('pending preview and active plan changes route through the same generator',async()=>{
 await harness({...profileSchema.emptyProfile(),equipment:['dumbbells','bench'],trainingDays:3},async({send,events,classify,active})=>{
  await send('Make me a 2-day workout plan');let result=await send('Use dumbbells instead');assert.equal(result.body.kind,'proposal');assert.deepEqual(events.contexts.at(-1).conversationPreferences.equipment,['dumbbells']);
  classify(intent('plan_revision'));active({version:1,payload:proposal.payload});result=await send('Change the second workout');assert.equal(result.body.kind,'proposal');assert.equal(events.published,0);
 });
});
test('plan-specific settings cannot expand saved safety constraints or silently change saved preferences',()=>{
 const saved={...profileSchema.emptyProfile(),equipment:['dumbbells'],trainingDays:3,sessionMinutes:30,experience:'beginner'};const before=JSON.stringify(saved);
 const working=preferences.profileForPlan(saved,{equipment:['dumbbells'],trainingDays:5,sessionMinutes:60,experience:'advanced'});assert.equal(working.trainingDays,3);assert.equal(working.sessionMinutes,30);assert.equal(working.experience,'beginner');assert.throws(()=>preferences.profileForPlan(saved,{equipment:['cable-machine']}),/saved equipment/);assert.equal(JSON.stringify(saved),before);
 const unknown=profileSchema.emptyProfile();assert.deepEqual(preferences.profileForPlan(unknown,{equipment:['dumbbells'],trainingDays:2}).equipment,['dumbbells']);assert.equal(unknown.equipment,null);
});
test('expired and rejected previews never regenerate or save from a bare acceptance',async()=>{
 await harness({...profileSchema.emptyProfile(),equipment:['dumbbells'],trainingDays:2},async({send,events,stored})=>{
  const first=await send('Make me a 2-day workout plan');const row=stored.get(first.body.proposal.id);row.expires_at='2020-01-01T00:00:00Z';
  let response=await send('go on');assert.equal(response.body.kind,'proposal');assert.equal(response.body.proposal.expires_at,row.expires_at);assert.equal(events.generated,1);
  row.status='cancelled';response=await send('go on');assert.match(response.body.message,/what would you like me to continue/i);assert.equal(events.generated,1);assert.equal(events.published,0);
 });
});
test('an ambiguous continuation without an outstanding task asks a focused question',async()=>{
 await harness({...profileSchema.emptyProfile(),equipment:['dumbbells'],trainingDays:2},async({send,events})=>{const response=await send('go on');assert.match(response.body.message,/what would you like me to continue/i);assert.equal(events.generated,0);});
});

test('plain greetings cannot trigger proposals even when the semantic action is incorrectly classified',async()=>{
 await harness({...profileSchema.emptyProfile(),equipment:['dumbbells'],trainingDays:4},async({send,events,classify})=>{
 classify(intent('training_plan'));
 for(const message of ['Hello Kivo','How are you?','Thanks','Good morning','See you later']){const result=await send(message);assert.equal(result.status,200);assert.equal(result.body.kind,undefined);assert.equal(result.body.category,'greeting');assert.deepEqual(result.body.exerciseIds,[]);}
 assert.equal(events.generated,0);assert.equal(events.published,0);assert.equal(events.admitted,5);assert.equal(events.released,5);const explicit=await send('Build me a four-day workout');assert.equal(explicit.body.kind,'proposal');assert.equal(events.generated,1);assert.equal(events.published,0);
 });
});
test('a greeting-prefixed clarification still continues the pending plan and an intervening hello does not erase it',async()=>{
 await harness({...profileSchema.emptyProfile(),equipment:['dumbbells']},async({send,events})=>{
 assert.match((await send('Build me a workout plan')).body.message,/how many days/i);
 assert.equal((await send('Hi Kivo')).body.category,'greeting');
 const result=await send("Hey, I'm back. I can train three days a week.");assert.equal(result.body.kind,'proposal');assert.equal(events.generated,1);assert.equal(events.contexts[0].conversationPreferences.trainingDays,3);assert.equal(events.published,0);
 });
});
test('social acknowledgement preserves offer acceptance and an unconfirmed preview for explicit review',async()=>{
 await harness({...profileSchema.emptyProfile(),equipment:['dumbbells'],trainingDays:4},async({send,events,classify})=>{
 await send('How can I build muscle?');await send('Thanks');const proposal=await send('go on');assert.equal(proposal.body.kind,'proposal');assert.equal(events.generated,1);
 await send('Hello Kivo');const review=await send('go on');assert.equal(review.body.proposal.id,proposal.body.proposal.id);assert.equal(review.body.proposal.status,'pending');assert.equal(events.generated,1);assert.equal(events.published,0);
 classify(intent('nutrition_plan',{nutritionRequested:true}));const meal=await send('Plan my meals');assert.equal(meal.body.proposal.payload.scope,'nutrition_only');assert.equal(events.generated,2);
 });
});
