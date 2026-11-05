import type {ChatEntry} from './conversation-state';
export type ConversationSummary={id:string;title:string;updated_at?:string;displayTitle?:string;historyState?:string};
export {conversationTitleFromRequest} from '@/lib/coach/conversation-title';
export function mergeConversations(incoming:ConversationSummary[],current:ConversationSummary[]){
 const unique=new Map(incoming.map(row=>[row.id,row]));for(const row of current){const merged={...unique.get(row.id),...row};if(row.title!=='New conversation'){delete merged.displayTitle;delete merged.historyState;}unique.set(row.id,merged);}
 return [...unique.values()].sort((a,b)=>(b.updated_at??'').localeCompare(a.updated_at??''));
}
export function latestProposalIndexes(entries:ChatEntry[]){const indexes=new Map<string,number>();entries.forEach((entry,index)=>{const id=entry.proposalId??entry.proposal?.id;if(id)indexes.set(id,index);});return indexes;}
