'use client';
import {useEffect,type RefObject} from 'react';
// VisualViewport covers iOS keyboards, which do not always resize the layout viewport.
export function useCoachViewport(ref:RefObject<HTMLDivElement|null>){
 useEffect(()=>{
  const viewport=window.visualViewport;
  const update=()=>{
   const height=viewport?.height??window.innerHeight;
   ref.current?.style.setProperty('--coach-viewport-height',`${height}px`);
   const editing=document.activeElement?.matches('textarea,input')??false;
   document.documentElement.classList.toggle('coachKeyboardOpen',editing&&window.innerHeight-height>100);
  };
  viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update);update();
  return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);document.documentElement.classList.remove('coachKeyboardOpen');};
 },[ref]);
}
