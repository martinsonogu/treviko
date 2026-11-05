import Link from 'next/link';
import Brand from '@/components/Brand';
import {ProfileSettingsLink} from '@/components/account/ProfileAvatar';
import {getProfileDisplayName} from '@/lib/profile/service';
import {getPageUser} from '@/lib/auth/page-user';
import Nav from '@/components/Nav';
import ReloadButton from './ReloadButton';
export default async function ExperienceFrame({children}:{children:React.ReactNode}){
 let context;try{context=await getPageUser();}catch{return <main id="main-content" className="sessionUnavailable card cardbody"><h1>Let’s try that again.</h1><p role="alert">We couldn’t check your session. Reload the page to reconnect.</p><ReloadButton/></main>;}
 const displayName=context?await getProfileDisplayName(context).catch(()=>''):'';
 return <div className={context?'shell authenticatedShell':'shell publicShell'} data-experience={context?'authenticated':'public'}><header className="topbar"><Brand/>{context?<><Nav variant="desktop"/><ProfileSettingsLink displayName={displayName}/></>:<nav className="publicNav" aria-label="Public navigation"><Link className="publicExplore" href="/training">Exercises</Link><Link href="/login">Sign in</Link><Link className="button" href="/signup">Create account</Link></nav>}</header><main id="main-content" className="main">{children}</main>{context&&<Nav variant="mobile"/>}</div>;
}
