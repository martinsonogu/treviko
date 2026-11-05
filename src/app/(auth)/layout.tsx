import Link from 'next/link';
import Brand from '@/components/Brand';
export default function AuthLayout({children}:{children:React.ReactNode}){return <div className="authShell"><header className="authBrand"><Brand/><p>Your personal coach. Your next step.</p></header><main id="main-content" className="authMain">{children}</main><footer className="authFooter"><Link href="/">Back to Treviko</Link></footer></div>;}
