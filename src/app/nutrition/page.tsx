import {Suspense} from 'react';
import Link from 'next/link';
import {requirePageUser} from '@/lib/auth/session';
import {getCoachingView} from '@/lib/coaching/view';
import {NutritionPlan,coachLink} from '@/components/coaching/DailyDashboard';
import NutritionExplorer from '@/components/account/NutritionExplorer';
async function Content(){const context=await requirePageUser('/nutrition');let view;try{view=await getCoachingView(context);}catch{return <p className="notice" role="alert">Your meal plan could not load. Check the coaching-plan migration and reload.</p>;}return <><NutritionPlan view={view}/><section className="promptGrid"><Link className="promptCard" href={coachLink('Plan daily meals around my saved goals, dietary preferences, allergies and budget.')}>Plan meals with AI ↗</Link><Link className="promptCard" href="/coach?prompt=How%20can%20I%20build%20balanced%20meals%20for%20my%20goals%3F">Ask a nutrition question ↗</Link><Link className="promptCard" href={coachLink('Suggest suitable food substitutions for my saved meal plan.')}>Food substitutions ↗</Link></section><details className="card cardbody"><summary>Saved meal plans &amp; source-backed food explorer</summary><NutritionExplorer/></details></>;}
export default function Nutrition(){return <div className="stack"><header><p className="eyebrow">YOUR NUTRITION COACH</p><h1>Food that fits your life.</h1><p className="muted">Everyday meals, your preferences and one connected coaching plan.</p></header><Suspense fallback={<p role="status">Loading your meals…</p>}><Content/></Suspense></div>;}
