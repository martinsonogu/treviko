'use client';
import type { CoachProfile } from '@/lib/coach/schemas';
import { equipmentOptions, experienceLevels } from '@/lib/training/types';
export default function CoachPreferences({ profile, onChange, saved=false,expanded=false }: { profile: CoachProfile; onChange: (profile: CoachProfile) => void; saved?:boolean;expanded?:boolean }) {
  function text(key: keyof CoachProfile, value: string) { onChange({ ...profile, [key]: value.trim() ? value : undefined }); }
  const goals=(profile.goals??'').split(';').map(goal=>goal.trim()).filter(Boolean);
  const Container=expanded?'section':'details';
  return <Container className={expanded?'coachPreferenceGroups':'card cardbody coachPreferences'}>{expanded?<h3>Temporary coaching preferences</h3>:<summary>Coach preferences <span className="muted">· this conversation only</span></summary>}
    <p className="muted">{saved?'Your saved preferences are loaded. Edits here apply only to this conversation; use Profile to save permanent changes.':'Share only what you want used in this chat. These preferences are not saved to an account.'} Confirm experience and equipment for exercise recommendations.</p>
    <div className="filterGrid">
      <label className="field">Experience<select value={profile.experience ?? ''} onChange={event => onChange({ ...profile, experience: event.target.value ? event.target.value as CoachProfile['experience'] : undefined })}><option value="">Not provided</option>{experienceLevels.map(level => <option value={level} key={level}>{level}</option>)}</select></label>
      <label className="field">Training days per week<select value={profile.trainingFrequency ?? ''} onChange={event => onChange({ ...profile, trainingFrequency: event.target.value ? Number(event.target.value) : undefined })}><option value="">Not provided</option>{[1, 2, 3, 4, 5, 6, 7].map(days => <option key={days} value={days}>{days}</option>)}</select></label>
    </div>
    <section className="temporaryGoals" aria-label="Coaching goals"><h4>Coaching goals</h4>{goals.length?<ul>{goals.map((goal,index)=><li key={index}>{goal}</li>)}</ul>:<p className="muted">No goals provided.</p>}<p className="muted">{goals.length>1?'No primary goal is specified. These goals are shown in their saved order.':'No primary goal is specified in your Profile.'} Tell Kivo which goal to focus on for a particular request.</p><details><summary>Edit goals for this conversation</summary><label className="field">Fitness goals<input maxLength={500} value={profile.goals ?? ''} placeholder="e.g. build strength" onChange={event=>text('goals',event.target.value)}/></label><p className="muted">Separate goals with semicolons. Changes here do not update Profile or saved plans.</p></details></section>
    <details className="preferenceSection"><summary>Available equipment</summary><fieldset><legend className="visuallyHidden">Available equipment</legend><div className="equipmentGrid">{equipmentOptions.map(item => <label key={item}><input type="checkbox" checked={profile.equipment?.includes(item) ?? false} onChange={event => onChange({ ...profile, equipment: event.target.checked ? [...(profile.equipment ?? []), item] : (profile.equipment ?? []).filter(value => value !== item) })} />{item.replaceAll('-', ' ')}</label>)}</div>
      <label className="equipmentConfirmation"><input type="checkbox" checked={profile.equipment !== undefined} onChange={event => onChange({ ...profile, equipment: event.target.checked ? (profile.equipment ?? []) : undefined })} /> I confirm these equipment selections. None checked means bodyweight only.</label>
    </fieldset></details>
    <details className="preferenceSection"><summary>Optional food preferences</summary><div className="filterGrid">{([
      ['dietaryPreferences', 'Food and cuisine preferences', 'e.g. Indian vegetarian meals'],
      ['allergies', 'Allergies to consider', 'e.g. peanuts; or none known'],
      ['foodBudget', 'Food budget and currency', 'e.g. £45 per week'],
    ] as const).map(([key, label, placeholder]) => <label key={key} className="field">{label}<input maxLength={500} value={profile[key] ?? ''} placeholder={placeholder} onChange={event => text(key, event.target.value)} /></label>)}</div>
    </details><details className="preferenceSection"><summary>Additional training context</summary><label className="field">Existing workout plan (optional)<textarea maxLength={1500} rows={2} value={profile.existingWorkoutPlan ?? ''} onChange={event => text('existingWorkoutPlan', event.target.value)} /></label>
    <label className="field">Recent training (optional)<textarea maxLength={1500} rows={2} value={profile.recentTrainingHistory ?? ''} onChange={event => text('recentTrainingHistory', event.target.value)} /></label>
  </details></Container>;
}
