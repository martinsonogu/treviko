import 'server-only';
import {revalidatePath} from 'next/cache';
export function refreshWorkoutPages(id:string){for(const path of ['/training','/training/history','/progress',`/training/workouts/${id}`,`/training/workouts/${id}/completed`])revalidatePath(path);}
