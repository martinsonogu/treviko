import {refreshWorkoutPages} from '@/lib/workouts/cache';
import {privateRoute,readJson} from '@/lib/api/http';
import {listWorkouts,startWorkout} from '@/lib/workouts/service';
import {startSchema} from '@/lib/workouts/schema';
export const GET=privateRoute(async(_request,context)=>listWorkouts(context,new URL(_request.url).searchParams.has('before')?{before:new URL(_request.url).searchParams.get('before')!,beforeId:new URL(_request.url).searchParams.get('beforeId')??''}:undefined));
export const POST=privateRoute(async(request,context)=>{const session=await startWorkout(context,await readJson(request,startSchema));refreshWorkoutPages(session.id);return session;});
