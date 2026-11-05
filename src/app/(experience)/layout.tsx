import {Suspense} from 'react';
import ExperienceFrame from '@/components/layout/ExperienceFrame';
export default function ExperienceLayout({children}:{children:React.ReactNode}){return <Suspense fallback={<main id="main-content" className="sessionUnavailable" role="status">Getting Treviko ready…</main>}><ExperienceFrame>{children}</ExperienceFrame></Suspense>;}
