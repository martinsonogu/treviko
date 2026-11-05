'use client';
import {useEffect,useRef,type RefObject} from 'react';
import type {ChatEntry} from './conversation-state';
export function nearConversationBottom(log:{scrollHeight:number;scrollTop:number;clientHeight:number}){return log.scrollHeight-log.scrollTop-log.clientHeight<=64;}
export function useConversationScroll(ref:RefObject<HTMLDivElement|null>,entries:ChatEntry[],busy:boolean,generating:boolean){
 const following=useRef(true);const automatic=useRef(false);const frame=useRef<number|undefined>(undefined);
 useEffect(()=>{
  const log=ref.current;if(!log)return;
  const follow=()=>{
   if(!following.current)return;
   const last=log.lastElementChild;
   const top=!generating&&entries[entries.length-1]?.proposal&&last?log.scrollTop+last.getBoundingClientRect().top-log.getBoundingClientRect().top:log.scrollHeight;
   if(frame.current!==undefined)cancelAnimationFrame(frame.current);
   automatic.current=true;log.scrollTo({top,behavior:'instant'});
   frame.current=requestAnimationFrame(()=>{automatic.current=false;});
  };
  follow();const resize=new ResizeObserver(follow);resize.observe(log);
  return()=>{resize.disconnect();if(frame.current!==undefined)cancelAnimationFrame(frame.current);automatic.current=false;};
 },[entries,busy,generating,ref]);
 return {
  resetFollow:()=>{following.current=true;},
  onScroll:()=>{if(ref.current&&!automatic.current)following.current=nearConversationBottom(ref.current);},
  onWheel:(event:{deltaY:number})=>{if(event.deltaY<0){following.current=false;automatic.current=false;}},
  onTouchMove:()=>{automatic.current=false;},
  onKeyDown:(event:{key:string})=>{if(['ArrowUp','PageUp','Home'].includes(event.key)){following.current=false;automatic.current=false;}},
 };
}
