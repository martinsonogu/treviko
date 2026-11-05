import {exercises} from '../exercises';
import {isConversationalGreeting} from './scope';
export type WorkoutHistoryRequest={useReference:boolean;compare:boolean;date?:string;region?:'upper'|'lower'|'full';mode?:'detail'|'overview'|'comparison';offset?:number;sessionId?:string;exerciseIds:string[];exerciseText?:string;completionCheck:boolean;adjustPlan:boolean};
const normal=(text:string)=>text.toLowerCase().replaceAll('’',"'").replaceAll('-',' ').replace(/\s+/g,' ').trim();
function direct(message:string){const text=normal(message);return (/\b(?:last|latest|previous|recent|recorded|logged|saved|completed|complete|yesterday|today|finish|finished)\b/.test(text)||/\d{4} \d{2} \d{2}/.test(text))&&/\b(?:workouts?|sessions?|train|training|sets?|reps?|weights?|loads?)\b/.test(text)||/\b(?:am i getting stronger|how has my training|what should i improve next time|what (?:weight|load) did i use)\b/.test(text);}
export function workoutHistoryRequest(message:string,history:{role:string;content:string}[]):WorkoutHistoryRequest|null{
 if(isConversationalGreeting(message))return null;
 const text=normal(message),prior=history.filter(row=>row.role==='user'),previous=prior.some(row=>direct(row.content)||/\b(?:compare|list|how many)\b.*\b(?:workouts?|sessions?)\b/.test(normal(row.content)));
 const correction=previous&&/\b(?:history|records?|progress)\b.*\b(?:shows?|says?|has|have)\b/.test(text);
 const contextualList=previous&&/^(?:list|show)(?: them| those| the workouts)?[.!?]*$/.test(text);
 const overview=contextualList||!/\b(?:can i|should i|could i|for beginners|recommend|suggest)\b/.test(text)&&(previous||/\b(?:completed|saved|logged|recorded|history|past|previous|have|my)\b/.test(text))&&(
  /\bhow many\b.*\b(?:in total|altogether|saved|completed|upper|lower|full)\b/.test(text)||
  /\b(?:how many|count|number of|list|show all)\b/.test(text)&&/\b(?:workouts?|sessions?)\b/.test(text)||
  /\b(?:show|which)\b.*\b(?:workouts|sessions)\b/.test(text));
 const comparison=/\bcompar(?:e|ison)\b/.test(text)&&/\b(?:workouts?|sessions?)\b/.test(text);
 const nextPage=previous&&/\b(?:next page|list more|show more)\b/.test(text);
 const newRegion=/\b(?:upper|lower|full)(?: body)?\b/.test(text);
 const broad=overview||comparison||correction||nextPage;
 const previousQuery=prior.toReversed().find(row=>{const value=normal(row.content);return /\b(?:how many|count|number of|list|show|which|compare|last|latest|yesterday|today)\b/.test(value)&&(/\b(?:workouts?|sessions?)\b/.test(value)||/\bin total\b/.test(value));});
 const priorRegion=correction||nextPage||contextualList?normal(previousQuery?.content??''):undefined;
 const dateText=nextPage||contextualList?previousQuery?.content??message:message;
 const regionText=newRegion?text:priorRegion??text;
 let pageRequests=0;for(const row of prior.toReversed()){if(/\b(?:next page|list more|show more)\b/.test(normal(row.content)))pageRequests++;else if(/\b(?:list|show|which|how many|count|compare)\b/.test(normal(row.content)))break;}

 const followup=/\b(?:should i (?:increase|add|raise)|what (?:about|should i improve)|next time|how (?:many|much|hard)|compare|progress|getting stronger|that (?:workout|session)|based on that|adjust my plan|change my plan)\b/.test(text);
 if(!direct(message)&&!broad&&!(/\bworkout\b/.test(text)&&/[0-9a-f]{8}-[0-9a-f-]{27}/i.test(message))&&!(previous&&followup))return null;
 const explicit=/\b(?:last|latest|yesterday|today|previous|recent|last two)\b/.test(text)||/\d{4}-\d{2}-\d{2}/.test(message);
 const exerciseText=text.match(/what (?:weight|load) did i use(?: (?:for|on))? (.+?)[?.!]*$/)?.[1]?.trim();
 const exerciseIds=exercises.filter(exercise=>{const name=normal(exercise.name),id=normal(exercise.id);return text.includes(name)||id.length>=4&&new RegExp(`\\b${id}\\b`).test(text)||Boolean(exerciseText&&name.includes(exerciseText));}).map(exercise=>exercise.id);
 return {mode:broad?(comparison?'comparison':'overview'):'detail',offset:nextPage?Math.min(1000000,(pageRequests+1)*30):0,sessionId:message.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0],useReference:previous&&!explicit&&!broad&&!newRegion,compare:comparison||/\b(?:two|compare|better|stronger|progress|increase|improve|training been going)\b/.test(text),date:dateText.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]??(/\byesterday\b/i.test(dateText)?'yesterday':/\btoday\b/i.test(dateText)?'today':undefined),region:/\bupper(?: body)?\b/.test(regionText)?'upper':/\blower(?: body)?\b/.test(regionText)?'lower':/\bfull(?: body)?\b/.test(regionText)?'full':undefined,exerciseIds,exerciseText,completionCheck:/\bdid i finish\b/.test(text),adjustPlan:/\b(?:adjust|change|revise|update)\b.*\bplan\b/.test(text)};
}
