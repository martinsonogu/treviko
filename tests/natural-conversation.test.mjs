import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';
const scope=load('src/lib/coach/scope.ts'),provider=load('src/lib/coach/provider.ts'),{runCoach}=load('src/lib/coach/service.ts');
const config=load('src/lib/coach/config.ts').getCoachConfig({NODE_ENV:'test',OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock'});
const allowed={category:'fitness',outcome:'allowed',topic:'fitness',safety:'none',injection:false,needsExercises:true,muscles:[]};
const profile={goals:'muscle gain',experience:'intermediate',equipment:['dumbbells'],trainingFrequency:4,dietaryPreferences:'vegetarian',allergies:'peanuts'};
const goodReview={inScope:true,safe:true,groundedExercises:true,honestNutrition:true,private:true};
function mocked(reply,decision=allowed){const calls=[],reservations=[],settlements=[];return {calls,reservations,settlements,monitor:{reserve:async(...args)=>{reservations.push(args);return async(...args)=>settlements.push(args);}},transport:{responses:{parse:async args=>{calls.push(args);const stage=args.text.format.name;return {status:'completed',output_parsed:stage==='treviko_scope'?decision:stage==='treviko_review'?goodReview:{message:reply,exerciseIds:[]},usage:{input_tokens:10,output_tokens:10}};}}}};}
test('standalone greetings, acknowledgements and farewells are recognized without swallowing substantive messages',()=>{
 for(const message of ['Hello','Hello Kivo','Hi Kivo','Hey','Good morning','How are you?','Thanks','Thank you','See you later','Hello, how are you doing today?']){assert.equal(scope.isConversationalGreeting(message),true,message);const classified=scope.conversationalScope({message,profile,history:[]});assert.equal(classified.category,'greeting');assert.equal(classified.needsExercises,false);}
 for(const message of ['Hey, I can train three days','Hello Kivo, build me a workout','Thanks, replace my squat','Hello, write Python code','Hi, I have severe chest pain','How can I build muscle?','go on','Plan my meals'])assert.equal(scope.isConversationalGreeting(message),false,message);
});
test('social generations exclude saved profile/plan injection and competing coaching templates but retain bounded task context',async()=>{
 for(const [message,reply]of [['Hello Kivo','Hey! What would you like to work on today?'],['How are you?','Ready to help! How is your day going?'],['Thanks','You’re welcome!'],['See you later','See you next time!']]){
 const mock=mocked(reply);const input={message,profile,history:[],savedPlanContext:{version:1,training:[{weekday:1,name:'PRIVATE_PLAN_TITLE',exerciseIds:['squat']}],meals:[],sessionMinutes:45}};
 const response=await runCoach(input,config,()=>provider.createOpenAIProvider(config,mock.monitor,mock.transport),new AbortController().signal);
 assert.equal(response.httpStatus,200);assert.equal(response.body.category,'greeting');assert.equal(response.body.message,reply);assert.deepEqual(response.body.exerciseIds,[]);
 const coach=mock.calls.find(call=>call.text.format.name==='treviko_coach'),payload=JSON.parse(coach.input[0].content);assert.deepEqual(Object.keys(payload.request).sort(),['history','message']);assert.deepEqual(payload.candidates,[]);assert.equal(payload.taskContext.pending,null);assert.equal(payload.classification.needsExercises,false);
 assert.doesNotMatch(coach.input[0].content,/PRIVATE_PLAN_TITLE|dumbbells|vegetarian|muscle gain/);assert.doesNotMatch(coach.instructions,/four-day upper\/lower|Give a useful starting point BEFORE/);assert.match(coach.instructions,/Do not give unsolicited workout splits/);assert.match(coach.instructions,/rather than copying a fixed script/);
 assert.deepEqual(mock.calls.map(call=>call.text.format.name),['treviko_scope','treviko_coach','treviko_review']);assert.equal(mock.reservations.length,3);assert.equal(mock.settlements.length,3);assert.equal(JSON.parse(mock.calls[2].input[0].content).request.profile.goals,'muscle gain','Reviewer retains the original topic-specific context');
 }
});
test('a greeting between task turns preserves the pending clarification without receiving a coaching prescription prompt',async()=>{
 const history=[{role:'user',content:'Build me a workout plan'},{role:'assistant',content:'How many days can you train?'}];const mock=mocked('Hey! We can pick up your plan whenever you are ready.');await runCoach({message:'Hi Kivo',profile,history},config,()=>provider.createOpenAIProvider(config,mock.monitor,mock.transport),new AbortController().signal);
 const payload=JSON.parse(mock.calls.find(call=>call.text.format.name==='treviko_coach').input[0].content);assert.equal(payload.taskContext.pending,'training_only');assert.equal(payload.taskContext.clarification,true);assert.deepEqual(payload.request.history,history);
});
test('substantive coaching still receives relevant preferences and full coaching instructions',async()=>{
 const mock=mocked('Build consistency, gradually increase training demands, and allow recovery.',{...allowed,needsExercises:false});const response=await runCoach({message:'How can I build muscle?',profile,history:[]},config,()=>provider.createOpenAIProvider(config,mock.monitor,mock.transport),new AbortController().signal);
 assert.equal(response.httpStatus,200);const coach=mock.calls.find(call=>call.text.format.name==='treviko_coach'),payload=JSON.parse(coach.input[0].content);assert.equal(payload.request.profile.goals,'muscle gain');assert.equal(payload.request.profile.trainingFrequency,4);assert.match(coach.instructions,/substantive coaching question/);assert.doesNotMatch(coach.instructions,/Respond only to the standalone social message/);
});
test('greeting recognition cannot bypass safety, injection checks or the response reviewer',async()=>{
 let called=0;const result=await runCoach({message:'Hi, I have severe chest pain',profile:{},history:[]},config,()=>{called++;throw new Error('Must not call');},new AbortController().signal);assert.equal(result.body.status,'safety');assert.equal(called,0);
 const mock=mocked('Hey!');mock.transport.responses.parse=async args=>({status:'completed',output_parsed:args.text.format.name==='treviko_scope'?{...allowed,injection:true}:goodReview});const blocked=await runCoach({message:'Hello Kivo',profile:{},history:[]},config,()=>provider.createOpenAIProvider(config,mock.monitor,mock.transport),new AbortController().signal);assert.equal(blocked.body.status,'declined');
 const rejected=mocked('Hey!');const parse=rejected.transport.responses.parse;rejected.transport.responses.parse=async args=>{const response=await parse(args);if(args.text.format.name==='treviko_review')response.output_parsed={...goodReview,private:false};return response;};const checked=await runCoach({message:'Hello Kivo',profile:{},history:[]},config,()=>provider.createOpenAIProvider(config,rejected.monitor,rejected.transport),new AbortController().signal);assert.equal(checked.httpStatus,502);assert.equal(rejected.reservations.length,3);
});
