'use client';
import { useRef, useState } from 'react';
import type { Exercise } from '@/lib/training/types';
export default function ExerciseInstructions({ exercise }: { exercise: Exercise }) {
  const [tab, setTab] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <section className="card cardbody">
    <div className="instructionTabs" role="tablist" aria-label="Exercise instructions">
      {['How to Perform', 'Equipment Setup'].map((label, i) => <button key={label} ref={node => { refs.current[i] = node; }} id={`instruction-tab-${i}`} role="tab" aria-selected={tab === i} aria-controls={`instruction-panel-${i}`} tabIndex={tab === i ? 0 : -1} className={tab === i ? 'chip selected' : 'chip'} onClick={() => setTab(i)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - i;
        setTab(next); refs.current[next]?.focus();
      }}>{label}</button>)}
    </div>
    {[0, 1].map(i => <div key={i} role="tabpanel" tabIndex={0} id={`instruction-panel-${i}`} aria-labelledby={`instruction-tab-${i}`} hidden={tab !== i}>
      <h2>{i === 0 ? 'How to Perform' : 'Equipment Setup (optional)'}</h2>
      {i === 1 && !exercise.setup.length ? <p>No equipment setup is required. Choose a clear, stable space.</p> : <ol>{(i === 0 ? exercise.instructions : exercise.setup).map(step => <li key={step}>{step}</li>)}</ol>}
    </div>)}
  </section>;
}
