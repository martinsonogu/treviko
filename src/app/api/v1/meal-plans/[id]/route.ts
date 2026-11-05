import {privateRoute} from '@/lib/api/http';
import {deleteMealPlan} from '@/lib/persistence/meal-plans';
export async function DELETE(r:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;return privateRoute(async(_r,c)=>deleteMealPlan(c,id))(r);}
