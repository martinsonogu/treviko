import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';
const limits=load('src/lib/coach/limits.ts'),shared=load('src/lib/persistence/shared-ai.ts'),admin=load('src/lib/supabase/admin.ts');
const config=load('src/lib/coach/config.ts').getCoachConfig({OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock'});
async function withAdmin(value,work){const old=admin.createAdminSupabase;admin.createAdminSupabase=()=>value;try{return await work();}finally{admin.createAdminSupabase=old;}}
test('shared controls preserve token, cost, rate and concurrency error categories without changing limits',async()=>{
 for(const code of ['TOKEN_BUDGET','COST_BUDGET','RATE_LIMITED','BUSY']){
  const calls=[];
  await withAdmin({rpc:async(name,parameters)=>{calls.push({name,parameters});return {data:null,error:{message:code}};}},async()=>{
   const operation=['TOKEN_BUDGET','COST_BUDGET'].includes(code)?()=>shared.persistentUsageMonitor('owner',config).reserve(11495,100000,{stage:'coach',model:'mock',maxOutput:1800}):()=>shared.acquireSharedRequest('owner','conversation',config);
   await assert.rejects(operation(),error=>{assert.equal(error.code,code);if(['TOKEN_BUDGET','COST_BUDGET'].includes(code)){assert.equal(error.resetAt,limits.nextBudgetReset());assert.ok(error.retryAfter>=1&&error.retryAfter<=86400);assert.match(limits.coachLimitMessage(error),/daily AI/);}else assert.equal(error.retryAfter,60);return true;});
  });
  if(code==='TOKEN_BUDGET'){assert.equal(calls[0].parameters.p_daily_tokens,100000);assert.equal(calls[0].parameters.p_input,9695);assert.equal(calls[0].parameters.p_output,1800);}
 }
});
test('daily retry uses the next UTC midnight, not an arbitrary minute or hour',()=>{
 const now=Date.parse('2026-11-05T17:31:00Z');assert.equal(limits.nextBudgetReset(now),'2026-11-06T00:00:00.000Z');assert.equal(limits.secondsUntilBudgetReset(now),23340);
 assert.equal(limits.secondsUntilBudgetReset(Date.parse('2026-11-05T23:59:59.200Z')),1);
 const {CoachUsageMonitor}=load('src/lib/coach/usage.ts');const monitor=new CoachUsageMonitor(()=>now);monitor.reserve(90,100)('coach','mock',true,{inputTokens:90,outputTokens:0},{});
 assert.throws(()=>monitor.reserve(11,100),error=>error.code==='TOKEN_BUDGET'&&error.retryAfter===23340&&error.resetAt==='2026-11-06T00:00:00.000Z');assert.equal(monitor.snapshot().committedTokens,90);
});
test('settlement sends actual provider usage and never retries or clears usage records',async()=>{
 const calls=[];
 await withAdmin({rpc:async(name,parameters)=>{calls.push({name,parameters});return {data:name==='reserve_ai_usage'?'11111111-1111-4111-8111-111111111111':null,error:null};}},async()=>{
  const finish=await shared.persistentUsageMonitor('owner',config).reserve(12000,100000,{stage:'coach',model:'mock',maxOutput:1800});
  await finish('coach','mock',true,{inputTokens:1981,outputTokens:66},{});
 });
 assert.deepEqual(calls.map(call=>call.name),['reserve_ai_usage','settle_ai_usage']);assert.equal(calls[1].parameters.p_input,1981);assert.equal(calls[1].parameters.p_output,66);
});
test('plan errors retain daily reset headers and distinct cost/rate messages',async()=>{
 const {planFailure}=load('src/lib/coaching/errors.ts'),{apiFailure}=load('src/lib/api/http.ts');
 for(const code of ['TOKEN_BUDGET','COST_BUDGET','RATE_LIMITED','BUSY']){
  const error=new limits.CoachLimitError(code,1234,'2026-11-06T00:00:00.000Z');const failure=planFailure('admission',error);const response=apiFailure(failure);const body=await response.json();assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'1234');assert.equal(body.error.code,code);
  if(code==='TOKEN_BUDGET')assert.match(body.error.message,/next response reservation/);if(code==='COST_BUDGET')assert.match(body.error.message,/cost budget/);if(code==='BUSY')assert.match(body.error.message,/still running/);
 }
});
