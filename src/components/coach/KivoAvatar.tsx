export default function KivoAvatar({decorative=false}:{decorative?:boolean}){
 return <svg className="kivoAvatar" width="40" height="40" viewBox="0 0 40 40" role={decorative?undefined:'img'} aria-label={decorative?undefined:'Kivo, your AI personal coach'} aria-hidden={decorative?'true':undefined} focusable="false"><rect width="40" height="40" rx="14" fill="#143e30"/><path d="m10 26 7-14 5 8 8-6-8 15-5-8Z" fill="#b7e7c2"/><circle cx="29" cy="10" r="2" fill="#45a477"/></svg>;
}
