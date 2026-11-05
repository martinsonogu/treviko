import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {withAppRouter} from './app-router-fixture.mjs';
import {loadSource as load} from './load-source.mjs';
import {proposal} from './conversation-fixture.mjs';
const present=load('src/lib/workouts/presentation.ts'),schema=load('src/lib/workouts/schema.ts'),service=load('src/lib/workouts/service.ts');
const choicesModule=load('src/components/workouts/WorkoutChoices.tsx');
const Choices=choicesModule.default,Progress=load('src/components/workouts/ProgressOverview.tsx').default;
const render=(Component,props)=>renderToStaticMarkup(withAppRouter(React.createElement(Component,props)));
const plan={id:'77777777-7777-4777-8777-777777777777',version:3,status:'active',payload:{...proposal.payload,days:proposal.payload.days.map((day,index)=>({...day,name:index?'Lower B':'Upper A',estimatedMinutes:index?undefined:35}))}};
const snapshot=service.snapshotDay(plan,1),performance=schema.emptyPerformance(snapshot);performance.exercises[0].sets[0]={load:10,amount:8,done:true};
const session={id:'88888888-8888-4888-8888-888888888888',plan_id:plan.id,plan_version:3,weekday:1,status:'in_progress',snapshot,performance,load_unit:'kg',version:1,started_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:10:00Z',finished_at:null};
const completed={...session,status:'completed',finished_at:'2026-11-05T10:20:00Z'};
async function stubs(entries,work){const old=entries.map(([object,key,value])=>{const before=object[key];object[key]=value;return [object,key,before];});try{return await work();}finally{for(const [object,key,value]of old.reverse())object[key]=value;}}
test('friendly split labels are presentation-only and unknown names remain unchanged',()=>{
 for(const [name,expected]of [['Upper A','Upper Body A'],['Upper B','Upper Body B'],['Lower A','Lower Body A'],['Lower B','Lower Body B'],['Lower Body B','Lower Body B'],['Full-body strength','Full-body strength']])assert.equal(present.friendlyWorkoutName(name),expected);
 assert.equal(snapshot.title,'Upper A');assert.equal(plan.payload.days[0].name,'Upper A');
});
test('training choices show library-derived muscles and only provided duration estimates',()=>{
 const before=JSON.stringify(plan);const html=render(Choices,{plan,active:null,count:0,today:4});assert.match(html,/Upper Body A/);assert.match(html,/Lower Body B/);assert.match(html,/A and B distinguish sessions/);assert.match(html,/About 35 min \(plan estimate\)/);assert.equal((html.match(/min \(plan estimate\)/g)??[]).length,1);assert.match(html,/Start workout: Upper Body A/);assert.match(html,/TODAY/);assert.ok(html.indexOf('Lower Body B')<html.indexOf('Upper Body A'));
 const expected=choicesModule.workoutMuscles(plan.payload.days[0].exercises);for(const muscle of expected)assert.ok(html.includes(muscle));assert.deepEqual(choicesModule.workoutMuscles([{exerciseId:'unknown'}]),[]);assert.equal(JSON.stringify(plan),before);
});
test('resume takes precedence over starting and reports actual saved completed sets',()=>{
 const html=render(Choices,{plan,active:session,count:1});assert.match(html,/Continue your workout/);assert.match(html,/1 completed set saved/);assert.match(html,/Resume workout/);assert.match(html,new RegExp(`/training/workouts/${session.id}`));assert.doesNotMatch(html,/Start workout:/);
 const paused=render(Choices,{plan:{...plan,status:'paused'},active:null,count:0});assert.doesNotMatch(paused,/Start workout:/);assert.match(paused,/Confirm an active training plan/);
 const review=render(Choices,{plan,active:null,count:0,needsReview:true});assert.match(review,/Review your exercises/);assert.doesNotMatch(review,/Start workout:/);
});
test('Progress uses singular/plural counts, a real latest workout and clear empty/resume states',()=>{
 for(const count of [1,2]){const html=render(Progress,{count,recent:completed,active:null});assert.match(html,new RegExp(`${count} completed workout${count===1?'':'s'}`));assert.match(html,/Latest completed workout/);assert.match(html,/Upper Body A/);assert.match(html,/20 min elapsed/);assert.match(html,/1 exercise performed · 1 completed set/);assert.match(html,/View full training history/);assert.doesNotMatch(html,/streak|calories|personal record|strength trend/i);}
 const empty=render(Progress,{count:0,recent:null,active:null});assert.match(empty,/0 completed workouts/);assert.match(empty,/Your first workout starts here/);assert.match(empty,/Choose a workout/);assert.doesNotMatch(empty,/Latest completed workout/);
 const resume=render(Progress,{count:0,recent:null,active:session});assert.match(resume,/Resume workout/);assert.match(resume,/Finish your current workout/);
 assert.doesNotMatch(render(Progress,{count:0,recent:session,active:null}),/Latest completed workout/);
});
test('workout editor distinguishes immutable prescriptions, actual input and saved resume status',()=>{
 const Editor=load('src/components/workouts/WorkoutEditor.tsx').default;const html=render(Editor,{initial:session,previous:[]});assert.match(html,/Upper Body A/);assert.match(html,/Prescribed:/);assert.match(html,/Log your actual performance/);assert.match(html,/Ready to resume/);assert.match(html,/data-save-state="saved"/);assert.match(html,/completed/);assert.match(html,/inputMode="numeric"/i);assert.match(html,/Save progress/);
 const finished=render(Editor,{initial:completed,previous:[]});assert.match(finished,/Recorded performance/);assert.doesNotMatch(finished,/>Finish workout</);assert.equal(completed.snapshot.title,'Upper A');
});
test('Training places execution before accessible plan reference without a duplicate primary heading',async()=>{
 const pageUser=load('src/lib/auth/page-user.ts'),view=load('src/lib/coaching/view.ts'),workouts=load('src/lib/workouts/service.ts'),Account=load('src/components/coaching/AccountPlan.tsx').default;
 const data={plan,trainingNeedsReview:false,planNeedsReview:false,today:{isoDay:1,weekday:'Monday',workout:plan.payload.days[0]}};
 await stubs([[pageUser,'getPageUser',async()=>({userId:'owner'})],[view,'getCoachingView',async()=>data],[workouts,'listWorkouts',async()=>({active:null,recent:[],completedCount:0})]],async()=>{
 const tree=await Account();const children=tree.props.children;assert.equal(children[0].type,'header');assert.equal(children[1].type.name,'WorkoutHub');assert.equal(children[2].type,'details');assert.equal(children[2].props.open,undefined);const TrainingPlan=load('src/components/coaching/DailyDashboard.tsx').TrainingPlan;const reference=render(TrainingPlan,{view:data,reference:true});assert.doesNotMatch(reference,/<h1|View today’s workout/);assert.match(reference,/My training plan/);
 });
});
