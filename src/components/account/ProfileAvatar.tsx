import Link from 'next/link';

export function profileInitials(displayName:string){
 const parts=displayName.normalize('NFC').trim().split(/\s+/).map(part=>part.match(/[\p{L}\p{N}]/u)?.[0]).filter((part):part is string=>Boolean(part));
 if(!parts.length)return '';
 return Array.from((parts.length===1?parts[0]:parts[0]+parts[parts.length-1]).toLocaleUpperCase('en')).slice(0,2).join('');
}
export default function ProfileAvatar({displayName='',decorative=false,large=false}:{displayName?:string;decorative?:boolean;large?:boolean}){
 const initials=profileInitials(displayName);
 return <span className={`profileAvatar${large?' profileAvatar-large':''}`} role={decorative?undefined:'img'} aria-label={decorative?undefined:'Your profile avatar'} aria-hidden={decorative?'true':undefined}>{initials||<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>}</span>;
}
export function ProfileSettingsLink({displayName=''}:{displayName?:string}){return <Link href="/settings" className="profileSettingsLink" aria-label="Open profile and settings"><ProfileAvatar displayName={displayName} decorative/></Link>;}
