export type StoredContextMessage = {role:'user'|'assistant';content:string;response_status?:string|null;category?:string|null};
// Input is the owned server query's chronological result, never browser history.
export function buildCoachHistory(messages:StoredContextMessage[],message:string) {
  const relevant: {role:'user'|'assistant';content:string}[]=[];
  for(let index=0;index<messages.length;index++) {
    const row=messages[index];
    const following=messages[index+1];
    // Quarantine rejected unrelated/injection turns so they cannot keep steering later replies.
    if(row.response_status==='declined'||row.category==='unrelated') continue;
    if(row.role==='user'&&following?.role==='assistant'&&(following.response_status==='declined'||following.category==='unrelated')) continue;
    relevant.push({role:row.role,content:row.content});
  }
  let length=message.length;
  const history: typeof relevant=[];
  for(const row of [...relevant].reverse()) {
    if(history.length>=10||row.content.length>4000||length+row.content.length>12000)break;
    history.unshift(row);length+=row.content.length;
  }
  return history;
}
