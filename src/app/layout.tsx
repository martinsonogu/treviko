import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Treviko | Your personal coach',description:'Purposeful training, with optional nutrition coaching, built around your life.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skipLink" href="#main-content">Skip to content</a>{children}</body></html>;}
