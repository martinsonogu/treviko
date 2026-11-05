import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {withAppRouter} from './app-router-fixture.mjs';
import {loadSource as load} from './load-source.mjs';
import {proposal,userId} from './conversation-fixture.mjs';
const {trainingSessionState}=load('src/lib/workouts/training-state.ts'),{workoutMeasurement,supportsExternalLoad}=load('src/lib/workouts/measurement.ts'),schema=load('src/lib/workouts/schema.ts'),service=load('src/lib/workouts/service.ts');
const plan={id:'77777777-7777-4777-8777-777777777777',version:1,payload:proposal.payload};
const snapshot=service.snapshotDay(plan,1),performance=schema.emptyPerformance(snapshot);
const row={id:'88888888-8888-4888-8888-888888888888',plan_id:plan.id,plan_version:1,weekday:1,status:'completed',snapshot,performance,load_unit:'kg',version:3,started_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:20:00Z',finished_at:'2026-11-05T10:20:00Z'};
const render=(Component,props)=>renderToStaticMarkup(withAppRouter(React.createElement(Component,props)));
test('saved training state distinguishes today, previous, active, discarded and revised prescriptions in local time',()=>{
 const status=(active,previous,zone='Europe/London',now='2026-11-05T18:00:00Z',version=1)=>trainingSessionState(plan.id,version,1,active,previous,zone,now);
 assert.equal(status(null,null),'not_started');assert.equal(status(null,row),'completed_today');assert.equal(status(null,row,'Europe/London','2026-11-06T01:00:00Z'),'completed_previously');assert.equal(status(null,row,'America/Los_Angeles','2026-11-06T01:00:00Z'),'completed_today');
 assert.equal(status({...row,status:'in_progress',finished_at:null},row),'completed_today');assert.equal(status({...row,id:'99999999-9999-4999-8999-999999999999',status:'in_progress',finished_at:null},row),'in_progress');assert.equal(status({...row,status:'discarded'},null),'not_started');assert.equal(status(null,row,'Europe/London',undefined,2),'completed_previously');assert.equal(status(null,{...row,plan_id:'99999999-9999-4999-8999-999999999999'}),'not_started');assert.equal(status(null,{...row,weekday:4}),'not_started');
});
test('measurement mapping supports unweighted reps/time, weights/reps and explicitly weighted time, retaining historical loads',()=>{
 const actual={sets:[{load:null,amount:null,done:false}],notes:''},exercise=snapshot.exercises[0];
 for(const [unit,bodyweight,loadApplicable,kind,showLoad]of [['seconds',true,false,'bodyweight_time',false],['reps',true,false,'bodyweight_reps',false],['reps',false,true,'weight_reps',true],['seconds',false,true,'weighted_time',true]]){const result=workoutMeasurement({...exercise,unit,bodyweight,loadApplicable},actual);assert.equal(result.kind,kind);assert.equal(result.showLoad,showLoad);assert.equal(result.amountLabel,unit==='seconds'?'Seconds':'Reps');}
 const historical={sets:[{load:10,amount:20,done:true}],notes:''};const result=workoutMeasurement({...exercise,bodyweight:true,unit:'seconds',loadApplicable:undefined},historical);assert.equal(result.showLoad,true);assert.equal(result.loadReadOnly,true);assert.equal(historical.sets[0].load,10);
 assert.equal(supportsExternalLoad({requiredEquipment:['pull-up-bar','bench']}),false);assert.equal(supportsExternalLoad({requiredEquipment:['dumbbells']}),true);
});
test('bodyweight hold renders only seconds and completion; historical loads remain visible and immutable snapshots remain compatible',()=>{
 const Editor=load('src/components/workouts/WorkoutEditor.tsx').default;const current=structuredClone(row);current.status='in_progress';current.finished_at=null;current.snapshot.exercises[0]={...current.snapshot.exercises[0],name:'Bodyweight hold',unit:'seconds',bodyweight:true,loadApplicable:false};
 const html=render(Editor,{initial:current,previous:[]});assert.match(html,/set 1 seconds/);assert.doesNotMatch(html,/set 1 load in|Load \(kg\)/);assert.match(html,/withoutLoad/);
 current.performance.exercises[0].sets[0].load=7;const old=render(Editor,{initial:current,previous:[]});assert.match(old,/Recorded load/);assert.match(old,/value="7"/);assert.ok(schema.snapshotSchema.safeParse({...snapshot,exercises:snapshot.exercises.map(({loadApplicable,...exercise})=>{void loadApplicable;return exercise;})}).success);
});
test('completed default rendering recovers summary/effort after a refresh; explicit review preserves the full immutable details',()=>{
 const Editor=load('src/components/workouts/WorkoutEditor.tsx').default;
 const summary=render(Editor,{initial:row,previous:[]});assert.match(summary,/WORKOUT SAVED/);assert.match(summary,/How did that workout feel/);assert.match(summary,/view=details/);
 const details=render(Editor,{initial:row,previous:[],reviewCompleted:true});assert.match(details,/Recorded performance/);assert.doesNotMatch(details,/>Finish workout</);
});
test('previous completion remains repeatable and partial completion comes from saved actuals',()=>{
 const Actions=load('src/components/workouts/WorkoutSessionActions.tsx').default;const complete=structuredClone(row);complete.performance.exercises[0].sets[0]={load:10,amount:8,done:true};
 const html=render(Actions,{planId:plan.id,planVersion:1,weekday:1,name:'Workout',active:null,previous:complete});assert.match(html,/Completed partially/);assert.match(html,/Last completed/);assert.match(html,/Partial workout/);assert.match(html,/Repeat workout/);assert.match(html,/Review workout/);assert.doesNotMatch(html,/disabled=""/);
 const active=render(Actions,{planId:plan.id,planVersion:1,weekday:1,name:'Workout',active:{...row,status:'in_progress'},previous:complete});assert.match(active,/Completed partially/);assert.match(active,/Repeat workout/);assert.doesNotMatch(active,/Resume workout/);
});
test('completion lookups are bounded per saved plan/day and explicitly owner-scoped rather than limited to a history page',async()=>{
 const calls=[];const db={from(table){calls.push(['from',table]);const query={then(resolve,reject){return Promise.resolve({data:row,error:null}).then(resolve,reject);}};for(const method of ['select','eq','order','limit','maybeSingle'])query[method]=(...args)=>{calls.push([method,...args]);return query;};return query;}};
 const result=await service.trainingCompletions({userId,db},{id:plan.id,payload:{days:[{weekday:1}]}});assert.equal(result[1].id,row.id);for(const [field,value]of [['user_id',userId],['plan_id',plan.id],['weekday',1],['status','completed']])assert.ok(calls.some(call=>call[0]==='eq'&&call[1]===field&&call[2]===value));assert.ok(calls.some(call=>call[0]==='limit'&&call[1]===1));
 assert.deepEqual(await service.trainingCompletions({userId,db:{from(){assert.fail('No plan has no slot lookups');}}},null),{});
});
