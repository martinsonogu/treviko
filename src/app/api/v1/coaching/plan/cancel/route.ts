import {privateRoute,readJson} from '@/lib/api/http';
import {cancelRequestSchema} from '@/lib/coaching/schema';
import {cancelProposal} from '@/lib/coaching/service';
export const POST=privateRoute(async(request,context)=>cancelProposal(context,(await readJson(request,cancelRequestSchema)).proposalId));
