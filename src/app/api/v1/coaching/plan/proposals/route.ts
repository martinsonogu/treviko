import {privateRoute,readJson} from '@/lib/api/http';
import {proposalRequestSchema} from '@/lib/coaching/schema';
import {planStep} from '@/lib/coaching/errors';
import {proposePlan} from '@/lib/coaching/workflow';
export const POST=privateRoute(async(request,context)=>proposePlan(context,await planStep('request',()=>readJson(request,proposalRequestSchema)),request));
