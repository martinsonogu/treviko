import Link from 'next/link';
import {getPageUser} from '@/lib/auth/page-user';
import Nav from '@/components/Nav';
import ReloadButton from './ReloadButton';
export default async function ExperienceFrame({children}:{children:React.ReactNode}){
 let context;try{context=await getPageUser();}catch{return <main id="main-content" className="sessionUnavailable card cardbody"><h1>Let’s try that again.</h1><p role="alert">We couldn’t check your session. Reload the page to reconnect.</p><ReloadButton/></main>;}
 return <div className={context?'shell authenticatedShell':'shell publicShell'} data-experience={context?'authenticated':'public'}><header className="topbar"><Link href="/" className="brand" aria-label="Treviko home">treviko<span>.</span></Link>{context?<><Nav variant="desktop"/><Link href="/settings" className="accountLink">Account &amp; sign out</Link></>:<nav className="publicNav" aria-label="Public navigation"><Link className="publicExplore" href="/training">Exercises</Link><Link href="/login">Sign in</Link><Link className="button" href="/signup">Create account</Link></nav>}</header><main id="main-content" className="main">{children}</main>{context&&<Nav variant="mobile"/>}</div>;
}
