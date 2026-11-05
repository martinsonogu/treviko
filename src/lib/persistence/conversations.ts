import 'server-only';
import { z } from 'zod';
import type { AuthContext } from '../auth/session';
import { ApiError } from '../api/http';
import {substantiveConversationTitle} from '../coach/conversation-title';
import { exercises } from '../exercises';
export const uuidSchema=z.string().uuid();
export const conversationSchema=z.object({title:z.string().trim().min(1).max(100).refine(value=>!containsSecret(value),'Do not save credentials').default('New conversation')}).strict();
const conversationRecordSchema=z.object({id:uuidSchema,title:z.string().min(1).max(100),created_at:z.string(),updated_at:z.string()});
export const messageRecordSchema=z.object({id:z.string().uuid(),role:z.enum(['user','assistant']),content:z.string().min(1).max(5000),category:z.string().nullable(),response_status:z.string().nullable(),response_mode:z.string().nullable(),exercise_ids:z.array(z.string()),created_at:z.string()});
export async function listConversations(context:AuthContext) {
 const {data,error}=await context.db.from('coach_conversations').select('id,title,created_at,updated_at').eq('user_id',context.userId).order('updated_at',{ascending:false}).limit(100);
 if(error)throw new ApiError(503,'CONVERSATIONS_UNAVAILABLE','Saved conversations could not load.');
 const rows=z.array(conversationRecordSchema).parse(data??[]),generic=rows.filter(row=>row.title==='New conversation');
 if(!generic.length)return rows;
 // Bounded embedded reads: at most five earliest user messages per generic conversation.
 // This is display-only: no historical title or user rename is rewritten.
 const fallback=await context.db.from('coach_conversations').select('id,coach_messages(role,content)').eq('user_id',context.userId).in('id',generic.map(row=>row.id)).eq('coach_messages.role','user').order('created_at',{referencedTable:'coach_messages',ascending:true}).order('id',{referencedTable:'coach_messages',ascending:true}).limit(5,{referencedTable:'coach_messages'});
 if(fallback.error)return rows; // History remains usable if optional title enrichment fails.
 const sources=z.array(z.object({id:uuidSchema,coach_messages:z.array(z.object({role:z.string(),content:z.string()}))})).safeParse(fallback.data);
 if(!sources.success)return rows;
 const titles=new Map(sources.data.map(row=>[row.id,{displayTitle:substantiveConversationTitle(row.coach_messages.filter(message=>!containsSecret(message.content))),historyState:row.coach_messages.length?'untitled':'empty'}]));
 return rows.map(row=>row.title==='New conversation'?{...row,...titles.get(row.id)}:row);
}
export async function createConversation(context:AuthContext,title:string) {
 const input=conversationSchema.parse({title});const {data,error}=await context.db.from('coach_conversations').insert({user_id:context.userId,title:input.title}).select('id,title,created_at,updated_at').single();
 if(error)throw new ApiError(503,'CREATE_FAILED','Conversation was not created.');return conversationRecordSchema.parse(data);
}
export async function requireConversation(context:AuthContext,id:string) {
 uuidSchema.parse(id);const {data,error}=await context.db.from('coach_conversations').select('id,title,created_at,updated_at').eq('id',id).eq('user_id',context.userId).maybeSingle();
 if(error)throw new ApiError(503,'CONVERSATION_UNAVAILABLE','Conversation could not load.');if(!data)throw new ApiError(404,'NOT_FOUND','Conversation not found.');return conversationRecordSchema.parse(data);
}
export async function getConversation(context:AuthContext,id:string,limit=500) {
 const conversation=await requireConversation(context,id);
 const {data,error}=await context.db.from('coach_messages').select('id,role,content,category,response_status,response_mode,exercise_ids,created_at').eq('conversation_id',id).eq('user_id',context.userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit);
 if(error)throw new ApiError(503,'MESSAGES_UNAVAILABLE','Saved messages could not load.');
 return {...conversation,messages:(data??[]).map(row=>{const parsed=messageRecordSchema.parse(row);return {...parsed,exercises:parsed.exercise_ids.map(id=>exercises.find(e=>e.id===id)).filter(e=>e!==undefined)};}).reverse()};
}
export async function renameConversation(context:AuthContext,id:string,title:string) {
 await requireConversation(context,id);const input=conversationSchema.parse({title});const {data,error}=await context.db.from('coach_conversations').update({title:input.title}).eq('id',id).eq('user_id',context.userId).select('id,title').single();if(error)throw new ApiError(503,'RENAME_FAILED','Conversation was not renamed.');return z.object({id:uuidSchema,title:z.string().min(1).max(100)}).parse(data);
}
export async function deleteConversation(context:AuthContext,id:string) {
 await requireConversation(context,id);const {error}=await context.db.from('coach_conversations').delete().eq('id',id).eq('user_id',context.userId);if(error)throw new ApiError(503,'DELETE_FAILED','Conversation was not deleted.');return {deleted:true};
}
export function containsSecret(value:unknown){return /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{12,})\b|(?:api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s"']{12,}/i.test(typeof value==='string'?value:JSON.stringify(value));}
