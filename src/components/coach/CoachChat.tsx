'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CoachPayload } from '@/lib/coach/format';
import type { CoachProfile } from '@/lib/coach/schemas';
import CoachLoadingStatus from './CoachLoadingStatus';
import PlanWorkspace from '@/components/coaching/PlanWorkspace';
import CoachPreferences from '@/components/coach/CoachPreferences';
import {conversationIdFromSearch,conversationLocation,savedChatEntries,replyMatchesConversation,type ChatEntry,type SavedChat} from './conversation-state';
import ExerciseCard from '@/components/training/ExerciseCard';

type Entry=ChatEntry;
type Conversation={id:string;title:string};
type Availability = { mode: string; available: boolean; message: string; anonymous: boolean };
const suggestions = ['I want to train my traps.', 'Suggest a Nigerian high-protein dinner.', 'I prefer Indian vegetarian food.', 'How should I plan rest days?'];
export default function Coach({initialProfile}:{initialProfile:CoachProfile}) {
  const [message, setMessage] = useState('');
  const [planOpen,setPlanOpen]=useState(false);
  const [planMessage,setPlanMessage]=useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profile, setProfile] = useState<CoachProfile>(initialProfile);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [conversationId,setConversationId]=useState<string|null>(null);
  const [title,setTitle]=useState('');
  const [restoring,setRestoring]=useState(true);
  const [generating,setGenerating]=useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const active = useRef<AbortController | null>(null);
  const version = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const query=new URLSearchParams(window.location.search);const prompt=query.get('prompt')?.slice(0,2000)??'';
    queueMicrotask(()=>{if(controller.signal.aborted)return;if(query.get('plan')==='1'){setPlanOpen(true);setPlanMessage(prompt);}else if(prompt)setMessage(prompt);});
    fetch('/api/v1/coach/status', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!controller.signal.aborted) setAvailability(response.ok?body:{mode:'unavailable',available:false,message:body.error?.message||'Please sign in again to use Coach.',anonymous:false});
    }).catch(() => { if (!controller.signal.aborted) setAvailability({ mode: 'unavailable', available: false, message: 'Could not check AI availability. Reload to try again.', anonymous: true }); });
    fetch('/api/v1/coach/conversations',{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Could not load saved conversations.');if(!controller.signal.aborted)setConversations(body.data);}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});
    const requested=conversationIdFromSearch(window.location.search);
    const restoreVersion=version.current;
    const restore=requested?fetch(`/api/v1/coach/conversations/${requested}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'Saved conversation could not load.');return body.data as SavedChat;}):Promise.resolve(null);
    restore.then(chat=>{if(controller.signal.aborted||version.current!==restoreVersion)return;if(chat){setConversationId(chat.id);setTitle(chat.title);setEntries(savedChatEntries(chat));}}).catch(cause=>{if(!controller.signal.aborted&&version.current===restoreVersion)setError(cause instanceof Error?cause.message:'Saved conversation could not load.');}).finally(()=>{if(!controller.signal.aborted&&version.current===restoreVersion)setRestoring(false);});
    return () => { controller.abort(); active.current?.abort(); };
  }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [entries, busy]);
  function rememberConversation(id:string|null){window.history.replaceState(null,'',conversationLocation(window.location.pathname,window.location.search,window.location.hash,id));}
  function reset() {
    version.current++; active.current?.abort(); setBusy(false); setGenerating(false); setRestoring(false); rememberConversation(null); setEntries([]); setProfile(initialProfile); setConversationId(null); setTitle(''); setMessage(''); setError(''); inputRef.current?.focus();
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || busy || restoring || !availability?.available) return;
    const sent = message.trim();const pendingId=crypto.randomUUID();
    setEntries(current => [...current, {id:pendingId, role: 'user', text: sent }]); setMessage(''); setGenerating(true); setBusy(true); setError('');
    const controller = new AbortController(); active.current = controller;
    const requestVersion = ++version.current;
    try {
      let id=conversationId;
      if(!id){const created=await fetch('/api/v1/coach/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'New conversation'}),signal:controller.signal});const value=await created.json();if(!created.ok)throw new Error(value.error?.message||'Could not start a saved conversation.');if(requestVersion!==version.current)return;id=value.data.id;setConversationId(id);rememberConversation(id);setTitle(value.data.title);setConversations(current=>[value.data,...current]);}
      const response = await fetch('/api/v1/coach/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: sent, conversationId:id, profile }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(95000)]) });
      const body: CoachPayload = await response.json();
      if (requestVersion !== version.current) return;
      if (!response.ok) {
        setEntries(current=>current.filter(entry=>entry.id!==pendingId));
        const retry = response.headers.get('retry-after');
        setError((body.message || (body as unknown as {error?:{message?:string}}).error?.message || 'The AI coach could not respond. Please try again.') + (response.status === 429 && retry ? ` Try again in about ${retry} seconds.` : ''));
        setMessage(sent);
      } else {
        if(!id||!replyMatchesConversation(id,body))throw new Error('Conversation mismatch');
        setEntries(current => [...current, { role: 'coach', text: body.message, response: body }]);
      }
    } catch {
      if (requestVersion === version.current && !controller.signal.aborted) { setEntries(current=>current.filter(entry=>entry.id!==pendingId));setError('Could not confirm the saved reply. Reload this conversation before retrying; a reply may already have been saved.'); setMessage(sent); }
    } finally { if (requestVersion === version.current) { setBusy(false); setGenerating(false); active.current = null; inputRef.current?.focus(); } }
  }
  async function openConversation(id:string){
    const operation=++version.current;active.current?.abort();const controller=new AbortController();active.current=controller;setGenerating(false);setBusy(true);setError('');
    try{const response=await fetch(`/api/v1/coach/conversations/${id}`,{cache:'no-store',signal:controller.signal});const body=await response.json();if(operation!==version.current)return;if(!response.ok)throw new Error(body.error?.message||'Conversation could not load.');setConversationId(id);rememberConversation(id);setTitle(body.data.title);setEntries(savedChatEntries(body.data));setMessage('');}

    catch(cause){if(operation===version.current&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Could not load.');}
    finally{if(operation===version.current){setBusy(false);active.current=null;}}
  }
  async function manageConversation(remove=false){
    if(!conversationId)return;const operation=version.current;setBusy(true);setError('');
    try{const response=await fetch(`/api/v1/coach/conversations/${conversationId}`,{method:remove?'DELETE':'PATCH',headers:remove?undefined:{'Content-Type':'application/json'},body:remove?undefined:JSON.stringify({title})});const body=await response.json();if(operation!==version.current)return;if(!response.ok)throw new Error(body.error?.message||'Conversation update failed.');if(remove){setConversations(current=>current.filter(c=>c.id!==conversationId));reset();}else setConversations(current=>current.map(c=>c.id===conversationId?{...c,title}:c));}
    catch(cause){if(operation===version.current)setError(cause instanceof Error?cause.message:'Could not update.');}
    finally{if(operation===version.current)setBusy(false);}
  }
  return <div className="stack"><header><p className="eyebrow">TREVIKO COACH</p><h1>Build your rhythm.</h1><p className="muted">Training, recovery and food that fits your life.</p>
    <p className="notice" role="status">{availability ? availability.message : 'Checking live AI configuration…'}</p>
    <p className="muted">Conversations are saved to your account after each successful response. A bounded recent history and relevant preferences are sent to OpenAI. <Link className="textbutton" href="/profile">Edit saved preferences →</Link></p>
  </header>
    <details className="planEntry" open={planOpen} onToggle={event=>setPlanOpen(event.currentTarget.open)}><summary>Create or adjust my shared plan</summary>{planOpen&&<PlanWorkspace key={planMessage} initialMessage={planMessage} conversationId={conversationId}/>}</details>
    <section className="card cardbody stack"><label className="field">Saved conversations<select value={conversationId??''} disabled={busy||restoring} onChange={event=>{if(event.target.value)void openConversation(event.target.value);else reset();}}><option value="">New conversation</option>{conversations.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>{conversationId&&<><label className="field">Conversation title<input maxLength={100} value={title} onChange={event=>setTitle(event.target.value)}/></label><div className="chips"><button className="chip" disabled={busy} onClick={()=>{void openConversation(conversationId);}}>Reload saved chat</button><button className="chip" disabled={busy||!title.trim()} onClick={()=>{void manageConversation();}}>Rename</button><button className="chip" disabled={busy} onClick={()=>{void manageConversation(true);}}>Delete saved conversation</button></div></>}</section>
    <CoachPreferences profile={profile} onChange={setProfile} saved />
    <div className="sectionheading"><h2>Your conversation</h2><button className="textbutton" type="button" onClick={reset}>Start fresh conversation</button></div>
    <div className="chat coachChat" role="log" aria-label="Coach conversation" aria-live="polite" aria-relevant="additions" ref={logRef}>
      {!entries.length && <div className="bubble coach"><strong>What would you like to work on?</strong><p>Ask about training, nutrition or recovery. For exercise cards, confirm your experience and equipment above.</p></div>}
      {entries.map((entry, index) => <div key={index} className={`chatEntry ${entry.role}`}><div className={`bubble ${entry.role}`}><span className="chatSpeaker">{entry.role === 'user' ? 'You' : entry.response?.mode === 'live' ? 'Treviko · Live AI' : 'Treviko · Guidance'}</span><p className="messageText">{entry.text}</p></div>
        {entry.response?.exercises?.length ? <div className="cards chatExercises" aria-label="Recommended library exercises">{entry.response.exercises.map(exercise => <ExerciseCard key={exercise.id} exercise={exercise} />)}</div> : null}
      </div>)}
    </div>
    <CoachLoadingStatus restoring={restoring} busy={busy} generating={generating}/>
    {!entries.length && <div className="chips" aria-label="Suggested prompts">{suggestions.map(prompt => <button className="chip promptChip" type="button" key={prompt} onClick={() => { setMessage(prompt); inputRef.current?.focus(); }}>{prompt}</button>)}</div>}
    {error && <p role="alert" className="notice">{error}</p>}
    <form onSubmit={send} className="chatForm coachForm"><label className="field">Message your coach<textarea ref={inputRef} rows={3} value={message} maxLength={2000} onChange={event => setMessage(event.target.value)} placeholder="What would you like help with?" aria-describedby="coach-message-limit" /></label><button className="button" disabled={restoring || busy || !message.trim() || !availability?.available} type="submit">{busy ? 'Working…' : 'Send →'}</button></form>
    <button className="textbutton" type="button" disabled={busy||restoring||!message.trim()} onClick={()=>{setPlanMessage(message);setPlanOpen(true);document.getElementById("plan-workspace")?.scrollIntoView({behavior:"instant"});}}>Use this message to propose a plan change →</button>
    <small id="coach-message-limit" className="muted">{message.length}/2000 characters. Enter adds a new line; use Send to submit.</small>
    <p className="notice">General fitness and nutrition education, not medical diagnosis or treatment. Use Nutrition for source-backed food values and deterministic serving totals; this chat gives qualitative nutrition guidance. Exercise images remain labelled placeholders. Scope and safety checks can make mistakes.</p>
  </div>;
}
