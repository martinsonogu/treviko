import Link from 'next/link';
import type { Exercise } from '@/lib/training/types';
import ExerciseMedia from './ExerciseMedia';
export default function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return <article className="card"><ExerciseMedia exercise={exercise} /><div className="cardbody">
    <div className="sectionheading"><h2><Link href={`/training/exercises/${exercise.slug}`}>{exercise.name}</Link></h2><span className="pill">{exercise.prescription.sets} × {exercise.prescription.reps} {exercise.prescription.unit}</span></div>
    <p className="muted">{exercise.primaryMuscles.join(', ')} · {exercise.difficulty}</p>
    {exercise.targetRegion && <p className="targetRegion">Focus: {exercise.targetRegion}</p>}
    <p>{exercise.requiredEquipment.length ? exercise.requiredEquipment.join(', ').replaceAll('-', ' ') : 'Bodyweight · no equipment'}</p>
    <Link className="textbutton" href={`/training/exercises/${exercise.slug}`}>How to perform →</Link>
  </div></article>;
}
