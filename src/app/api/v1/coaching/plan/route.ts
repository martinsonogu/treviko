import {privateRoute} from '@/lib/api/http';
import {getActivePlan,getPendingProposal} from '@/lib/coaching/service';
export const GET=privateRoute(async(_request,context)=>{const [plan,pending]=await Promise.all([getActivePlan(context),getPendingProposal(context)]);return {plan,pending:pending?.base_version===(plan?.version??0)?pending:null};});
