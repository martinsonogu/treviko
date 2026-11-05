import React from 'react';
import {createRoot} from 'react-dom/client';
import WorkoutCompletion from '../src/components/workouts/WorkoutCompletion';
import WorkoutChoices from '../src/components/workouts/WorkoutChoices';
import ProgressOverview from '../src/components/workouts/ProgressOverview';
import WorkoutEditor from '../src/components/workouts/WorkoutEditor';
import StartWorkout from '../src/components/workouts/StartWorkout';
import Nav from '../src/components/Nav';
import {exercises} from '../src/lib/exercises';
import {emptyPerformance} from '../src/lib/workouts/schema';
const snapshot={title:'Fixture full-body workout',weekday:1,exercises:[exercises.find(e=>e.id==='squat'),exercises.find(e=>e.prescription.unit==='seconds')].map(exercise=>({exerciseId:exercise.id,name:exercise.name,slug:exercise.slug,sets:2,reps:exercise.prescription.unit==='seconds'?'20–30':'8–12',unit:exercise.prescription.unit,restSeconds:60,instructions:exercise.instructions,bodyweight:exercise.requiredEquipment.length===0}))};
const original={id:'88888888-8888-4888-8888-888888888888',plan_id:'77777777-7777-4777-8777-777777777777',plan_version:1,weekday:1,status:'in_progress',snapshot,performance:emptyPerformance(snapshot),load_unit:'kg',version:1,started_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:00:00Z',finished_at:null};
const plan={id:original.plan_id,version:1,status:'active',payload:{days:[{weekday:1,name:'Upper A',estimatedMinutes:35,exercises:snapshot.exercises},{weekday:4,name:'Lower B',exercises:snapshot.exercises}]}};
let screen='editor',lastCompleted=null,feedback=null;let saved=structuredClone(original),lastPacket;const requests=[];const root=createRoot(document.getElementById('root'));
const test={clearFeedback(){feedback=null;},show(view){screen=view;test.screen=view;render(++test.mount);},requests,failNext:false,conflictNext:false,router:{push(path){test.destination=path;},replace(path){test.destination=path;},refresh(){}},remount(){render(++test.mount);},mount:0,reset(){feedback=null;sessionStorage.clear();saved=structuredClone(original);lastPacket=null;requests.length=0;render(++test.mount);},saved(){return saved;}};
function render(key=0){root.render(<div className="shell authenticatedShell"><header className="topbar">Treviko<Nav variant="desktop"/></header><main className="main">{screen==='completion'&&lastCompleted?<WorkoutCompletion key={key} session={lastCompleted}/>:screen==='training'?<WorkoutChoices plan={plan} active={saved.status==='in_progress'?saved:null} count={lastCompleted?1:0} today={1}/>:screen==='progress'?<ProgressOverview count={lastCompleted?1:0} recent={lastCompleted} active={saved.status==='in_progress'?saved:null}/>:<><StartWorkout planId={original.plan_id} planVersion={1} weekday={1} name={snapshot.title}/><WorkoutEditor key={key} initial={structuredClone(saved)} previous={[]}/></>}</main><Nav variant="mobile"/></div>);}
window.__workoutTest=test;
window.fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):null;requests.push({url,body,method:options.method??'GET'});
 if(url==='/api/v1/workouts')return Response.json({data:saved});
 if(url.endsWith('/feedback')){
  if(options.method==='POST'){
   feedback=feedback??{session_id:saved.id,effort:body.effort,created_at:'2026-11-05T10:21:00Z'};
   if(test.failFeedbackAfterCommit){test.failFeedbackAfterCommit=false;throw new TypeError('Fixture feedback response interrupted');}
  }
  return Response.json({data:feedback});
 }

 if(options.method!=='PATCH')return Response.json({data:saved});
 if(test.failNext){test.failNext=false;return Response.json({error:{message:'Fixture save failed. Retry.'}},{status:503});}
 if(test.conflictNext){test.conflictNext=false;return Response.json({error:{message:'This workout changed in another tab. Reload saved data.'}},{status:409});}
 if(test.invalidFinishResponse&&body.action==='finish'){test.invalidFinishResponse=false;return Response.json({data:saved});}
 if(lastPacket===body.operationId)return Response.json({data:saved});
 saved={...saved,performance:body.performance,version:saved.version+1,status:body.action==='finish'?'completed':body.action==='discard'?'discarded':'in_progress',finished_at:body.action==='save'?null:'2026-11-05T10:20:00Z'};lastPacket=body.operationId;if(saved.status==='completed')lastCompleted=structuredClone(saved);return Response.json({data:saved});};
render();
