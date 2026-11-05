import React,{Activity} from 'react';
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
// Deterministic clock for local-day status tests; the database fixture stays immutable.
const NativeDate=Date;const clock={now:NativeDate.parse('2026-11-05T18:00:00Z')};
window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}};
const original={id:'88888888-8888-4888-8888-888888888888',plan_id:'77777777-7777-4777-8777-777777777777',plan_version:1,weekday:1,status:'in_progress',snapshot,performance:emptyPerformance(snapshot),load_unit:'kg',version:1,started_at:'2026-11-05T10:00:00Z',updated_at:'2026-11-05T10:00:00Z',finished_at:null};
const plan={id:original.plan_id,version:1,status:'active',payload:{days:[{weekday:1,name:'Upper A',estimatedMinutes:35,exercises:snapshot.exercises},{weekday:4,name:'Lower B',exercises:snapshot.exercises}]}};
const starts=new Map();const records=new Map();const feedbacks=new Map();
let screen='editor',lastCompleted=null;let saved=structuredClone(original),lastPacket;const requests=[];const root=createRoot(document.getElementById('root'));
const test={discardStored(){saved={...saved,status:'discarded',version:saved.version+1,finished_at:'2026-11-05T10:21:00Z'};records.set(saved.id,structuredClone(saved));render(++test.mount);},prepareRetainedStart(){saved={...structuredClone(original),id:crypto.randomUUID(),status:'discarded',finished_at:'2026-11-05T09:00:00Z'};lastCompleted=null;screen='training';test.screen='training';records.clear();starts.clear();feedbacks.clear();render(++test.mount);},completeStored(){saved={...saved,status:'completed',version:saved.version+1,finished_at:'2026-11-05T10:20:00Z'};saved.performance.exercises.forEach(exercise=>exercise.sets.forEach(set=>Object.assign(set,{done:true,amount:10})));records.set(saved.id,structuredClone(saved));lastCompleted=structuredClone(saved);render(++test.mount);},hideStart(value){test.startHidden=value;render(++test.mount);},records,setClock(value){clock.now=NativeDate.parse(value);render(++test.mount);},completed(){return lastCompleted;},clearFeedback(){feedbacks.delete(lastCompleted?.id??saved.id);},show(view){screen=view;test.screen=view;render(++test.mount);},requests,failNext:false,conflictNext:false,router:{push(path){test.destination=path;},replace(path){test.destination=path;},refresh(){}},remount(){render(++test.mount);},mount:0,reset(){screen='editor';test.screen='editor';sessionStorage.clear();saved={...structuredClone(original),id:crypto.randomUUID()};records.set(saved.id,structuredClone(saved));lastPacket=null;requests.length=0;render(++test.mount);},saved(){return saved;}};
function render(key=0){root.render(<div className="shell authenticatedShell"><header className="topbar">Treviko<Nav variant="desktop"/></header><main className="main">{screen==='completion'&&lastCompleted?<WorkoutCompletion key={key} session={lastCompleted}/>:screen==='training'?<WorkoutChoices plan={plan} active={saved.status==='in_progress'?saved:null} count={[...records.values()].filter(row=>row.status==='completed').length} today={1} stateRevision={`read-${key}`} previous={lastCompleted?{[lastCompleted.weekday]:lastCompleted}:{}}/>:screen==='progress'?<ProgressOverview count={[...records.values()].filter(row=>row.status==='completed').length} recent={lastCompleted} active={saved.status==='in_progress'?saved:null}/>:<><Activity mode={test.startHidden?'hidden':'visible'}><StartWorkout planId={original.plan_id} planVersion={1} weekday={1} name={snapshot.title}/></Activity><WorkoutEditor key={key} initial={structuredClone(saved)} previous={[]} reviewCompleted={screen==='details'}/></>}</main><Nav variant="mobile"/></div>);}
window.__workoutTest=test;
window.fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):null;requests.push({url,body,method:options.method??'GET'});
 if(url==='/api/v1/workouts'){
  if(test.startFailure){const kind=test.startFailure;test.startFailure=null;if(kind==='pending')return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Hidden navigation','AbortError')),{once:true}));if(kind==='timeout'||kind==='cancel')throw new DOMException('Fixture start interrupted',kind==='timeout'?'TimeoutError':'AbortError');return Response.json({error:{message:'Fixture start failed. Retry.'}},{status:503});}
  if(starts.has(body.startKey))return Response.json({data:records.get(starts.get(body.startKey))});
  if(saved.status!=='in_progress'){const day=plan.payload.days.find(day=>day.weekday===body.weekday);saved={...structuredClone(original),id:crypto.randomUUID(),weekday:body.weekday,snapshot:{...structuredClone(snapshot),title:day.name,weekday:day.weekday}};lastPacket=null;}
  starts.set(body.startKey,saved.id);records.set(saved.id,structuredClone(saved));return Response.json({data:saved});
 }
 if(url.endsWith('/feedback')){
  const id=url.split('/')[4];
  if(options.method==='POST'){
   if(feedbacks.has(id)&&feedbacks.get(id).effort!==body.effort)return Response.json({error:{message:'Feedback already exists'}},{status:409});
   if(!feedbacks.has(id))feedbacks.set(id,{session_id:id,effort:body.effort,created_at:'2026-11-05T10:21:00Z'});
   if(test.failFeedbackAfterCommit){test.failFeedbackAfterCommit=false;throw new TypeError('Fixture feedback response interrupted');}
  }
  return Response.json({data:feedbacks.get(id)??null});
 }

 if(options.method!=='PATCH')return Response.json({data:saved});
 if(test.failNext){test.failNext=false;return Response.json({error:{message:'Fixture save failed. Retry.'}},{status:503});}
 if(test.conflictNext){test.conflictNext=false;return Response.json({error:{message:'This workout changed in another tab. Reload saved data.'}},{status:409});}
 if(test.invalidFinishResponse&&body.action==='finish'){test.invalidFinishResponse=false;return Response.json({data:saved});}
 if(lastPacket===body.operationId)return Response.json({data:saved});
 saved={...saved,performance:body.performance,version:saved.version+1,status:body.action==='finish'?'completed':body.action==='discard'?'discarded':'in_progress',finished_at:body.action==='save'?null:(test.finishAt??'2026-11-05T10:20:00Z')};lastPacket=body.operationId;records.set(saved.id,structuredClone(saved));if(saved.status==='completed')lastCompleted=structuredClone(saved);return Response.json({data:saved});};
render();
