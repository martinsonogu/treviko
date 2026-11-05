import type {ChatEntry} from './conversation-state';
export type ConversationSummary={id:string;title:string;updated_at?:string};
export function conversationTitleFromRequest(message:string){
 const normalized=Array.from(message,char=>char.codePointAt(0)!<32||char.codePointAt(0)===127?' ':char).join('').replace(/\s+/g,' ').trim();
 let title='';for(const char of normalized){if(title.length+char.length>80)break;title+=char;}return title||'New conversation';
}
export function mergeConversations(incoming:ConversationSummary[],current:ConversationSummary[]){
 const unique=new Map(incoming.map(row=>[row.id,row]));for(const row of current)unique.set(row.id,row);
 return [...unique.values()].sort((a,b)=>(b.updated_at??'').localeCompare(a.updated_at??''));
}
export function latestProposalIndexes(entries:ChatEntry[]){const indexes=new Map<string,number>();entries.forEach((entry,index)=>{const id=entry.proposalId??entry.proposal?.id;if(id)indexes.set(id,index);});return indexes;}
