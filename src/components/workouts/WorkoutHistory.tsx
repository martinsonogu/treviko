import Link from 'next/link';
import WorkoutDate from './WorkoutDate';
import {completedSets,durationMinutes,type WorkoutSession} from '@/lib/workouts/schema';
import {friendlyWorkoutName,countLabel} from '@/lib/workouts/presentation';
export function WorkoutHistoryCard({session,compact=false}:{session:WorkoutSession;compact?:boolean}){
 const Heading=compact?'h3':'h2';const performed=session.snapshot.exercises.filter((_exercise,index)=>session.performance.exercises[index]?.sets.some(set=>set.done));
 return <article className={`card cardbody workoutHistoryCard${compact?' recentWorkout':''}`}><Heading><Link className="textbutton" href={`/training/workouts/${session.id}`}>{friendlyWorkoutName(session.snapshot.title)}</Link></Heading><p><WorkoutDate value={session.finished_at!}/>{durationMinutes(session)!==null?` · ${durationMinutes(session)} min elapsed`:''}</p><p>{countLabel(performed.length,'exercise')} performed · {countLabel(completedSets(session.performance),'completed set')}</p>{performed.length>0&&<p className="muted">{performed.map(exercise=>exercise.name).join(' · ')}</p>}{!compact&&session.performance.notes&&<p className="workoutNotes">{session.performance.notes}</p>}<Link className="textbutton" href={`/training/workouts/${session.id}`}>Review workout →</Link></article>;
}
export default function WorkoutHistory({sessions,count}:{sessions:WorkoutSession[];count:number}){return <section className="stack"><p>{countLabel(count,'completed workout')}</p>{sessions.length?sessions.map(session=><WorkoutHistoryCard key={session.id} session={session}/>):<section className="card cardbody"><h2>No completed workouts yet</h2><p>Start a workout from your active plan in Training. Completed sets and notes will appear here after you explicitly finish.</p></section>}</section>;}
