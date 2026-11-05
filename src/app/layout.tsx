import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Treviko | Your personal coach',description:'Purposeful training, with optional nutrition coaching, built around your life.',appleWebApp:{capable:true,title:'Treviko',statusBarStyle:'default'},icons:{icon:[{url:'/icons/treviko-192.png',type:'image/png'}],apple:[{url:'/apple-icon.png',sizes:'180x180',type:'image/png'}]}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#143e30',colorScheme:'light',interactiveWidget:'resizes-content'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skipLink" href="#main-content">Skip to content</a>{children}</body></html>;}
