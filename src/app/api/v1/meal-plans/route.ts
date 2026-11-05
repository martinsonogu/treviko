import {privateRoute,readJson} from '@/lib/api/http';
import {listMealPlans,saveMealPlan} from '@/lib/persistence/meal-plans';
import {mealPlanSchema} from '@/lib/nutrition/schema';
export const GET=privateRoute(async(_r,c)=>listMealPlans(c));
export const POST=privateRoute(async(r,c)=>saveMealPlan(c,await readJson(r,mealPlanSchema)));
