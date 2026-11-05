'use client';
import { useRef, useState, type FormEvent } from 'react';
import { exercises } from '@/lib/exercises';
import { identifyMuscles, recommend } from '@/lib/training/service';
import { equipmentOptions, experienceLevels, muscleGroups, type Equipment, type Exercise, type Experience, type Muscle } from '@/lib/training/types';
import ExerciseCard from '@/components/training/ExerciseCard';

const presets: Record<string, Equipment[]> = { gym: [...equipmentOptions], home: ['dumbbells', 'resistance-band'], limited: [] };
export default function Training() {
  const [muscle, setMuscle] = useState<Muscle>('Traps');
  const [experience, setExperience] = useState<Experience>('beginner');
  const [equipment, setEquipment] = useState<Equipment[]>(presets.gym);
  const [location, setLocation] = useState('gym');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<Exercise[]>(() => recommend({ muscle: 'Traps', experience: 'beginner', equipment: presets.gym }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('Traps · beginner');
  const [browse, setBrowse] = useState(false);
  const requestVersion = useRef(0);
  function changed() { requestVersion.current++; setBusy(false); setError(''); setResults([]); setSummary('Preferences changed. Get recommendations to refresh your selection.'); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const matches = message.trim() ? identifyMuscles(message) : [muscle];
    if (matches.length !== 1) { setError(matches.length ? 'Please target one muscle group at a time.' : 'No supported muscle found. Try “I want to train my traps” or choose a muscle and clear the request.'); return; }
    const target = matches[0]; setMuscle(target); setBusy(true); setError('');
    const version = ++requestVersion.current;
    try {
      const response = await fetch('/api/v1/training/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ muscle: target, experience, equipment }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Recommendations could not load.');
      if (version !== requestVersion.current) return;
      setResults(body.data); setSummary(`${target} · ${experience}`);
    } catch (cause) { if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Could not reach the API. Please try again.'); }
    finally { if (version === requestVersion.current) setBusy(false); }
  }
  return <div className="stack"><header><p className="eyebrow">TRAINING · EXERCISE LIBRARY</p><h1>Target a Muscle</h1><p className="muted">Find your next movement. Built around your experience and the equipment you actually have.</p></header>
    <form onSubmit={submit} className="card cardbody stack">
      <label className="field">Ask in your own words<input maxLength={500} value={message} onChange={e => { changed(); setMessage(e.target.value); }} placeholder="I want to train my traps." /></label>
      <fieldset><legend>Or choose a muscle</legend><div className="chips">{muscleGroups.map(m => <button type="button" key={m} aria-pressed={muscle === m} className={muscle === m ? 'chip selected' : 'chip'} onClick={() => { changed(); setMuscle(m); setMessage(''); }}>{m}</button>)}</div></fieldset>
      <div className="filterGrid"><label className="field">Experience<select value={experience} onChange={e => { changed(); setExperience(e.target.value as Experience); }}>{experienceLevels.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
        <label className="field">Training space<select value={location} onChange={e => { changed(); setLocation(e.target.value); setEquipment(presets[e.target.value]); }}><option value="gym">Gym</option><option value="home">Home</option><option value="limited">Limited equipment</option></select></label></div>
      <fieldset><legend>Available equipment</legend><p className="muted">Space presets are a starting point. Uncheck anything you don’t have. No selections means bodyweight only.</p><div className="equipmentGrid">{equipmentOptions.map(item => <label key={item}><input type="checkbox" checked={equipment.includes(item)} onChange={e => { changed(); setEquipment(current => e.target.checked ? [...current, item] : current.filter(x => x !== item)); }} /> {item.replaceAll('-', ' ')}</label>)}</div></fieldset>
      <button className="button" disabled={busy} type="submit">{busy ? 'Finding movements…' : 'Get recommendations →'}</button>
      <p className="muted">Deterministic recommendations · no live AI</p>
    </form>
    {error && <p className="notice" role="alert">{error}</p>}
    <section aria-busy={busy}><div className="sectionheading"><h2>Your recommendations</h2><span className="pill">Up to 4 movements</span></div><p className="muted" role="status">{busy ? 'Loading recommendations…' : summary}</p>
      {!busy && !results.length && <p className="notice">No recommendations to show. Update your preferences and submit. Some muscle groups need resistance equipment; we won’t substitute equipment you haven’t selected.</p>}
      <div className="cards">{results.map(exercise => <ExerciseCard key={exercise.id} exercise={exercise} />)}</div>
    </section>
    <section><button type="button" className="textbutton" aria-expanded={browse} aria-controls="exercise-library" onClick={() => setBrowse(!browse)}>{browse ? 'Hide' : 'Browse'} all {exercises.length} exercises {browse ? '−' : '+'}</button>
      {browse && <div id="exercise-library"><p className="notice">Full library · includes all equipment and difficulty levels. Library set counts are general suggestions.</p><div className="cards">{exercises.map(e => <ExerciseCard key={e.id} exercise={e} />)}</div></div>}
    </section>
    <p className="notice">General exercise information. Start light and stop if a movement causes pain. Verified exercise imagery is pending; placeholders never demonstrate technique.</p>
  </div>;
}
