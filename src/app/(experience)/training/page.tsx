import {Suspense} from 'react';
import TrainingExplorer from '@/components/training/TrainingExplorer';
import AccountPlan from '@/components/coaching/AccountPlan';
export default function Training(){return <div className="stack"><Suspense fallback={<p role="status">Loading your training plan…</p>}><AccountPlan/></Suspense><details className="trainingLibrary" open><summary>Exercise library &amp; Target a Muscle</summary><TrainingExplorer/></details></div>;}
