import {proposalIdFromMessage} from '@/lib/coaching/proposal-reference';
import type {PlanProposal} from '@/lib/coaching/schema';
import type { CoachPayload } from '@/lib/coach/format';
export type ChatEntry = {id?:string;role:'user'|'coach';text:string;proposal?:PlanProposal;proposalId?:string;response?:Pick<CoachPayload,'mode'|'exercises'|'status'>};
export type SavedChat = {id:string;title:string;messages:{id?:string;role:'user'|'assistant';content:string;response_mode:CoachPayload['mode'];response_status:CoachPayload['status'];exercises:CoachPayload['exercises']}[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function conversationIdFromSearch(search:string){const id=new URLSearchParams(search).get('conversation');return id&&uuid.test(id)?id:null;}
export function conversationLocation(pathname:string,search:string,hash:string,id:string|null){const params=new URLSearchParams(search);if(id&&uuid.test(id))params.set('conversation',id);else params.delete('conversation');return pathname+(params.size?'?'+params.toString():'')+hash;}
export function savedChatEntries(chat:SavedChat):ChatEntry[]{return chat.messages.map(row=>({id:row.id,role:row.role==='user'?'user':'coach',text:row.content,...(row.role==='assistant'&&proposalIdFromMessage(row.content)?{proposalId:proposalIdFromMessage(row.content)}:{}),response:row.role==='assistant'?{mode:row.response_mode,status:row.response_status,exercises:row.exercises}:undefined}));}
export function replyMatchesConversation(expected:string,reply:unknown){return Boolean(reply&&typeof reply==='object'&&'conversationId' in reply&&reply.conversationId===expected);}

export {proposalIdFromMessage} from '@/lib/coaching/proposal-reference';
