import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {withAppRouter} from './app-router-fixture.mjs';
import {loadSource as load} from './load-source.mjs';
import {proposal,userId} from './conversation-fixture.mjs';
const service=load('src/lib/workouts/service.ts'),schema=load('src/lib/workouts/schema.ts'),state=load('src/lib/workouts/training-state.ts'),summary=load('src/lib/workouts/completion.ts');
const plan={id:'77777777-7777-4777-8777-777777777777',version:1,status:'active',payload:{...proposal.payload,days:[{...proposal.payload.days[0],name:'Upper A'}]}};
const snapshot=service.snapshotDay(plan,1),performance=schema.emptyPerformance(snapshot);performance.exercises[0].sets.forEach(set=>Object.assign(set,{done:true,amount:8,load:20}));
const complete={id:'88888888-8888-4888-8888-888888888888',plan_id:plan.id,plan_version:1,weekday:1,status:'completed',snapshot,performance,load_unit:'kg',version:3,started_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:02:00Z',finished_at:'2026-11-05T10:02:00Z'};
const stale={...complete,status:'in_progress',finished_at:null,version:2};
const repeat={...stale,id:'99999999-9999-4999-8999-999999999999',version:1};
const render=(Component,props)=>renderToStaticMarkup(withAppRouter(React.createElement(Component,props)));
test('terminal status wins for the same ID, while a distinct active repeat remains resumable',()=>{
 assert.equal(state.resolveActiveWorkout(stale,[complete]),null);assert.equal(state.resolveActiveWorkout(stale,[{...complete,status:'discarded'}]),null);assert.equal(state.resolveActiveWorkout({...stale,finished_at:complete.finished_at}),null);
 assert.equal(state.resolveActiveWorkout(repeat,[complete]).id,repeat.id);assert.equal(state.trainingSessionState(plan.id,1,1,stale,complete,'Europe/London','2026-11-05T18:00:00Z'),'completed_today');
 const Choices=load('src/components/workouts/WorkoutChoices.tsx').default,Progress=load('src/components/workouts/ProgressOverview.tsx').default;
 for(const Component of [Choices,Progress]){const props=Component===Choices?{plan,active:stale,count:1,previous:{1:complete}}:{count:1,active:stale,recent:complete};const html=render(Component,props);assert.doesNotMatch(html,/Resume workout/);assert.match(html,/Completed/);}
 const repeated=render(Choices,{plan,active:repeat,count:1,previous:{1:complete}});assert.match(repeated,/This repeat is a separate session/);assert.match(repeated,/Review previous workout/);assert.match(repeated,new RegExp(`/training/workouts/${repeat.id}`));
});
test('finished partial workouts stay completed and repeatable, never active drafts',()=>{
 const partial=structuredClone(complete);partial.performance.exercises[0].sets[1].done=false;
 const Choices=load('src/components/workouts/WorkoutChoices.tsx').default;const html=render(Choices,{plan,active:{...stale,performance:partial.performance},count:1,previous:{1:partial}});assert.match(html,/Completed partially/);assert.match(html,/Review workout/);assert.match(html,/Repeat workout/);assert.doesNotMatch(html,/Resume workout/);
});
test('conflicting list-query snapshots reconcile terminal records before Progress can offer Resume',async()=>{
 let index=0;const results=[{data:[complete]},{data:stale},{count:1}];const db={from(){const result=results[index++],query={then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};for(const method of ['select','eq','order','limit','maybeSingle'])query[method]=()=>query;return query;}};
 const data=await service.listWorkouts({userId,db});assert.equal(data.active,null);assert.equal(data.completedCount,1);assert.equal(data.recent[0].id,complete.id);
});
test('actual short duration is retained and summaries retain original set numbers and measurement units',()=>{
 assert.equal(schema.durationMinutes(complete),2);const Completion=load('src/components/workouts/WorkoutCompletion.tsx').default;const html=render(Completion,{session:complete});assert.match(html,/2<\/strong> min elapsed/);assert.match(html,/recorded start and finish/);assert.match(html,/may differ from physical training time/);assert.doesNotMatch(html,/exceptional|personal record|calories/i);
 const partial=structuredClone(complete);partial.performance.exercises[0].sets[0].done=false;const partialHtml=render(Completion,{session:partial});assert.doesNotMatch(partialHtml,/>Set 1</);assert.match(partialHtml,/>Set 2</);assert.match(partialHtml,/Completed partially/);
 const timed={...snapshot.exercises[0],bodyweight:true,loadApplicable:false,unit:'seconds'};assert.equal(summary.displayedLoad(timed,{amount:20,load:0,done:true}).value,null);assert.equal(summary.displayedLoad(timed,{amount:20,load:10,done:true}).historical,true);assert.equal(summary.displayedLoad({...timed,loadApplicable:true},{amount:20,load:10,done:true}).value,10);
 const body=structuredClone(complete);body.snapshot.exercises[0]=timed;body.performance.exercises[0].sets.forEach(set=>Object.assign(set,{amount:20,load:0}));const bodyHtml=render(Completion,{session:body});assert.match(bodyHtml,/20 seconds/);assert.doesNotMatch(bodyHtml,/0 kg/);assert.equal(body.performance.exercises[0].sets[0].load,0);
});
