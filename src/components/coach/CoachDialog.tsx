'use client';
import {useEffect,useId,useRef} from 'react';
export default function CoachDialog({title,open,onClose,children}:{title:string;open:boolean;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);const closeButton=useRef<HTMLButtonElement>(null);const titleId=useId();
 useEffect(()=>{let frame:number|undefined;if(open&&!ref.current?.open){ref.current?.showModal();frame=requestAnimationFrame(()=>closeButton.current?.focus({preventScroll:true}));}else if(!open&&ref.current?.open)ref.current.close();return()=>{if(frame!==undefined)cancelAnimationFrame(frame);};},[open]);
 return <dialog className="coachDialog" ref={ref} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}} onClose={()=>{if(!ref.current?.open)onClose();}}><header className="coachDialogHeader"><h2 id={titleId} >{title}</h2><button type="button" className="chip" ref={closeButton} aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>Close</button></header><div className="coachDialogBody">{children}</div></dialog>;
}
