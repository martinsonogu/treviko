export default function CoachLoadingStatus({restoring,busy,generating}:{restoring:boolean;busy:boolean;generating:boolean}) {
 const label=restoring?'Loading your saved conversation…':generating?'Coach is preparing your response…':'Updating your conversation…';
 return <div className="coachLoadingStatus muted" role="status" aria-live="polite" aria-atomic="true">{(restoring||busy)&&<><span className="loadingSpinner" aria-hidden="true"/><span>{label}</span></>}</div>;
}
