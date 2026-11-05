import {privateRoute} from '@/lib/api/http';
import {getCoachingView} from '@/lib/coaching/view';
export const GET=privateRoute(async(_request,context)=>getCoachingView(context));
