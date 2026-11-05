import {Suspense} from 'react';
import {requirePageUser} from '@/lib/auth/session';
import {getProfile} from '@/lib/profile/service';
import SettingsOverview from '@/components/account/SettingsOverview';
import SettingsPanel from '@/components/account/SettingsPanel';
async function SettingsContent(){const context=await requirePageUser('/settings');const profile=await getProfile(context).catch(()=>null);return <><SettingsOverview profile={profile} email={context.email}/><SettingsPanel/></>;}
export default function Page(){return <div className="stack settingsLayout"><header className="settingsHeader"><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile &amp; settings</h1></header><Suspense fallback={<p role="status">Loading your profile…</p>}><SettingsContent/></Suspense></div>;}
