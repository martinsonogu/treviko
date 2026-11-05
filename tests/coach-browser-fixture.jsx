// Actual Coach client, with every API request replaced by an in-memory test transport.
import React from 'react';
import {createRoot} from 'react-dom/client';
import Coach from '../src/components/coach/CoachChat';
import Nav from '../src/components/Nav';
import {proposal,conversationId} from './conversation-fixture.mjs';
const messages=[],pending=[],requests=[];
const json=(data,status=200)=>Promise.resolve(Response.json(data,{status}));
window.fetch=(url,options={})=>{
 requests.push({url,method:options.method??'GET',body:options.body?JSON.parse(options.body):undefined});
 if(url==='/api/v1/coach/status')return json({available:true,message:'Fixture connection'});
 if(url==='/api/v1/coach/conversations'&&options.method==='POST')return json({data:{id:conversationId,title:'Test conversation'}});
 if(url==='/api/v1/coach/conversations')return json({data:[{id:conversationId,title:'Test conversation'}]});
 if(url===`/api/v1/coach/conversations/${conversationId}`&&options.method==='PATCH')return json({data:{id:conversationId,title:JSON.parse(options.body).title}});
 if(url===`/api/v1/coach/conversations/${conversationId}`&&options.method==='DELETE')return json({data:{deleted:true}});
 if(url==='/api/v1/coaching/plan/confirm')return json({data:{id:proposal.id,payload:proposal.payload,version:1}});
 if(url==='/api/v1/coaching/plan/cancel')return json({data:{cancelled:true}});
 if(url===`/api/v1/coach/conversations/${conversationId}`)return json({data:{id:conversationId,title:'Test conversation',messages:[...messages]}});
 if(url.startsWith('/api/v1/coaching/plan/proposals/'))return json({data:proposal});
 if(url==='/api/v1/coach/messages')return new Promise((resolve,reject)=>{const entry={body:JSON.parse(options.body),resolve,reject,signal:options.signal};pending.push(entry);options.signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});
 throw new Error('Unexpected fixture request: '+url);
};
window.__coachTest={requests,pending,reply(kind='chat'){
 const entry=pending.shift();if(!entry||entry.signal?.aborted)return;
 if(kind==='timeout'){entry.reject(new DOMException('Timeout','TimeoutError'));return;}
 if(kind==='error'){entry.resolve(Response.json({error:{message:'Fixture service failure'}},{status:503}));return;}
 const content=kind==='chat'?'A helpful answer from Kivo.':`Proposed plan (not active): ${proposal.payload.rationale}\nReview proposal ${proposal.id} in the plan preview before confirming.`;
 messages.push({role:'user',content:entry.body.message,exercises:[]},{role:'assistant',content,response_mode:'live',response_status:'ok',exercises:[]});
 const preview=kind==='meals'?{...proposal,payload:{...proposal.payload,scope:'nutrition_only',days:[],meals:[{slot:1,name:'Lentil bowl',guidance:'Choose ingredients that suit your saved restrictions.',recipeId:null}]}}:kind==='revision'?{...proposal,base_version:1}:proposal;
 entry.resolve(Response.json(kind==='chat'?{message:content,exerciseIds:[],exercises:[],mode:'live',status:'ok',conversationId}:{kind:'proposal',proposal:preview,conversationId,historySaved:true}));
},seed(count){messages.length=0;for(let i=0;i<count;i++)messages.push({role:i%2?'assistant':'user',content:`Earlier saved message ${i}. `+'Training context. '.repeat(6),response_mode:'live',response_status:'ok',exercises:[]});}};
createRoot(document.getElementById('root')).render(<div className="shell authenticatedShell"><header className="topbar"><span className="brand">Treviko</span><Nav variant="desktop"/></header><main className="main"><Coach initialProfile={{}}/></main><Nav variant="mobile"/></div>);
