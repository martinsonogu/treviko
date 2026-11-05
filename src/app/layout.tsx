import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav';
import './globals.css';
export const metadata: Metadata = { title: 'Treviko | Your fitness companion', description: 'Nutrition and strength coaching, built around your lifestyle.' };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body><div className="shell"><header className="topbar"><Link href="/" className="brand">treviko<span>.</span></Link><Link href="/profile" className="accountLink">Your account →</Link></header><main className="main">{children}</main><Nav /></div></body></html>; }
