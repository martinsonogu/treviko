'use client';
import {useEffect,useRef} from 'react';
export default function CoachDialog({title,open,onClose,children}:{title:string;open:boolean;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();else if(!open&&ref.current?.open)ref.current.close();},[open]);
 return <dialog className="coachDialog" ref={ref} aria-label={title} onCancel={onClose} onClose={onClose}><div className="sectionheading"><h2>{title}</h2><button type="button" className="chip" onClick={onClose}>Close</button></div>{children}</dialog>;
}
