import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource as load} from './load-source.mjs';
const {emptyProfile}=load('src/lib/profile/schema.ts');
const {generatePlanProposal}=load('src/lib/coaching/generation.ts');
const {materialiseDraft,validatePlanPayload,planCandidates}=load('src/lib/coaching/validation.ts');
const {getCoachConfig}=load('src/lib/coach/config.ts');
const {estimateWorkoutDuration,programmeQuality}=load('src/lib/coaching/programme.ts');
const {programmingMetadata}=load('src/lib/training/programming.ts');
const {exercises}=load('src/lib/exercises.ts');
const {resolvePlanScope}=load('src/lib/coaching/scope.ts');
const profile={...emptyProfile(),experience:'intermediate',equipment:['dumbbells','bench'],trainingDays:3,sessionMinutes:30,goals:['muscle_gain'],dietaryPattern:'vegetarian',cuisines:['Indian']};
const movements=['squat','dumbbell-romanian-deadlift','dumbbell-floor-press','dumbbell-reverse-fly'];
const meals=[{slot:1,name:'Lentil breakfast bowl',guidance:'A varied protein-rich breakfast to support training recovery; review ingredients.',recipeId:null},{slot:2,name:'Chickpea vegetable lunch',guidance:'Pair pulses and vegetables with a suitable grain around your training day.',recipeId:null},{slot:3,name:'Tofu dinner',guidance:'Include a preferred protein-rich main and vegetables, checking ingredients and labels.',recipeId:null}];
const base={rationale:'A manageable muscle-building week with balanced movement and recovery days.',assumptions:[],experience:'intermediate',equipment:['dumbbells','bench'],sessionMinutes:30,days:[1,3,5].map(weekday=>({weekday,name:'Balanced strength',exerciseIds:movements})),meals:[]};
const classification={category:'fitness',outcome:'allowed',topic:'fitness',safety:'none',injection:false,needsExercises:true,muscles:[],availableEquipment:null,trainingRequested:true,nutritionRequested:false,requestedGoal:null,availableMinutes:null,trainingDays:null,excludedExerciseIds:[]};
const config=getCoachConfig({OPENAI_API_KEY:'mock',OPENAI_MODEL:'mock'}),monitor={reserve:()=>async()=>{}};
function mock(intent={},draft=base){const calls=[];return {calls,responses:{parse:async parameters=>{calls.push(parameters);return {status:'completed',output_parsed:parameters.text.format.name==='treviko_scope'?{...classification,...intent}:parameters.text.format.name==='treviko_review'?{inScope:true,safe:true,grounded:true,preferencesRespected:true,private:true}:typeof draft==='function'?draft(parameters):draft};}}};}
const generate=(transport,extra={})=>generatePlanProposal({message:'Create my workout plan',profile,existing:null,foods:[],recipes:[],history:[],...extra},config,monitor,new AbortController().signal,transport);
const request={scope:'training_only',goal:'muscle_gain',goalSource:'profile',minutes:30,trainingDays:3,targetMuscles:[],excludedExerciseIds:[]};
const materialise=(draft=base,details=request,saved=profile)=>materialiseDraft(draft,saved,[],[],details);
test('workout requests and vague personal plans default to training despite saved dietary preferences',async()=>{
 for(const message of ['Create my workout plan','Build me a three-day muscle-building programme','Create my personal plan']){let nutritionReads=0;const transport=mock();const plan=await generate(transport,{message,loadNutrition:async()=>{nutritionReads++;throw new Error('No nutrition consent');}});assert.equal(plan.scope,'training_only');assert.deepEqual(plan.meals,[]);assert.equal(nutritionReads,0);const data=JSON.parse(transport.calls[1].input[0].content);assert.equal(data.nutritionPreferences,undefined);assert.equal(data.recipes,undefined);assert.equal(transport.calls[1].text.format.schema.properties.meals.maxItems,0);}
 assert.equal(resolvePlanScope({trainingRequested:false,nutritionRequested:false}),'training_only');
});
test('nutrition-only requests generate no workouts and reference the active training goal and demands',async()=>{
 const existing={payload:{...materialise(),primaryGoal:'strength'},version:2};const transport=mock({trainingRequested:false,nutritionRequested:true,topic:'nutrition',needsExercises:false},{...base,days:[],meals});let reads=0;
 const plan=await generate(transport,{message:'Help me plan my meals',existing,loadNutrition:async()=>{reads++;return {foods:[],recipes:[]};}});assert.equal(plan.scope,'nutrition_only');assert.deepEqual(plan.days,[]);assert.equal(plan.primaryGoal,'strength');assert.equal(plan.goalSource,'active_plan');assert.equal(reads,1);const supplied=JSON.parse(transport.calls[1].input[0].content);assert.equal(supplied.resolvedGoal,'strength');assert.equal(supplied.existingPlan.days.length,3);assert.deepEqual(supplied.candidates,[]);assert.equal(transport.calls[1].text.format.schema.properties.days.maxItems,0);
});
test('combined requests and explicit UI selections include exactly the requested components',async()=>{
 const combined=await generate(mock({availableEquipment:null,trainingRequested:true,nutritionRequested:true,topic:'mixed'},{...base,meals}),{message:'Create my training and nutrition plan'});assert.equal(combined.scope,'training_and_nutrition');assert.equal(combined.days.length,3);assert.equal(combined.meals.length,3);
 const explicit=await generate(mock({}, {...base,days:[],meals}),{message:'Create my personal plan',scope:'nutrition_only'});assert.equal(explicit.scope,'nutrition_only');assert.deepEqual(explicit.days,[]);
});
test('time is a ceiling: a large saved availability does not become an invented workout duration',async()=>{
 const transport=mock({}, {...base,sessionMinutes:120});const plan=await generate(transport,{profile:{...profile,sessionMinutes:120}});assert.equal(plan.sessionMinutes,120);for(const day of plan.days){assert.ok(day.estimatedMinutes<=35);assert.ok(day.estimatedMinutes<120);assert.ok(day.warmupMinutes>0);}
});
test('duration formula includes working sets, rests, warm-up, transitions and unilateral sides',()=>{
 const item={exerciseId:'dumbbell-floor-press',sets:3,reps:'8–12',unit:'reps',restSeconds:90};const timing=estimateWorkoutDuration([item],5);assert.equal(timing.workingSeconds,108);assert.equal(timing.restSeconds,180);assert.equal(timing.transitionSeconds,0);assert.equal(timing.estimatedMinutes,10);
 const pair=estimateWorkoutDuration([item,item],5);assert.equal(pair.transitionSeconds,60);assert.equal(pair.estimatedMinutes,20);
 const side=estimateWorkoutDuration([{...item,exerciseId:'reverse-lunge'}],5);assert.equal(side.workingSeconds,216);
 const hold=estimateWorkoutDuration([{...item,exerciseId:'forearm-plank',reps:'15–30',unit:'seconds'}],3);assert.equal(hold.workingSeconds,90);assert.equal(hold.conditioningSeconds,0);
});
test('overlong plans are rejected and repaired with precise time-budget feedback',async()=>{
 const shortProfile={...profile,sessionMinutes:10};const invalid={...base,sessionMinutes:10};const repaired={...invalid,days:[1,3,5].map(weekday=>({weekday,name:'Short strength practice',exerciseIds:['squat']}))};let tries=0;const transport=mock({},()=>++tries===1?invalid:repaired);const plan=await generate(transport,{profile:shortProfile});assert.equal(tries,2);assert.ok(plan.days.every(d=>d.estimatedMinutes<=10));const feedback=JSON.parse(transport.calls[2].input[0].content).repairFeedback;assert.equal(feedback.rule,'duration');assert.match(feedback.hint,/maximum is 10/);
});
test('each exercise has usable prescriptions, effort, cue, reason, progression and compatible substitutions',()=>{
 const plan=materialise();assert.ok(plan.progression.length>30);for(const day of plan.days){assert.ok(day.warmup&&day.recovery);for(const item of day.exercises){assert.ok(item.sets>=2&&item.sets<=4);assert.ok(item.restSeconds>=30);assert.ok(item.repetitionsInReserve>=2);assert.ok(item.cue&&item.reason&&item.progression);if(item.substitutionId)assert.ok(planCandidates(profile).some(e=>e.id===item.substitutionId));}}
 assert.throws(()=>validatePlanPayload({...plan,progression:undefined},profile,[],[]),error=>error.rule==='progression');const bad=structuredClone(plan);delete bad.days[0].exercises[0].restSeconds;assert.throws(()=>validatePlanPayload(bad,profile,[],[]),error=>error.rule==='prescription');
});
test('programme checks catch insufficient volume, poor weekly balance, duplicate movement families and inadequate recovery',()=>{
 assert.throws(()=>materialise({...base,days:base.days.map(d=>({...d,exerciseIds:['shrug']}))}),error=>error.rule==='volume');
 assert.throws(()=>materialise({...base,days:base.days.map(d=>({...d,exerciseIds:['squat','dumbbell-floor-press']}))}),error=>error.rule==='weekly_balance');
 const consecutive={...base,days:base.days.map((d,i)=>({...d,weekday:i+1}))};assert.throws(()=>materialise(consecutive),error=>error.rule==='recovery');
 assert.throws(()=>materialise({...base,days:base.days.map(d=>({...d,exerciseIds:['standing-calf-raise','single-leg-calf-raise','bent-knee-calf-raise']}))},{...request,targetMuscles:['Calves']}),error=>error.rule==='similar_movements');
 const candidates=planCandidates(profile);const days=materialise().days;const strict=programmeQuality(days,candidates,{...request,policy:{minSessionSets:6,maxSessionSets:8,maxWeeklyMuscleSets:12,patternExposures:2}});assert.ok(strict.errors.some(e=>e.rule==='volume'));
});
test('muscle-building structure balances available patterns, meaningful volume and recovery',()=>{
 const plan=materialise();assert.deepEqual(plan.days.map(d=>d.weekday),[1,3,5]);assert.equal(programmeQuality(plan.days,planCandidates(profile),request).errors.length,0);assert.ok(plan.days.every(d=>d.exercises.reduce((n,e)=>n+e.sets,0)>=6));
 const scrambled=materialise({...base,days:base.days.map(d=>({...d,exerciseIds:[...movements].reverse()}))});for(const d of scrambled.days)assert.equal(programmingMetadata(exercises.find(e=>e.id===d.exercises[0].exerciseId)).compound,true);
});
test('a generic cable machine does not permit a lat pulldown and exclusions remain enforced',()=>{
 assert.equal(planCandidates({...profile,equipment:['cable-machine']}).some(e=>e.id==='pulldown'),false);assert.equal(planCandidates({...profile,equipment:['lat-pulldown-machine']}).some(e=>e.id==='pulldown'),true);
 assert.throws(()=>materialise({...base,days:base.days.map(d=>({...d,exerciseIds:['pulldown']}))}),error=>error.rule==='exercise');
 assert.throws(()=>materialise(base,{...request,excludedExerciseIds:['squat']}),error=>error.rule==='exercise');
 for(const e of exercises)assert.ok(programmingMetadata(e).pattern);
});
test('explicit goal conflicts are transparent and never write saved profile goals',async()=>{
 const transport=mock({requestedGoal:'strength'});const original=structuredClone(profile);const plan=await generate(transport,{message:'Build a strength programme instead'});assert.equal(plan.primaryGoal,'strength');assert.equal(plan.savedProfileGoal,'muscle_gain');assert.equal(plan.goalSource,'request');assert.deepEqual(profile,original);const Preview=load('src/components/coaching/PlanPreview.tsx').default;const html=renderToStaticMarkup(React.createElement(Preview,{payload:plan}));assert.match(html,/saved profile goal stays muscle gain/);assert.match(html,/Edit your saved goal separately/);
});
test('training previews contain progression and timing without unwanted food or technical version labels',()=>{
 const Preview=load('src/components/coaching/PlanPreview.tsx').default;const html=renderToStaticMarkup(React.createElement(Preview,{payload:materialise()}));assert.match(html,/calculated estimate/);assert.match(html,/repetitions in reserve/);assert.match(html,/Progress over the coming weeks/);assert.equal(html.includes('Your daily meals'),false);assert.equal(html.includes('Source-linked recipe'),false);assert.equal(html.includes('Based on version'),false);
});
test('nutrition variety checks retain allergy restrictions and quantitative nutrient separation',()=>{
 const requestOnly={...request,scope:'nutrition_only'};assert.throws(()=>materialise({...base,days:[],meals:[meals[0],{...meals[0],slot:2}]},requestOnly),error=>error.rule==='recipe');assert.throws(()=>materialise({...base,days:[],meals:[{...meals[0],guidance:'Contains 500 calories.'}]},requestOnly),error=>error.rule==='nutrition_numbers');
});

test('an explicit equipment subset filters candidates and substitutions; unconfirmed additions need consent in Profile',async()=>{
 const transport=mock({availableEquipment:['dumbbells']},{...base,equipment:['dumbbells']});const plan=await generate(transport);assert.deepEqual(plan.equipment,['dumbbells']);const options=JSON.parse(transport.calls[1].input[0].content).candidates;assert.ok(options.every(e=>e.equipment.every(item=>item==='dumbbells')));for(const day of plan.days)for(const item of day.exercises){const alternative=exercises.find(e=>e.id===item.substitutionId);if(alternative)assert.ok(alternative.requiredEquipment.every(item=>item==='dumbbells'));}
 const unknown=mock({availableEquipment:['lat-pulldown-machine']});await assert.rejects(generate(unknown),error=>error.code==='EQUIPMENT_CONFIRMATION_REQUIRED');assert.equal(unknown.calls.length,1);
});
