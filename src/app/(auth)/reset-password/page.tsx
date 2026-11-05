import {Suspense} from 'react';
import {AuthContent,type AuthQuery} from '@/components/auth/AuthContent';
export default function Page({searchParams}:{searchParams:Promise<AuthQuery>}){return <Suspense fallback={<p role="status" className="authPanel">Loading your account…</p>}><AuthContent mode="password" searchParams={searchParams}/></Suspense>;}
