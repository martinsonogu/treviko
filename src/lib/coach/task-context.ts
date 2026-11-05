import {buildConversationContext,declaredFacts} from './context';
import type {CoachInput} from './schemas';
import type {PlanScope} from '../coaching/scope';
export const isTaskAcceptance=(message:string)=>/^(?:go on|yes(?:[ ,]+(?:please|create it|make it|do it|go on))?|do it|make it|create it|proceed|continue|that sounds good)[.!\s]*$/i.test(message.trim());
const trainingRequest=/\b(?:i (?:want|need)|(?:create|build|make|give) (?:me|my|a|an|the)|can (?:you|we) (?:create|build|make))\b[\s\S]{0,180}\b(?:workout|training plan|programme|program|weekly routine)\b/i;
const nutritionRequest=/\b(?:create|make|plan|want|need)\b[\s\S]{0,100}\b(?:meal plan|meals|nutrition plan)\b/i;
const offer=/\b(?:i can|i could|would you like|want me to|shall i|i will|i'll)\b[\s\S]{0,140}\b(?:create|build|make|put together)\b[\s\S]{0,100}\b(?:plan|programme|program|workout)\b/i;
export function directTaskScope(message:string):PlanScope|null{
 if(/\b(?:don't|do not|never)\s+(?:want|need|make|create|plan|build)|\b(?:stop|cancel|reject)\b/i.test(message))return null;
 if(/\b(?:explain|teach me|tell me how|learn how)\b[\s\S]{0,120}\b(?:create|build|make|plan)\b/i.test(message))return null;
 if(/^(?:how|what|why|when|where|explain)\b/i.test(message.trim())&&!/\bi (?:want|need)\b/i.test(message))return null;
 const training=trainingRequest.test(message),nutrition=nutritionRequest.test(message);
 return nutrition?(training?'training_and_nutrition':'nutrition_only'):training?'training_only':null;
}
// Rebuilt per request from the owned, bounded chronological history, never browser state.
export function buildTaskContext(input:CoachInput){
 let pending:PlanScope|null=null;let offered:PlanScope|null=null;let clarification=false;
 for(const row of input.history){
  if(row.role==='user'){if(/^(?:cancel|stop|never mind|forget it|don't create)/i.test(row.content.trim())){pending=null;offered=null;clarification=false;continue;}const scope=directTaskScope(row.content);if(scope){pending=scope;offered=null;}}
  else {
   if(row.content.startsWith('Proposed plan (not active): ')){pending=null;offered=null;clarification=false;continue;}
   if(offer.test(row.content))offered=pending??'training_only';
   if(pending&&/\b(?:what|which|confirm|how many)\b[\s\S]{0,100}\b(?:equipment|days|available)\b/i.test(row.content))clarification=true;
  }
 }
 const facts=buildConversationContext(input);
 const lastPreviewIndex=input.history.reduce((latest,row,index)=>row.role==='assistant'&&row.content.startsWith('Proposed plan (not active): ')?index:latest,-1);
 const goal=facts.provenance.goals&&(facts.provenance.goals.messageIndex>lastPreviewIndex)?facts.facts.goals:undefined;
 const previous=input.history.filter(row=>row.role==='assistant').at(-1)?.content??'';
 const answer=declaredFacts(input.message,previous);
 return {pending,offered,clarification,facts,goal,acceptance:isTaskAcceptance(input.message),direct:directTaskScope(input.message),answered:clarification&&(answer.equipment!==undefined||answer.trainingFrequency!==undefined||answer.sessionMinutes!==undefined||answer.experience!==undefined)};
}
export function contextualTaskScope(input:CoachInput,classified:{explicitPlanRequest:boolean;intent:string;outcome:string;safety:string;injection:boolean;topic:string;category:string;nutritionRequested:boolean;continuationSourceIndex?:number|null},hasPreview:boolean,hasActivePlan=false){
 const task=buildTaskContext(input);
 if(!['allowed','ambiguous'].includes(classified.outcome)||classified.safety!=='none'||classified.injection||['unrelated','safety_sensitive'].includes(classified.category))return null;
 // A preview can be reviewed again, but an acceptance is never a publication command.
 if(hasPreview&&task.acceptance)return 'review' as const;
 if(task.direct)return task.direct;
 if((hasPreview||hasActivePlan)&&/^(?:use|only|make it|i (?:only have|can train|can work out))\b/i.test(input.message.trim())){const current=declaredFacts(input.message);if(current.equipment!==undefined||current.trainingFrequency!==undefined||current.sessionMinutes!==undefined)return 'training_only' as const;}
 if(task.acceptance&&(task.pending||task.offered))return task.pending??task.offered;
 if(task.answered&&task.pending)return task.pending;
 if(task.acceptance&&classified.explicitPlanRequest&&classified.continuationSourceIndex!=null&&input.history[classified.continuationSourceIndex]){if(classified.intent==='nutrition_plan')return classified.nutritionRequested?'nutrition_only' as const:null;if(classified.intent==='combined_plan')return classified.nutritionRequested?'training_and_nutrition' as const:null;return 'training_only' as const;}
 return null;
}
