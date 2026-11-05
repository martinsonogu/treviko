// Existing server-written assistant records identify their owned proposal without changing stored history.
export function proposalIdFromMessage(content:string){return content.startsWith('Proposed plan (not active): ')?content.match(/\nReview proposal ([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}) in the plan preview before confirming\.$/i)?.[1]:undefined;}
export function latestProposalReference(messages:{role:string;content:string}[]){return [...messages].reverse().filter(row=>row.role==='assistant').map(row=>proposalIdFromMessage(row.content)).find(Boolean);}
