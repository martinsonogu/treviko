'use client';
export default function TrainingError({ reset }: { reset: () => void }) { return <div role="alert" className="stack"><h1>Training could not load</h1><p>Please try again.</p><button className="button" onClick={reset}>Try again</button></div>; }
