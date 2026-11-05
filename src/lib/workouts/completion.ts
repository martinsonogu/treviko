import {completedSets,durationMinutes,type WorkoutSession} from './schema';
export function completionSummary(session:WorkoutSession){
 const prescribed=session.snapshot.exercises.reduce((sum,exercise)=>sum+exercise.sets,0);
 const complete=completedSets(session.performance);
 const unfinishedPrescription=session.snapshot.exercises.reduce((sum,exercise,index)=>sum+Math.max(0,exercise.sets-(session.performance.exercises[index]?.sets.filter(set=>set.done).length??0)),0);
 const exercises=session.snapshot.exercises.flatMap((exercise,index)=>{const sets=session.performance.exercises[index]?.sets.filter(set=>set.done)??[];return sets.length?[{...exercise,actualSets:sets,recordedSets:session.performance.exercises[index].sets.flatMap((set,setIndex)=>set.done?[{...set,setNumber:setIndex+1}]:[])}]:[];});
 const minutes=durationMinutes(session);
 return {prescribed,complete,unfinishedPrescription,partial:unfinishedPrescription>0,exercises,minutes};
}

export function completionLabel(session:WorkoutSession){return completionSummary(session).partial?'Completed partially':'Completed';}
export const elapsedExplanation='Based on the recorded start and finish. Elapsed time includes pauses and may differ from physical training time.';
export function displayedLoad(exercise:WorkoutSession['snapshot']['exercises'][number],set:WorkoutSession['performance']['exercises'][number]['sets'][number]){
 const applicable=exercise.loadApplicable??!exercise.bodyweight;
 return {value:set.load!==null&&(applicable||set.load>0)?set.load:null,historical:!applicable&&set.load!==null&&set.load>0};
}
