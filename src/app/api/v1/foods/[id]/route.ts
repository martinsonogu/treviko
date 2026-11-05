import {privateRoute} from '@/lib/api/http';
import {getFood} from '@/lib/nutrition/service';
export async function GET(r:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;return privateRoute(async(_r,c)=>getFood(c,id))(r);}
