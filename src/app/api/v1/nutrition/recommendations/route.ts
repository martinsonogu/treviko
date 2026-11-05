import {privateRoute,readJson} from '@/lib/api/http';
import {recommendMeals} from '@/lib/nutrition/service';
import {mealRequestSchema} from '@/lib/nutrition/schema';
import {getProfile} from '@/lib/profile/service';
export const POST=privateRoute(async(r,c)=>recommendMeals(c,await getProfile(c),await readJson(r,mealRequestSchema)));
