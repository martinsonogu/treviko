'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [{ href: '/', label: 'Home', symbol: '⌂' }, { href: '/coach', label: 'Coach', symbol: '✦' }, { href: '/training', label: 'Training', symbol: '◈' }, { href: '/nutrition', label: 'Nutrition', symbol: '◉' }, { href: '/progress', label: 'Progress', symbol: '▥' }];
export default function Nav() { const pathname = usePathname(); return <nav className="nav" aria-label="Main navigation">{links.map(l => <Link key={l.href} aria-current={pathname === l.href ? 'page' : undefined} className={pathname === l.href ? 'navlink active' : 'navlink'} href={l.href}><span aria-hidden>{l.symbol}</span><span>{l.label}</span></Link>)}</nav>; }
