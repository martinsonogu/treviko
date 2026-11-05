import KivoAvatar from './KivoAvatar';
import type {ChatEntry} from './conversation-state';
export default function CoachMessage({entry}:{entry:ChatEntry}){
 return <div className={`bubble ${entry.role}`}><span className="chatSpeaker">{entry.role==='user'?'You':<><KivoAvatar decorative/><span>Kivo · {entry.response?.mode==='live'?'Live AI':'Guidance'}</span></>}</span><p className="messageText">{entry.text}</p></div>;
}
