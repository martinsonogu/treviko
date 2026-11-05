import {refreshWorkoutPages} from '@/lib/workouts/cache';
import {privateRoute,readJson} from '@/lib/api/http';
import {getWorkout,updateWorkout} from '@/lib/workouts/service';
import {updateSchema} from '@/lib/workouts/schema';
type RouteContext={params:Promise<{id:string}>};
export async function GET(request:Request,route:RouteContext){const {id}=await route.params;return privateRoute(async(_request,context)=>getWorkout(context,id))(request);}
export async function PATCH(request:Request,route:RouteContext){const {id}=await route.params;return privateRoute(async(request,context)=>{const session=await updateWorkout(context,id,await readJson(request,updateSchema,48000));refreshWorkoutPages(session.id);return session;})(request);}
