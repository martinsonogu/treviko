import {privateRoute,readJson} from '@/lib/api/http';
import {getFeedback,saveFeedback,feedbackRequest} from '@/lib/workouts/feedback';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,route:Context){const {id}=await route.params;return privateRoute(async(_request,context)=>getFeedback(context,id))(request);}
export async function POST(request:Request,route:Context){const {id}=await route.params;return privateRoute(async(request,context)=>saveFeedback(context,id,await readJson(request,feedbackRequest)))(request);}
