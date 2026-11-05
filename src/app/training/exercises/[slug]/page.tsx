import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exercises } from '@/lib/exercises';
import { getExercise } from '@/lib/training/service';
import ExerciseMedia from '@/components/training/ExerciseMedia';
import ExerciseInstructions from '@/components/training/ExerciseInstructions';
export function generateStaticParams() { return exercises.map(e => ({ slug: e.slug })); }
export default async function ExerciseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exercise = getExercise(slug);
  if (!exercise) notFound();
  const alternatives = exercise.alternatives.map(getExercise).filter(e => e !== undefined);
  return <div className="stack"><Link href="/training" className="textbutton">← Exercise library</Link>
    <header><p className="eyebrow">EXERCISE GUIDE · {exercise.difficulty}</p><h1>{exercise.name}</h1>
      <p>Primary: {exercise.primaryMuscles.join(', ')}{exercise.targetRegion ? ` · ${exercise.targetRegion}` : ''}</p>
      <p className="muted">Secondary: {exercise.secondaryMuscles.join(', ') || 'None listed'}</p>
      <p>Equipment: {exercise.requiredEquipment.join(', ').replaceAll('-', ' ') || 'None (bodyweight)'}</p>
      <span className="pill">Library suggestion: {exercise.prescription.sets} × {exercise.prescription.reps} {exercise.prescription.unit}</span>
      <p className="muted">Your personalised set count appears on the Training page.</p>
    </header>
    <ExerciseMedia exercise={exercise} /><ExerciseInstructions exercise={exercise} />
    <div className="cards"><section className="card cardbody"><h2>Common mistakes</h2><ul>{exercise.commonMistakes.map(s => <li key={s}>{s}</li>)}</ul></section>
      <section className="card cardbody"><h2>Safety guidance</h2><ul>{exercise.safetyTips.map(s => <li key={s}>{s}</li>)}</ul></section></div>
    <section className="card cardbody"><h2>Alternatives</h2><p className="muted">Check equipment and difficulty before choosing an alternative.</p><ul>{alternatives.map(e => <li key={e.id}><Link className="textbutton" href={`/training/exercises/${e.slug}`}>{e.name}</Link> · {e.difficulty} · {e.requiredEquipment.join(', ') || 'bodyweight'}</li>)}</ul></section>
  </div>;
}
