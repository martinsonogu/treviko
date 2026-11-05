import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const OpenAI=createRequire(import.meta.url)('openai').default;
import {loadSource as load} from './load-source.mjs';
const {generatePlanProposal}=load('src/lib/coaching/generation.ts');
const {planCandidates}=load('src/lib/coaching/validation.ts');
const {emptyProfile}=load('src/lib/profile/schema.ts');
const {getCoachConfig}=load('src/lib/coach/config.ts');
const {proposalResponseSchema}=load('src/lib/coaching/schema.ts');
const {planFailure}=load('src/lib/coaching/errors.ts');
const profile={...emptyProfile(),experience:'intermediate',equipment:['dumbbells'],trainingDays:3,sessionMinutes:30,goals:['muscle_gain']};
const config=getCoachConfig({OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock'});
const draft={rationale:'A balanced starting option.',assumptions:[],experience:'intermediate',equipment:['dumbbells'],sessionMinutes:30,days:[1,3,5].map(weekday=>({weekday,name:'Training',exerciseIds:['shrug']})),meals:[{slot:1,name:'Lentils and vegetables',guidance:'Review ingredient labels and preparation.',recipeId:null}]};
const scope={category:'fitness',outcome:'allowed',topic:'mixed',safety:'none',injection:false,needsExercises:true,muscles:[]};
const review={inScope:true,safe:true,grounded:true,preferencesRespected:true,private:true};
const context={message:'Build my training and daily meals.',profile,existing:null,foods:[],recipes:[],history:[]};
function fixture(outputs=[draft]){
 const calls=[],reservations=[],settlements=[];let next=0;
 return {calls,reservations,settlements,monitor:{reserve:(tokens,limit,info)=>{reservations.push({tokens,limit,...info});return async(stage,model,success,usage)=>settlements.push({stage,model,success,usage});}},transport:{responses:{parse:async parameters=>{
  calls.push(parameters);const stage=parameters.text.format.name;
  if(stage==='treviko_scope')return {status:'completed',output_parsed:scope};
  if(stage==='treviko_review')return {status:'completed',output_parsed:review};
  const output=outputs[Math.min(next++,outputs.length-1)];
  if(output instanceof Error)throw output;
  if(typeof output==='function')return output(parameters);
  return {status:'completed',output_parsed:output,usage:{input_tokens:20,output_tokens:50}};
 }}}};
}
const generate=(mock,input=context,signal=new AbortController().signal)=>generatePlanProposal(input,config,mock.monitor,signal,mock.transport);
async function withLogs(work){const old=console.warn,logs=[];console.warn=line=>logs.push(JSON.parse(line));try{return await work(logs);}finally{console.warn=old;}}
test('generation schema exposes exact verified IDs, experience, equipment and nullable recipe choices',async()=>{
 const mock=fixture();const plan=await generate(mock);const schema=mock.calls[1].text.format.schema;
 assert.deepEqual(schema.properties.days.items.properties.exerciseIds.items.enum,planCandidates(profile).map(e=>e.id));
 assert.deepEqual(schema.properties.equipment.items.enum,['dumbbells']);
 assert.equal(JSON.stringify(schema.properties.experience).includes('intermediate'),true);
 assert.equal(schema.properties.meals.items.properties.recipeId.type,'null');assert.equal(schema.additionalProperties,false);
 assert.equal(plan.days.length,3);assert.equal(plan.meals[0].recipeId,null);assert.equal(mock.calls.length,3);
});
for(const [name,invalid] of [
 ['schema-invalid output',{bad:'PRIVATE_MODEL_TEXT'}],
 ['unknown exercise IDs',{...draft,days:[{...draft.days[0],exerciseIds:['not-in-library']}]}],
 ['equipment mismatch',{...draft,equipment:['bench']}],
 ['numerical meal claims',{...draft,meals:[{...draft.meals[0],guidance:'Contains 500 calories.'}]}],
])test(`${name} gets one metered repair and a full review before returning`,async()=>withLogs(async logs=>{
 const mock=fixture([invalid,draft]);const plan=await generate(mock);assert.equal(plan.days.length,3);assert.equal(mock.calls.length,4);assert.equal(mock.reservations.length,4);assert.equal(mock.settlements.length,4);
 assert.equal(mock.reservations.filter(r=>r.stage==='coach').length,2);assert.ok(mock.reservations.every(r=>r.limit===config.dailyTokenLimit));
 const retry=JSON.parse(mock.calls[2].input[0].content);assert.ok(retry.repairFeedback);assert.equal(JSON.stringify(retry).includes('PRIVATE_MODEL_TEXT'),false);
 assert.equal(logs.length,1);assert.equal(logs[0].outcome,'repairing');assert.equal(mock.calls[3].text.format.name,'treviko_review');
}));
test('two invalid responses fail with a specific category and never reach review',async()=>withLogs(async logs=>{
 const mock=fixture([{bad:'PRIVATE_MODEL_TEXT sk-secret-and-sensitive'}]);await assert.rejects(generate(mock),error=>error.code==='PLAN_OUTPUT_INVALID');assert.equal(mock.calls.length,3);assert.equal(mock.calls.some(c=>c.text.format.name==='treviko_review'),false);assert.equal(logs.length,2);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_MODEL_TEXT|sk-secret|sensitive/);
}));
test('missing preferences and nutrition data yield labelled defaults and qualitative meals',async()=>{
 const missing=emptyProfile(),bodyweight=planCandidates(missing)[0];const mock=fixture([{...draft,experience:'beginner',equipment:[],days:[{weekday:1,name:'Starting option',exerciseIds:[bodyweight.id]}]}]);
 const plan=await generate(mock,{...context,profile:missing});assert.deepEqual(plan.equipment,[]);assert.ok(plan.assumptions.some(a=>a.includes('Bodyweight')));assert.ok(plan.assumptions.some(a=>a.includes('not saved')));assert.equal(plan.meals[0].recipeId,null);assert.equal('nutrition' in plan.meals[0],false);
});
test('incomplete output gets at most one compact repair using the same output/token budget',async()=>withLogs(async()=>{
 const mock=fixture([()=>({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_parsed:null,usage:{input_tokens:20,output_tokens:1800}}),draft]);await generate(mock);const attempts=mock.calls.filter(c=>c.text.format.name==='treviko_coach');assert.equal(attempts.length,2);assert.ok(attempts.every(c=>c.max_output_tokens===config.maxOutputTokens));assert.equal(mock.settlements[1].success,false);assert.equal(mock.settlements[1].usage.outputTokens,1800);
}));
test('provider timeout aborts an unresponsive call, settles its reservation and does not retry',async()=>withLogs(async()=>{
 const mock=fixture([()=>new Promise(()=>{})]);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20);
 try{await assert.rejects(generate(mock,context,controller.signal),error=>error.code==='PLAN_PROVIDER_TIMEOUT'&&error.status===504);}finally{clearTimeout(timer);}
 assert.equal(mock.calls.filter(c=>c.text.format.name==='treviko_coach').length,1);assert.equal(mock.settlements.length,2);assert.equal(mock.settlements[1].success,false);assert.equal(mock.settlements[1].usage,null);
}));
for(const [status,expected] of [[400,'PLAN_PROVIDER_CONFIGURATION'],[401,'PLAN_PROVIDER_AUTH'],[429,'PLAN_PROVIDER_RATE_LIMITED']])test(`provider HTTP ${status} has a safe category and no automatic retry`,async()=>withLogs(async logs=>{
 const mock=fixture([OpenAI.APIError.generate(status,{message:'PRIVATE_DIAGNOSTIC sk-do-not-log',code:'private_code'},'PRIVATE_DIAGNOSTIC',new Headers())]);await assert.rejects(generate(mock),error=>error.code===expected&&!error.message.includes('PRIVATE_DIAGNOSTIC'));assert.equal(mock.calls.length,2);assert.equal(logs[0].httpStatus,status);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_DIAGNOSTIC|sk-do-not-log|private_code/);
}));
test('provider refusal is not retried or bypassed',async()=>withLogs(async()=>{
 const mock=fixture([()=>({status:'completed',output_parsed:null,output:[{type:'message',content:[{type:'refusal',refusal:'PRIVATE_REFUSAL'}]}]})]);await assert.rejects(generate(mock),error=>error.code==='PLAN_PROVIDER_REFUSAL');assert.equal(mock.calls.length,2);
}));
test('preview response schema rejects missing or malformed data before the UI can claim success',()=>{
 assert.equal(proposalResponseSchema.safeParse({proposal:{},conversationId:'bad'}).success,false);assert.equal(proposalResponseSchema.safeParse(null).success,false);
});
test('configuration validation is a server setting error, not a misleading user input error',()=>{
 let error;try{getCoachConfig({COACH_MAX_OUTPUT_TOKENS:'invalid'});}catch(caught){error=caught;}assert.equal(planFailure('configuration',error).code,'PLAN_CONFIGURATION_INVALID');
});

test('validation diagnostics contain only allowlisted paths and codes, never rejected values or unknown property names',async()=>withLogs(async logs=>{
 const {z}=createRequire(import.meta.url)('zod');const schema=z.object({days:z.array(z.object({exerciseIds:z.array(z.string())}).strict())}).strict();let error;try{schema.parse({days:[{exerciseIds:[{private:'PRIVATE_INPUT_VALUE'}]}],PRIVATE_KEY_NAME:'PRIVATE_INPUT_VALUE'});}catch(caught){error=caught;}
 load('src/lib/coaching/errors.ts').logPlanDiagnostic('validation',error);assert.equal(logs[0].stage,'validation');assert.ok(logs[0].issues.length);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_KEY_NAME|PRIVATE_INPUT_VALUE/);
}));
