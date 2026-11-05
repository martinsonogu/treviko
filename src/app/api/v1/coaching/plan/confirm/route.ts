import {privateRoute,readJson} from '@/lib/api/http';
import {confirmRequestSchema} from '@/lib/coaching/schema';
import {confirmPlan} from '@/lib/coaching/workflow';
export const POST=privateRoute(async(request,context)=>confirmPlan(context,(await readJson(request,confirmRequestSchema)).proposalId));
