import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {withAppRouter} from './app-router-fixture.mjs';
import {loadSource as load} from './load-source.mjs';
import {proposal,userId} from './conversation-fixture.mjs';
const schema=load('src/lib/workouts/schema.ts'),service=load('src/lib/workouts/service.ts'),feedback=load('src/lib/workouts/feedback.ts'),admin=load('src/lib/supabase/admin.ts'),auth=load('src/lib/auth/session.ts');
const {completionSummary}=load('src/lib/workouts/completion.ts'),{formatWorkoutDate}=load('src/lib/workouts/dates.ts');
const snapshot=service.snapshotDay({payload:{...proposal.payload,days:[{...proposal.payload.days[0],name:'Upper B'}]}},1),performance=schema.emptyPerformance(snapshot);performance.exercises[0].sets[0]={load:20,amount:8,done:true};
const session={id:'88888888-8888-4888-8888-888888888888',plan_id:'77777777-7777-4777-8777-777777777777',plan_version:1,weekday:1,status:'completed',snapshot,performance,load_unit:'kg',version:3,started_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:20:00Z',finished_at:'2026-11-05T10:20:00Z'};
const render=(Component,props)=>renderToStaticMarkup(withAppRouter(React.createElement(Component,props)));
async function stubs(entries,work){const old=entries.map(([object,key,value])=>{const before=object[key];object[key]=value;return [object,key,before];});try{return await work();}finally{for(const [object,key,value]of old.reverse())object[key]=value;}}
test('completion summary uses actual saved sets and detects partial prescriptions per exercise',()=>{
 const summary=completionSummary(session);assert.equal(summary.complete,1);assert.equal(summary.partial,true);assert.equal(summary.unfinishedPrescription,2);assert.equal(summary.exercises.length,1);assert.equal(summary.exercises[0].actualSets[0].load,20);assert.equal(summary.minutes,20);
 const full=structuredClone(session);full.performance.exercises[0].sets.forEach(set=>Object.assign(set,{amount:8,done:true}));assert.equal(completionSummary(full).partial,false);
 assert.equal(completionSummary({...session,finished_at:'invalid'}).minutes,null);assert.equal(completionSummary({...session,finished_at:'2026-11-05T09:00:00Z'}).minutes,null);
});
test('completion UI confirms only completed persisted records, labels partial work and exposes review/training links',()=>{
 const Completion=load('src/components/workouts/WorkoutCompletion.tsx').default;const html=render(Completion,{session});assert.match(html,/Upper Body B/);assert.match(html,/WORKOUT SAVED/);assert.match(html,/Partial workout/);assert.match(html,/8 reps at 20 kg/);assert.match(html,/Review full workout/);assert.match(html,/href="\/training"/);assert.match(html,/How did that workout feel/);assert.doesNotMatch(html,/calories|personal record|training improvement/i);
 assert.equal(render(Completion,{session:{...session,status:'in_progress',finished_at:null}}),'');assert.equal(render(Completion,{session:{...session,status:'discarded'}}),'');
});
test('date formatting respects local zones and DST while server markup is deterministic',()=>{
 assert.match(formatWorkoutDate('2026-11-05T01:15:00Z','America/Los_Angeles'),/4 Nov 2026, 17:15/);assert.match(formatWorkoutDate('2026-07-05T10:00:00Z','Europe/London'),/5 Jul 2026, 11:00/);assert.match(formatWorkoutDate('2026-11-05T10:00:00Z','Asia/Tokyo'),/5 Nov 2026, 19:00/);
 const DateComponent=load('src/components/workouts/WorkoutDate.tsx').default;const html=render(DateComponent,{value:session.finished_at});assert.match(html,/Loading local time/);assert.match(html,/dateTime="2026-11-05T10:20:00Z"/i);assert.doesNotMatch(html,/ UTC|10:20</);
});
test('feedback validates ownership/status and returns only the confirmed workout-specific response',async()=>{
 let calls=0;const record={session_id:session.id,effort:'hard',created_at:session.finished_at};
 await stubs([[service,'getWorkout',async()=>session],[admin,'createAdminSupabase',()=>({rpc:async(name,body)=>{calls++;assert.equal(name,'save_workout_feedback');assert.equal(body.p_user,userId);assert.equal(body.p_session,session.id);return {data:record};}})]],async()=>{assert.deepEqual(await feedback.saveFeedback({userId},session.id,{effort:'hard'}),record);await assert.rejects(feedback.saveFeedback({userId},session.id,{effort:'invalid'}));});assert.equal(calls,1);
 for(const current of [{...session,status:'in_progress'},{...session,status:'discarded'}])await stubs([[service,'getWorkout',async()=>current],[admin,'createAdminSupabase',()=>assert.fail('Cannot write feedback for unfinished/discarded workout')]],async()=>assert.rejects(feedback.saveFeedback({userId},session.id,{effort:'easy'}),error=>error.code==='NOT_COMPLETED'));
 await stubs([[service,'getWorkout',async()=>{throw new Error('Not found');}],[admin,'createAdminSupabase',()=>assert.fail('Unowned data cannot write')]],async()=>assert.rejects(feedback.saveFeedback({userId},session.id,{effort:'hard'})));
});
test('feedback failures distinguish optional save failure from the already-saved workout',async()=>{
 for(const [message,code]of [['transport','FEEDBACK_NOT_SAVED'],['FEEDBACK_EXISTS','FEEDBACK_EXISTS']])await stubs([[service,'getWorkout',async()=>session],[admin,'createAdminSupabase',()=>({rpc:async()=>({error:{message}})})]],async()=>assert.rejects(feedback.saveFeedback({userId},session.id,{effort:'hard'}),error=>error.code===code));
});
test('feedback API is authenticated, origin-checked and rejects unknown fields before mutation',async()=>{
 const route=load('src/app/api/v1/workouts/[id]/feedback/route.ts');const headers={'Content-Type':'application/json'},context={params:Promise.resolve({id:session.id})};
 await stubs([[auth,'requireUser',async()=>{throw new auth.AuthenticationError();}]],async()=>assert.equal((await route.GET(new Request('http://localhost/api'),context)).status,401));
 let writes=0;await stubs([[auth,'requireUser',async()=>({userId})],[feedback,'saveFeedback',async()=>{writes++;return {}; }]],async()=>{
 for(const [body,extra,status]of [[{effort:'hard',userId:'forged'},{},400],[{effort:'easy'},{origin:'https://elsewhere.example'},403],[{effort:'hard'},{},200]])assert.equal((await route.POST(new Request('http://localhost/api',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)}),context)).status,status);
 });assert.equal(writes,1);
});
