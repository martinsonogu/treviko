'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

// A single destination list keeps the web shell aligned with future native tabs.
export const primaryDestinations=[
 {href:'/',label:'Home',path:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z'},
 {href:'/coach',label:'Coach',path:'M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0ZM8 10h8M8 14h5'},
 {href:'/training',label:'Training',path:'M6 5v14M3 8v8M18 5v14M21 8v8M6 12h12'},
 {href:'/nutrition',label:'Nutrition',path:'M7 3v7m-3-7v5a3 3 0 0 0 6 0V3M7 11v10M20 3c-4 2-5 6-5 10h5M20 3v18'},
 {href:'/progress',label:'Progress',path:'M4 3v18h17M8 16v-4m5 4V8m5 8V5'},
] as const;
export function isDestinationActive(pathname:string,href:string){return pathname===href||(href!=='/'&&pathname.startsWith(href+'/'));}
export function AppNavigation({pathname,variant='mobile'}:{pathname:string;variant?:'mobile'|'desktop'}){
 return <nav className={`appNav appNav-${variant}`} aria-label={variant==='desktop'?'Main navigation':'Mobile navigation'}>{primaryDestinations.map(({href,label,path})=>{
  const active=isDestinationActive(pathname,href);
  return <Link key={href} aria-current={active?'page':undefined} className={active?'navlink active':'navlink'} href={href}><svg className="navIcon" aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg><span>{label}</span></Link>;
 })}</nav>;
}
export default function Nav({variant='mobile'}:{variant?:'mobile'|'desktop'}){return <AppNavigation pathname={usePathname()??''} variant={variant}/>;}
