import {completedSets,durationMinutes,type WorkoutSession} from './schema';
export function completionSummary(session:WorkoutSession){
 const prescribed=session.snapshot.exercises.reduce((sum,exercise)=>sum+exercise.sets,0);
 const complete=completedSets(session.performance);
 const unfinishedPrescription=session.snapshot.exercises.reduce((sum,exercise,index)=>sum+Math.max(0,exercise.sets-(session.performance.exercises[index]?.sets.filter(set=>set.done).length??0)),0);
 const exercises=session.snapshot.exercises.flatMap((exercise,index)=>{const sets=session.performance.exercises[index]?.sets.filter(set=>set.done)??[];return sets.length?[{...exercise,actualSets:sets}]:[];});
 const minutes=durationMinutes(session);
 return {prescribed,complete,unfinishedPrescription,partial:unfinishedPrescription>0,exercises,minutes};
}
