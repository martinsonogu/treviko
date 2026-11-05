import Link from 'next/link';
import type {UserProfile} from '@/lib/profile/schema';
import ProfileAvatar from './ProfileAvatar';
const words=(value:string)=>value.replaceAll('_',' ').replaceAll('-',' ');
const list=(values:string[]|undefined|null)=>values?.length?values.map(words).join(', '):'Not set';
function EditorLink({children}:{children:React.ReactNode}){return <Link href="/profile" className="settingsRowLink"><span>{children}</span><span aria-hidden="true">→</span></Link>;}
export default function SettingsOverview({profile,email}:{profile:UserProfile|null;email:string}){
 return <>
  <section className="settingsOverview" aria-labelledby="settings-name"><ProfileAvatar displayName={profile?.displayName} large/><div><h2 id="settings-name">{profile?.displayName||'Your profile'}</h2><p className="muted">Your Treviko account</p>{profile&&<p className="settingsAccountStatus">{profile.onboardingComplete?'Preferences saved':'Onboarding in progress'}</p>}</div></section>
  {!profile&&<p className="notice" role="alert">Your saved preferences could not load. Reload to try again. Account security and sign-out remain available.</p>}
  <section className="card settingsGroup" aria-labelledby="settings-personal"><h2 id="settings-personal">Personal details</h2><dl className="settingsFacts"><dt>Display name</dt><dd>{profile?.displayName||'Not set'}</dd><dt>Email address</dt><dd>{email||'Unavailable'}</dd>{profile&&<><dt>Units</dt><dd>{profile.units==='metric'?'Metric':'Imperial'}</dd><dt>Time zone</dt><dd>{profile.timeZone}</dd></>}</dl><EditorLink>Edit personal details</EditorLink></section>
  <section className="card settingsGroup" aria-labelledby="settings-training"><h2 id="settings-training">Training preferences</h2>{profile?<dl className="settingsFacts"><dt>Goals</dt><dd>{list(profile.goals)}</dd><dt>Experience</dt><dd>{profile.experience?words(profile.experience):'Not set'}</dd><dt>Training days</dt><dd>{profile.trainingDays===null?'Not set':`${profile.trainingDays} per week`}</dd><dt>Equipment</dt><dd>{profile.equipment===null?'Not set':profile.equipment.length?list(profile.equipment):'Bodyweight only'}</dd></dl>:<p className="muted">Saved training preferences unavailable.</p>}<EditorLink>Edit training preferences</EditorLink></section>
  <section className="card settingsGroup" aria-labelledby="settings-nutrition"><h2 id="settings-nutrition">Nutrition preferences</h2>{profile?<dl className="settingsFacts"><dt>Diet</dt><dd>{profile.dietaryPattern==='unspecified'?'Not set':words(profile.dietaryPattern)}</dd><dt>Cuisines</dt><dd>{list(profile.cuisines)}</dd><dt>Food dislikes</dt><dd>{profile.dislikes.length?profile.dislikes.join(', '):'None saved'}</dd><dt>Allergies</dt><dd>{profile.allergies.length?list(profile.allergies):'None saved'}</dd></dl>:<p className="muted">Saved nutrition preferences unavailable.</p>}<EditorLink>Edit nutrition preferences</EditorLink></section>
 </>;
}
