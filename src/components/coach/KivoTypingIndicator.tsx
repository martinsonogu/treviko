import KivoAvatar from './KivoAvatar';
export type TypingOperation='reply'|'workout'|'meals'|'combined';
export function typingLabel(operation:TypingOperation='reply'){
 return operation==='workout'?'Kivo is preparing your workout':operation==='meals'?'Kivo is preparing your meal plan':operation==='combined'?'Kivo is preparing your training and meal plan':'Kivo is typing';
}
// The existing footer status announces this text once; the live message log ignores the decorative copy.
export default function KivoTypingIndicator({operation='reply'}:{operation?:TypingOperation}){
 return <div className="chatEntry coach typingEntry" aria-hidden="true"><div className="bubble coach typingBubble"><KivoAvatar decorative/><span className="typingCopy">{typingLabel(operation)}</span><span className="typingDots"><span/><span/><span/></span></div></div>;
}
