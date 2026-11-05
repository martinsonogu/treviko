import {Suspense} from 'react';
import {requirePageUser} from '@/lib/auth/session';
import ProgressEmpty from '@/components/account/ProgressEmpty';
async function Content(){await requirePageUser('/progress');return <ProgressEmpty/>;}
export default function Progress(){return <Suspense fallback={<p role="status">Loading your progress…</p>}><Content/></Suspense>;}
