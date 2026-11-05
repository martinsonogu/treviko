export function conversationTitleFromRequest(message:string){
 const normalized=Array.from(message,char=>char.codePointAt(0)!<32||char.codePointAt(0)===127?' ':char).join('').replace(/\s+/g,' ').trim();
 if(/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|please|go ahead)[.!?\s]*$/i.test(normalized))return 'New conversation';
 let title='';for(const char of normalized){if(title.length+char.length>80)break;title+=char;}return title||'New conversation';
}

// Ignore acknowledgements when finding a useful title in older saved chats.
export function substantiveConversationTitle(messages:{role:string;content:string}[]){
 for(const message of messages){if(message.role!=='user')continue;const title=conversationTitleFromRequest(message.content);if(title==='New conversation'||/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|please|go ahead)[.!?\s]*$/i.test(title))continue;return title;}return undefined;
}
