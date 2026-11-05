import Link from 'next/link';
import type {WorkoutSession} from '@/lib/workouts/schema';
import {completionSummary} from '@/lib/workouts/completion';
import {friendlyWorkoutName,countLabel} from '@/lib/workouts/presentation';
import WorkoutDate from './WorkoutDate';
import EffortCheckIn from './EffortCheckIn';
export default function WorkoutCompletion({session}:{session:WorkoutSession}){
 if(session.status!=='completed'||!session.finished_at)return null;
 const summary=completionSummary(session);
 return <div className="stack workoutCompletion"><header><p className="eyebrow">WORKOUT SAVED</p><h1>{friendlyWorkoutName(session.snapshot.title)}</h1><p role="status">Your workout is finished and saved to your history.</p><p className="muted"><WorkoutDate value={session.finished_at}/></p></header><section className="card cardbody stack"><h2>You showed up.</h2><div className="completionStats"><p><strong>{summary.exercises.length}</strong> {summary.exercises.length===1?'exercise performed':'exercises performed'}</p><p><strong>{summary.complete}</strong> {summary.complete===1?'completed set':'completed sets'}</p>{summary.minutes!==null&&<p><strong>{summary.minutes}</strong> min elapsed</p>}</div>{summary.minutes!==null&&<p className="muted">Elapsed time includes pauses and time away from the workout.</p>}<p>{summary.partial?`Partial workout · ${countLabel(summary.unfinishedPrescription,'prescribed set')} not completed. Your actual work is saved.`:'Prescribed set counts reached. Review your recorded reps and loads below.'}</p><ul className="completionExercises">{summary.exercises.map((exercise,index)=><li key={index}><h3>{exercise.name}</h3><p>{exercise.actualSets.map(set=>`${set.amount} ${exercise.unit}${set.load!==null?` at ${set.load} ${session.load_unit}`:''}`).join(' · ')}</p></li>)}</ul></section><div className="chips completionLinks"><Link className="button" href={`/training/workouts/${session.id}`}>Review full workout →</Link><Link className="chip" href="/training">Back to Training</Link><Link className="textbutton" href="/progress">View Progress →</Link></div><EffortCheckIn key={session.id} id={session.id}/></div>;
}
