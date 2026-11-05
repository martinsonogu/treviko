import {Suspense} from 'react';
import {requirePageUser} from '@/lib/auth/session';
import SettingsPanel from '@/components/account/SettingsPanel';
async function Content(){await requirePageUser('/settings');return <SettingsPanel/>;}
export default function Page(){return <div className="stack"><header><p className="eyebrow">ACCOUNT</p><h1>Your settings.</h1></header><Suspense fallback={<p role="status">Loading account…</p>}><Content/></Suspense></div>;}
