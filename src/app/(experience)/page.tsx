import {Suspense} from 'react';
import {HomeContent} from '@/components/coaching/HomeContent';
export default function Home(){return <Suspense fallback={<p role="status">Getting your day ready…</p>}><HomeContent/></Suspense>;}
