export default function CoachLoadingStatus({restoring,busy,generating,typingLabel='Kivo is typing'}:{restoring:boolean;busy:boolean;generating:boolean;typingLabel?:string}) {
 const label=restoring?'Loading your saved conversation…':generating?typingLabel:'Updating your conversation…';
 return <div className={`coachLoadingStatus muted${generating?' visuallyHidden':''}`} role="status" aria-live="polite" aria-atomic="true">{(restoring||busy)&&<>{!generating&&<span className="loadingSpinner" aria-hidden="true"/>}<span>{label}</span></>}</div>;
}
