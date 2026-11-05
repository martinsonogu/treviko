'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {CoachPayload} from '@/lib/coach/format';
import type {CoachProfile} from '@/lib/coach/schemas';
import {proposalResponseSchema,proposalRowSchema,type PlanProposal} from '@/lib/coaching/schema';
import CoachLoadingStatus from './CoachLoadingStatus';
import KivoAvatar from './KivoAvatar';
import ConversationEntry from './ConversationEntry';
import ConversationHistory from './ConversationHistory';
import {conversationTitleFromRequest,mergeConversations,latestProposalIndexes,type ConversationSummary} from './conversation-ui';
import KivoTypingIndicator,{typingLabel,type TypingOperation} from './KivoTypingIndicator';
import {useConversationScroll} from './conversation-scroll';
import CoachDialog from './CoachDialog';
import {useCoachViewport} from './viewport';
import CoachPreferences from './CoachPreferences';
import {conversationIdFromSearch,conversationLocation,savedChatEntries,replyMatchesConversation,type ChatEntry,type SavedChat} from './conversation-state';


type Availability={available:boolean;message:string};
const suggestions:{prompt:string;operation:TypingOperation}[]=[{prompt:'How can I build muscle?',operation:'reply'},{prompt:'Create my training plan.',operation:'workout'},{prompt:'Explain my current workout.',operation:'reply'},{prompt:'Help me plan meals to support my training.',operation:'meals'}];
export default function Coach({initialProfile}:{initialProfile:CoachProfile}){
 const router=useRouter();const frameRef=useRef<HTMLDivElement>(null);useCoachViewport(frameRef);
 const [message,setMessage]=useState('');const [selectedProposalId,setSelectedProposalId]=useState<string|null>(null);const [entries,setEntries]=useState<ChatEntry[]>([]);const [profile,setProfile]=useState(initialProfile);
 const [conversations,setConversations]=useState<ConversationSummary[]>([]);const [conversationId,setConversationId]=useState<string|null>(null);const [title,setTitle]=useState('');
 const [restoring,setRestoring]=useState(true);const [busy,setBusy]=useState(false);const [generating,setGenerating]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [historyLoading,setHistoryLoading]=useState(true);const [historyError,setHistoryError]=useState('');const [knownPlanVersion,setKnownPlanVersion]=useState<number|null>(null);
 const historyRequest=useRef<AbortController|null>(null);const historySequence=useRef(0);const localConversations=useRef(new Map<string,ConversationSummary>());
 const [availability,setAvailability]=useState<Availability|null>(null);const [historyOpen,setHistoryOpen]=useState(false);const [settingsOpen,setSettingsOpen]=useState(false);
 const active=useRef<AbortController|null>(null);const version=useRef(0);const lock=useRef(false);const inputRef=useRef<HTMLTextAreaElement>(null);const logRef=useRef<HTMLDivElement>(null);
 const [typingOperation,setTypingOperation]=useState<TypingOperation>('reply');const draftOperation=useRef<{message:string;operation:TypingOperation}|null>(null);
 const scrolling=useConversationScroll(logRef,entries,busy,generating);
 const proposalIndexes=useMemo(()=>latestProposalIndexes(entries),[entries]);
 const focusComposer=useCallback(()=>requestAnimationFrame(()=>inputRef.current?.focus({preventScroll:true})),[]);
 function remember(id:string|null){window.history.replaceState(null,'',conversationLocation(window.location.pathname,window.location.search,window.location.hash,id));}
 const loadProposal=useCallback(async(id:string,signal?:AbortSignal)=>{const response=await fetch(`/api/v1/coaching/plan/proposals/${id}`,{cache:'no-store',signal});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'This proposal could not load.');return proposalRowSchema.parse(body.data);},[]);
 async function restoreEntries(chat:SavedChat,signal:AbortSignal){
  const rows=savedChatEntries(chat);const ids=[...new Set([...rows].reverse().map(row=>row.proposalId).filter((id):id is string=>Boolean(id)))].slice(0,5);
  const loaded=new Map<string,PlanProposal>();
  await Promise.all(ids.map(async id=>{try{loaded.set(id,await loadProposal(id,signal));}catch{/* Original messages stay available if an old preview cannot load. */}}));
  return rows.map(row=>row.proposalId&&loaded.has(row.proposalId)?{...row,proposal:loaded.get(row.proposalId)}:row);
 }
 const refreshHistory=useCallback(async(signal?:AbortSignal)=>{
  historyRequest.current?.abort();const controller=new AbortController();historyRequest.current=controller;const sequence=++historySequence.current;setHistoryLoading(true);setHistoryError('');
  try{const response=await fetch('/api/v1/coach/conversations',{cache:'no-store',signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal});const body=await response.json();if(!response.ok)throw new Error('Saved conversations could not load. Try refreshing history.');if(sequence!==historySequence.current||controller.signal.aborted||signal?.aborted)return;const merged=mergeConversations(body.data,[...localConversations.current.values()]);for(const row of body.data)localConversations.current.delete(row.id);setConversations(merged);}
  catch(cause){if(sequence===historySequence.current&&!controller.signal.aborted&&!signal?.aborted)setHistoryError(cause instanceof Error?cause.message:'Saved conversations could not load.');}
  finally{if(sequence===historySequence.current&&!controller.signal.aborted&&!signal?.aborted)setHistoryLoading(false);}
 },[]);
 useEffect(()=>{
  const controller=new AbortController();active.current=controller;const operation=version.current;
  const query=new URLSearchParams(window.location.search);queueMicrotask(()=>{if(!controller.signal.aborted)setMessage(query.get('prompt')?.slice(0,2000)??'');});
  fetch('/api/v1/coach/status',{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!controller.signal.aborted)setAvailability(response.ok?body:{available:false,message:body.error?.message||'Kivo is unavailable.'});}).catch(()=>{if(!controller.signal.aborted)setAvailability({available:false,message:'Could not check availability. Reload to try again.'});});
  queueMicrotask(()=>{if(!controller.signal.aborted)void refreshHistory(controller.signal);});
  const requested=conversationIdFromSearch(window.location.search);
  (async()=>{try{if(requested){const response=await fetch(`/api/v1/coach/conversations/${requested}`,{signal:controller.signal,cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Saved conversation could not load.');const rows=await restoreEntries(body.data,controller.signal);if(!controller.signal.aborted&&version.current===operation){setConversationId(requested);setTitle(body.data.title);setEntries(rows);}}}catch(cause){if(!controller.signal.aborted&&version.current===operation)setError(cause instanceof Error?cause.message:'Saved conversation could not load.');}finally{if(!controller.signal.aborted&&version.current===operation){setRestoring(false);active.current=null;}}})();
  return()=>{controller.abort();active.current?.abort();historyRequest.current?.abort();};
 // All restoration operates on the mount's initial URL; later switching uses openConversation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 useEffect(()=>{const input=inputRef.current;if(input){input.style.height='auto';input.style.height=`${Math.min(136,Math.max(56,input.scrollHeight))}px`;}},[message]);
 const draft=useCallback((value:string,operation:TypingOperation='reply')=>{draftOperation.current={message:value.trim(),operation};setMessage(value);inputRef.current?.focus({preventScroll:true});},[]);
 function reset(){scrolling.resetFollow();draftOperation.current=null;version.current++;active.current?.abort();active.current=null;lock.current=false;setBusy(false);setGenerating(false);setRestoring(false);setEntries([]);setProfile(initialProfile);setConversationId(null);setSelectedProposalId(null);setTitle('');setError('');setNotice('');setMessage('');setHistoryOpen(false);remember(null);focusComposer();}
 async function send(event:FormEvent){
  event.preventDefault();if(!message.trim()||lock.current||restoring||!availability?.available)return;
  const operationHint=draftOperation.current?.message===message.trim()?draftOperation.current.operation:'reply';setTypingOperation(operationHint);draftOperation.current=null;
  lock.current=true;setBusy(true);setGenerating(true);setError('');setNotice('');const sent=message.trim(),pendingId=crypto.randomUUID();setMessage('');setEntries(current=>[...current,{id:pendingId,role:'user',text:sent}]);
  const controller=new AbortController();active.current=controller;const operation=++version.current;
  try{
   let id=conversationId;
   if(!id){const response=await fetch('/api/v1/coach/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:conversationTitleFromRequest(sent)}),signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error('Could not start a saved conversation.');if(operation!==version.current)return;id=body.data.id;setConversationId(id);setTitle(body.data.title);remember(id);localConversations.current.set(body.data.id,body.data);setConversations(current=>mergeConversations([body.data],current));}
   const response=await fetch('/api/v1/coach/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:sent,conversationId:id,profile,conversationFirst:true,...(selectedProposalId?{proposalId:selectedProposalId}:{})}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(95000)])});
   const body=await response.json();if(operation!==version.current)return;
   if(!response.ok)throw new Error(body.error?.message||body.message||'Kivo could not respond. Please try again.');
   if(!replyMatchesConversation(id!,body))throw new Error('The response did not match this conversation. Reload before retrying.');
   if(body.kind==='proposal'){
    const result=proposalResponseSchema.parse(body);if(result.proposal.status!=='pending')throw new Error('The server did not return an unconfirmed preview. Reload before retrying.');setSelectedProposalId(result.proposal.id);setEntries(current=>[...current,{role:'coach',text:'Your proposal is ready to review. It becomes active only after confirmation.',proposal:result.proposal,proposalId:result.proposal.id}]);
    if(result.historySaved===false)setNotice('The preview is ready, but its conversation entry could not be saved. Review it now; it may not reappear in this chat after reloading.');
   }else{const reply=body as CoachPayload;if(typeof reply.message!=='string'||!Array.isArray(reply.exerciseIds))throw new Error('The server did not confirm a valid reply. Reload before retrying.');setEntries(current=>[...current,{role:'coach',text:reply.message,response:reply}]);}
  }catch(cause){if(operation===version.current&&!controller.signal.aborted){setEntries(current=>current.filter(row=>row.id!==pendingId));setMessage(sent);draftOperation.current={message:sent,operation:operationHint};setError(cause instanceof Error&&cause.name!=='TimeoutError'?cause.message:'Could not confirm the saved reply. Reload the conversation before retrying; a reply may already have been saved.');}}
  finally{if(operation===version.current){lock.current=false;setBusy(false);setGenerating(false);active.current=null;inputRef.current?.focus();}}
 }
 async function openConversation(id:string){
  scrolling.resetFollow();draftOperation.current=null;const operation=++version.current;active.current?.abort();const controller=new AbortController();active.current=controller;lock.current=true;setBusy(true);setGenerating(false);setError('');setNotice('');
  try{const response=await fetch(`/api/v1/coach/conversations/${id}`,{cache:'no-store',signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Conversation could not load.');const rows=await restoreEntries(body.data,controller.signal);if(operation!==version.current)return;setConversationId(id);setSelectedProposalId(null);setTitle(body.data.title);setEntries(rows);remember(id);setHistoryOpen(false);focusComposer();}
  catch(cause){if(operation===version.current&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Conversation could not load.');}
  finally{if(operation===version.current){lock.current=false;setBusy(false);setRestoring(false);active.current=null;}}
 }
 async function manageConversation(remove=false){
  if(!conversationId||lock.current)return;lock.current=true;setBusy(true);setError('');const operation=version.current;
  try{const response=await fetch(`/api/v1/coach/conversations/${conversationId}`,{method:remove?'DELETE':'PATCH',headers:remove?undefined:{'Content-Type':'application/json'},body:remove?undefined:JSON.stringify({title})});const body=await response.json();if(operation!==version.current)return;if(!response.ok)throw new Error(body.error?.message||'Conversation update failed.');if(remove){localConversations.current.delete(conversationId);setConversations(current=>current.filter(c=>c.id!==conversationId));reset();}else {const local=localConversations.current.get(conversationId);if(local)localConversations.current.set(conversationId,{...local,title});setConversations(current=>current.map(c=>c.id===conversationId?{...c,title}:c));}}
  catch(cause){if(operation===version.current)setError(cause instanceof Error?cause.message:'Could not update.');}finally{if(operation===version.current){lock.current=false;setBusy(false);}}
 }
 const proposalAction=useCallback(async(proposal:PlanProposal,action:'confirm'|'cancel')=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');const operation=version.current;
  try{const response=await fetch(`/api/v1/coaching/plan/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proposalId:proposal.id,...(action==='confirm'?{confirm:true}:{})}),signal:AbortSignal.timeout(20000)});const body=await response.json();if(operation!==version.current)return;if(!response.ok)throw new Error(body.error?.message||'Could not confirm this action. Reload before retrying.');if(action==='confirm'&&(!body.data?.id||!body.data?.payload))throw new Error('The saved plan was not confirmed. Reload before retrying.');if(action==='cancel'&&body.data?.cancelled!==true)throw new Error('Rejection was not confirmed.');setEntries(current=>current.map(row=>row.proposal?.id===proposal.id?{...row,proposal:{...row.proposal,status:action==='confirm'?'confirmed':'cancelled'}}:row));if(action==='confirm'&&typeof body.data.version==='number')setKnownPlanVersion(body.data.version);setSelectedProposalId(null);setNotice(action==='confirm'?'Your confirmed plan is saved across Home, Training and Nutrition.':'Proposal rejected. Your saved plan was kept.');router.refresh();}
  catch(cause){if(operation===version.current)setError(cause instanceof Error?cause.message:'Could not confirm the action. Reload before retrying.');}finally{if(operation===version.current){lock.current=false;setBusy(false);}}
 },[router]);
 const revealProposal=useCallback(async(id:string)=>{const operation=version.current;try{const proposal=await loadProposal(id);if(operation!==version.current)return;setEntries(current=>current.map(row=>row.proposalId===id?{...row,proposal}:row));}catch{if(operation===version.current)setError('This earlier proposal is unavailable. See your saved plan in Training or request a fresh preview.');}},[loadProposal]);
 const changeProposal=useCallback((proposal:PlanProposal,value:string)=>{setSelectedProposalId(proposal.id);draft(value,proposal.payload.scope==='nutrition_only'?'meals':proposal.payload.scope==='training_and_nutrition'?'combined':'workout');},[draft]);
 const reviewProposal=useCallback((id:string)=>{const log=logRef.current;const card=log?.querySelector(`[data-proposal-id="${id}"]`);if(log&&card){log.scrollTo({top:log.scrollTop+card.getBoundingClientRect().top-log.getBoundingClientRect().top,behavior:'instant'});}},[]);
 return <div className="coachConversation" ref={frameRef}>
  <header className="conversationHeader"><div className="conversationIdentity"><KivoAvatar decorative/><div><h1>Kivo</h1><p>Your personal coach <span className="muted">· AI</span></p></div></div><div className="conversationTools"><button type="button" className="chip" aria-label="Open conversation history" onClick={()=>setHistoryOpen(true)}>History</button><button type="button" className="chip" aria-label="Open conversation settings and privacy" onClick={()=>setSettingsOpen(true)}>Settings</button></div></header>
  <div className="conversationMessages" role="log" aria-label="Conversation with Kivo, your AI personal coach" aria-live="polite" aria-relevant="additions" ref={logRef} onScroll={scrolling.onScroll} onWheel={scrolling.onWheel} onTouchMove={scrolling.onTouchMove} onKeyDown={scrolling.onKeyDown} tabIndex={0}>
   {!entries.length&&!restoring&&<div className="conversationWelcome"><h2>What would you like to work on?</h2><p>Ask a question, build a training plan or adjust your current workout.</p><div className="conversationSuggestions" aria-label="Suggested prompts">{suggestions.map(({prompt,operation})=><button type="button" className="chip promptChip" key={prompt} onClick={()=>draft(prompt,operation)}>{prompt}</button>)}</div></div>}
   {entries.map((entry,index)=><ConversationEntry key={entry.id??index} entry={entry} showProposal={proposalIndexes.get(entry.proposalId??entry.proposal?.id??'')===index} stale={Boolean(knownPlanVersion!==null&&entry.proposal&&entry.proposal.base_version<knownPlanVersion)} busy={entry.proposalId?busy:false} onAction={proposalAction} onChange={changeProposal} onLoad={revealProposal} onReview={reviewProposal}/>)}
   {generating&&busy&&!restoring&&entries[entries.length-1]?.role==='user'&&<KivoTypingIndicator operation={typingOperation}/>}
  </div>
  <footer className="conversationComposer" id="plan-workspace"><CoachLoadingStatus restoring={restoring} busy={busy} generating={generating} typingLabel={typingLabel(typingOperation)}/>{notice&&<p role="status" className="composerNotice">{notice}</p>}{error&&<div className="composerError" role="alert"><p>{error}</p>{conversationId&&<button type="button" className="textbutton" disabled={busy} onClick={()=>void openConversation(conversationId)}>Reload saved conversation</button>}</div>}{availability?.available===false&&<p role="status" className="composerNotice">Kivo is unavailable right now. Check connection details in Settings, or reload to try again.</p>}<form onSubmit={send} className="conversationForm"><label className="visuallyHidden" htmlFor="kivo-message">Message Kivo</label><textarea id="kivo-message" ref={inputRef} rows={2} maxLength={2000} value={message} onChange={event=>{draftOperation.current=null;setMessage(event.target.value);}} placeholder="Ask Kivo about your training…" aria-describedby="coach-message-limit" onKeyDown={event=>{if(!event.nativeEvent.isComposing&&(event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();void send(event);}}}/><button className="button" type="submit" disabled={busy||restoring||!message.trim()||!availability?.available}>Send</button></form><small id="coach-message-limit" className="composerHelp">{message.length}/2000 · Enter adds a line. Ctrl/⌘ + Enter sends.</small></footer>
  <CoachDialog title="Conversation history" open={historyOpen} onClose={()=>setHistoryOpen(false)}><ConversationHistory conversations={conversations} activeId={conversationId} title={title} busy={busy} loading={historyLoading} error={historyError||error} onNew={reset} onResume={id=>void openConversation(id)} onRefresh={()=>void refreshHistory()} onTitle={setTitle} onRename={()=>void manageConversation()} onDelete={()=>void manageConversation(true)}/></CoachDialog>
  <CoachDialog title="Conversation settings and privacy" open={settingsOpen} onClose={()=>setSettingsOpen(false)}><CoachPreferences profile={profile} onChange={setProfile} saved expanded/><button type="button" className="textbutton" onClick={()=>setProfile(initialProfile)}>Reset to saved preferences</button><p className="muted">These temporary settings guide chat only. Plan previews use your saved restrictions and explicit change request. <Link className="textbutton" href="/profile">Edit saved preferences →</Link></p><details><summary>Privacy &amp; safety</summary><p>Conversations are saved to your account after successful responses. A bounded recent history and relevant preferences are sent to OpenAI. General fitness and nutrition education, not medical diagnosis or treatment. Nutrition calculations use source-backed data where available; Kivo does not invent precise food values. Exercise images remain labelled placeholders. Scope and safety checks can make mistakes.</p><p>Messages never silently update your saved preferences or active plan. Plans require a validated preview and explicit confirmation.</p></details><details><summary>Connection details</summary><p>{availability?.message??'Checking availability…'}</p><button type="button" className="chip" onClick={()=>window.location.reload()}>Reload connection</button></details></CoachDialog>
 </div>;
}
