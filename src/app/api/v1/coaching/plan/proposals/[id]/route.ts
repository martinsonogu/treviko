import {privateRoute} from '@/lib/api/http';
import {getProposal} from '@/lib/coaching/service';
import {uuidSchema} from '@/lib/persistence/conversations';
export const GET=privateRoute(async(request,context)=>getProposal(context,uuidSchema.parse(new URL(request.url).pathname.split('/').pop())));
