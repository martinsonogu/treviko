'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [{ href: '/', label: 'Home', symbol: '⌂' }, { href: '/coach', label: 'Coach', symbol: '✦' }, { href: '/training', label: 'Training', symbol: '◈' }, { href: '/nutrition', label: 'Nutrition', symbol: '◉' }, { href: '/progress', label: 'Progress', symbol: '▥' }];
export default function Nav({variant='mobile'}:{variant?:'mobile'|'desktop'}) { const pathname = usePathname()??''; return <nav className={`nav appNav appNav-${variant}`} aria-label={variant==='desktop'?'Main navigation':'Mobile navigation'}>{links.map(l => <Link key={l.href} aria-current={(pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href + '/'))) ? 'page' : undefined} className={(pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href + '/'))) ? 'navlink active' : 'navlink'} href={l.href}><span aria-hidden>{l.symbol}</span><span>{l.label}</span></Link>)}</nav>; }
