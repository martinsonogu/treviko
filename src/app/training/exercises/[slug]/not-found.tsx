import Link from 'next/link';
export default function MissingExercise() { return <div className="stack"><h1>Exercise not found</h1><p>This exercise is not in our library.</p><Link className="button" href="/training">Return to Training</Link></div>; }
