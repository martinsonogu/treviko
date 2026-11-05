'use client';
// Identity changes need a fresh document so the previous account's in-memory
// component and router data cannot remain visible after a session switch.
export function navigateAfterAuth(path:string) {
 const target=new URL(path,window.location.origin);
 if(target.origin!==window.location.origin)throw new Error('Invalid account destination.');
 window.location.assign(target.href);
}
