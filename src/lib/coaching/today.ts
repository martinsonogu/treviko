import type {ActivePlan} from './schema';
export const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function dailyTraining(plan:ActivePlan|null,timeZone:string,now=new Date()){
 const weekday=new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'long'}).format(now);
 const isoDay=weekdays.indexOf(weekday)+1;
 return {weekday,isoDay,workout:plan?.status==='active'?plan.payload.days.find(d=>d.weekday===isoDay)??null:null};
}
export function welcomePeriod(timeZone:string,now=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone,hour:'numeric',hourCycle:'h23'}).format(now));
 return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
}
