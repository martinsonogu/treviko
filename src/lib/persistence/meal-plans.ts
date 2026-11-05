import 'server-only';
import {z} from 'zod';
import type {AuthContext} from '../auth/session';
import {ApiError} from '../api/http';
import {mealPlanSchema} from '../nutrition/schema';
import {getProfile} from '../profile/service';
import {listFoods,listRecipes,recipeFits} from '../nutrition/service';
export async function listMealPlans(context:AuthContext){const {data,error}=await context.db.from('meal_plans').select('id,title,created_at,meal_plan_items(id,recipe_id,servings,day,meal_number)').eq('user_id',context.userId).order('created_at',{ascending:false}).limit(50);if(error)throw new ApiError(503,'PLANS_UNAVAILABLE','Meal plans could not load.');return z.array(z.object({id:z.string().uuid(),title:z.string().min(1).max(100),created_at:z.string(),meal_plan_items:z.array(z.object({id:z.string().uuid(),recipe_id:z.string(),servings:z.number().positive(),day:z.number().int().min(1).max(7),meal_number:z.number().int().min(1).max(8)}))})).parse(data??[]);}
export async function saveMealPlan(context:AuthContext,input:z.infer<typeof mealPlanSchema>){
 const body=mealPlanSchema.parse(input);const [profile,{foods},recipes]=await Promise.all([getProfile(context),listFoods(context),listRecipes(context)]);
 for(const item of body.items){const recipe=recipes.find(r=>r.id===item.recipeId);if(!recipe||!recipeFits(recipe,foods,profile))throw new ApiError(400,'UNSUITABLE_RECIPE','A recipe no longer matches your saved dietary or allergy restrictions.');}
 const {data,error}=await context.db.rpc('save_meal_plan',{p_title:body.title,p_items:body.items});if(error)throw new ApiError(503,'PLAN_NOT_SAVED','Meal plan was not saved. Import the referenced recipe records and try again.');return {id:z.string().uuid().parse(data),saved:true};
}
export async function deleteMealPlan(context:AuthContext,id:string){z.string().uuid().parse(id);const {data,error}=await context.db.from('meal_plans').delete().eq('id',id).eq('user_id',context.userId).select('id');if(error)throw new ApiError(503,'DELETE_FAILED','Meal plan was not deleted.');if(!data?.length)throw new ApiError(404,'NOT_FOUND','Meal plan not found.');return {deleted:true};}
