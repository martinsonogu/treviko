'use client';
import {memo} from 'react';
import type {PlanProposal} from '@/lib/coaching/schema';
import type {ChatEntry} from './conversation-state';
import CoachMessage from './CoachMessage';
import InlineProposal from './InlineProposal';
import ExerciseCard from '@/components/training/ExerciseCard';
type Props={entry:ChatEntry;showProposal:boolean;stale:boolean;busy:boolean;onAction:(proposal:PlanProposal,action:'confirm'|'cancel')=>void;onChange:(proposal:PlanProposal,message:string)=>void;onLoad:(id:string)=>void;onReview:(id:string)=>void};
export default memo(function ConversationEntry({entry,showProposal,stale,busy,onAction,onChange,onLoad,onReview}:Props){
 return <article className={`chatEntry ${entry.role}`}><CoachMessage entry={entry.proposalId?{...entry,text:'Your proposal is ready to review. It becomes active only after confirmation.'}:entry}/>{entry.proposal&&showProposal?<InlineProposal proposal={entry.proposal} stale={stale} busy={busy} onConfirm={()=>onAction(entry.proposal!,'confirm')} onReject={()=>onAction(entry.proposal!,'cancel')} onChange={value=>onChange(entry.proposal!,value)}/>:entry.proposalId?<button type="button" className="textbutton" disabled={busy} onClick={()=>entry.proposal?onReview(entry.proposalId!):onLoad(entry.proposalId!)}>{entry.proposal?'Review latest preview':'Load plan preview'}</button>:null}{entry.response?.exercises?.length?<div className="cards chatExercises">{entry.response.exercises.map(exercise=><ExerciseCard key={exercise.id} exercise={exercise}/>)}</div>:null}</article>;
});
