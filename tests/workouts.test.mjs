import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource as load} from './load-source.mjs';
import {withAppRouter} from './app-router-fixture.mjs';
import {proposal,userId} from './conversation-fixture.mjs';
const cache=load('src/lib/workouts/cache.ts');
const schema=load('src/lib/workouts/schema.ts'),service=load('src/lib/workouts/service.ts'),plans=load('src/lib/coaching/service.ts'),admin=load('src/lib/supabase/admin.ts'),auth=load('src/lib/auth/session.ts');
const plan={id:'77777777-7777-4777-8777-777777777777',version:1,status:'active',payload:proposal.payload};
const snapshot=service.snapshotDay(plan,1),performance=schema.emptyPerformance(snapshot);
const session={id:'88888888-8888-4888-8888-888888888888',plan_id:plan.id,plan_version:1,weekday:1,status:'in_progress',snapshot,performance,load_unit:'kg',version:1,started_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:00:00Z',finished_at:null};
const input={planId:plan.id,planVersion:1,weekday:1,startKey:crypto.randomUUID()};
async function stubs(entries,work){const old=entries.map(([object,key,value])=>{const before=object[key];object[key]=value;return [object,key,before];});try{return await work();}finally{for(const [object,key,value]of old.reverse())object[key]=value;}}
function database(results){let index=0;const calls=[];return {calls,from(table){const n=index++;calls.push([n,'from',table]);const query={then(resolve,reject){return Promise.resolve(results[n]).then(resolve,reject);}};for(const method of ['select','eq','lt','or','order','limit','single','maybeSingle'])query[method]=(...args)=>{calls.push([n,method,...args]);return query;};return query;}};}
test('prescriptions capture verified names, instructions and orders independently of later plan revisions',()=>{
 assert.equal(snapshot.exercises[0].exerciseId,'squat');assert.ok(snapshot.exercises[0].instructions.length);assert.notEqual(snapshot.exercises[0].name,'squat');const copy=structuredClone(plan);copy.payload.days[0].exercises[0].reps='2';assert.equal(snapshot.exercises[0].reps,'8–12');assert.throws(()=>service.snapshotDay({...plan,payload:{...plan.payload,days:[{...plan.payload.days[0],exercises:[{...plan.payload.days[0].exercises[0],exerciseId:'invented'}]}]}},1),/unavailable/);
});
test('actual performance permits optional load, added sets and timed movements but rejects malformed completed sets',()=>{
 const actual=structuredClone(performance);actual.exercises[0].sets[0]={load:null,amount:12,done:true};assert.equal(schema.performanceSchema.safeParse(actual).success,true);actual.exercises[0].sets[1]={load:20.5,amount:30,done:true};assert.equal(schema.completedSets(actual),2);assert.equal(schema.performanceSchema.safeParse(actual).success,true);
 for(const set of [{load:-1,amount:10,done:true},{load:0,amount:0,done:true},{load:null,amount:null,done:true},{load:Infinity,amount:1,done:true},{load:null,amount:1.5,done:true}]){actual.exercises[0].sets[0]=set;assert.equal(schema.performanceSchema.safeParse(actual).success,false);}
 const packet={version:1,operationId:crypto.randomUUID(),action:'finish',confirm:true,performance};assert.equal(schema.updateSchema.safeParse(packet).success,false);assert.equal(schema.updateSchema.safeParse({...packet,action:'discard',confirm:false}).success,false);
});
test('start snapshots an active saved plan, takes profile units, scopes reads and reuses the retry key',async()=>{
 const db=database([{data:null},{data:null},{data:{units:'imperial'}}]);let captured;
 await stubs([[plans,'getActivePlan',async()=>plan],[admin,'createAdminSupabase',()=>({rpc:async(name,body)=>{assert.equal(name,'start_workout_session');captured=body;return {data:{...session,load_unit:'lb'}};}})]],async()=>{const result=await service.startWorkout({userId,db},input);assert.equal(result.load_unit,'lb');});
 assert.equal(captured.p_user,userId);assert.equal(captured.p_key,input.startKey);assert.deepEqual(captured.p_snapshot,snapshot);assert.equal(captured.p_performance.exercises[0].sets[0].load,null);assert.ok(db.calls.filter(row=>row[1]==='eq'&&row[2]==='user_id').every(row=>row[3]===userId));
 for(const result of [session,{...session,status:'completed',finished_at:'2026-11-05T10:05:00Z'}])await stubs([[plans,'getActivePlan',()=>assert.fail('Idempotent retry must not depend on the current plan')]],async()=>assert.equal((await service.startWorkout({userId,db:database([{data:result}])},input)).id,session.id));
});
test('unfinished workouts resume, missing/paused plans fail and stale versions do not start',async()=>{
 assert.equal((await service.startWorkout({userId,db:database([{data:null},{data:session}])},input)).id,session.id);
 for(const current of [null,{...plan,status:'paused'},{...plan,version:2}])await stubs([[plans,'getActivePlan',async()=>current],[admin,'createAdminSupabase',()=>assert.fail('No write on invalid plan')]],async()=>assert.rejects(service.startWorkout({userId,db:database([{data:null},{data:null}])},input)));
});
test('failed writes and concurrent edits are visible and ownership is checked before mutation',async()=>{
 const packet={version:1,operationId:crypto.randomUUID(),action:'save',performance};
 for(const [message,code] of [['VERSION_CONFLICT','VERSION_CONFLICT'],['WORKOUT_CLOSED','WORKOUT_CLOSED'],['unavailable','WORKOUT_NOT_SAVED']])await stubs([[admin,'createAdminSupabase',()=>({rpc:async()=>({error:{message}})})]],async()=>assert.rejects(service.updateWorkout({userId,db:database([{data:session}])},session.id,packet),error=>error.code===code));
 await stubs([[admin,'createAdminSupabase',()=>assert.fail('Unowned workouts cannot mutate')]],async()=>assert.rejects(service.updateWorkout({userId,db:database([{data:null}])},session.id,packet),error=>error.status===404));
});
test('history counts and details use actual completed sets, immutable units and bounded pagination',async()=>{
 const completed={...session,status:'completed',finished_at:'2026-11-05T10:10:00Z',performance:structuredClone(performance)};completed.performance.exercises[0].sets[0]={load:12.5,amount:8,done:true};
 const db=database([{data:Array.from({length:31},()=>completed)},{data:session},{count:42}]);const result=await service.listWorkouts({userId,db});assert.equal(result.completedCount,42);assert.equal(result.recent.length,30);assert.ok(result.next);assert.equal(schema.durationMinutes(completed),10);const paged=database([{data:[]},{data:null},{count:42}]);await service.listWorkouts({userId,db:paged},{before:'2026-11-05T10:10:00.123456+00:00',beforeId:completed.id});assert.ok(paged.calls.find(row=>row[1]==='or')[2].includes('00.123456+00:00'),'Pagination must preserve PostgreSQL timestamp precision');
 const History=load('src/components/workouts/WorkoutHistory.tsx').default;const html=renderToStaticMarkup(React.createElement(History,{sessions:[completed],count:42}));assert.match(html,/42 completed workouts/);assert.match(html,/1 completed set/);assert.match(html,/10 min elapsed/);
 const Editor=load('src/components/workouts/WorkoutEditor.tsx').default;const rendered=renderToStaticMarkup(withAppRouter(React.createElement(Editor,{initial:completed,previous:[],reviewCompleted:true})));assert.match(rendered,/COMPLETED WORKOUT/);assert.match(rendered,/value="12.5"/);assert.doesNotMatch(rendered,/>Save progress</);
});
test('workout API rejects unauthenticated, cross-origin and invalid writes before any persistence',async()=>{
 const route=load('src/app/api/v1/workouts/route.ts');let writes=0;const headers={'Content-Type':'application/json'};
 await stubs([[auth,'requireUser',async()=>{throw new auth.AuthenticationError();}]],async()=>assert.equal((await route.POST(new Request('http://localhost/api/v1/workouts',{method:'POST',headers,body:JSON.stringify(input)}))).status,401));
 await stubs([[auth,'requireUser',async()=>({userId,db:{}})],[service,'startWorkout',async()=>{writes++;return session;}],[cache,'refreshWorkoutPages',()=>{}]],async()=>{
 assert.equal((await route.POST(new Request('http://localhost/api/v1/workouts',{method:'POST',headers,body:'{}'}))).status,400);
 assert.equal((await route.POST(new Request('http://localhost/api/v1/workouts',{method:'POST',headers:{...headers,origin:'https://other.example'},body:JSON.stringify(input)}))).status,403);
 assert.equal((await route.POST(new Request('http://localhost/api/v1/workouts',{method:'POST',headers,body:JSON.stringify(input)}))).status,200);
 });assert.equal(writes,1);
 const Page=load('src/app/(experience)/training/workouts/[id]/page.tsx').default;assert.ok(Page);
 assert.ok(withAppRouter(React.createElement('div')));
});
