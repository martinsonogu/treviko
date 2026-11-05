import 'server-only';
import type {AuthContext} from '../auth/session';
import {getProfile} from '../profile/service';
import {listFoods,listRecipes,recipeFits} from '../nutrition/service';
import {recipeNutrition} from '../nutrition/calculations';
import {nutrientKeys,type Nutrients} from '../nutrition/schema';
import {getActivePlan} from './service';
import {preferenceFingerprint} from './preferences';
import {dailyTraining,welcomePeriod} from './today';
const unknown=():Nutrients=>({energyKcal:null,proteinG:null,carbohydrateG:null,fatG:null});
export async function getCoachingView(context:AuthContext){
 const [profile,plan]=await Promise.all([getProfile(context),getActivePlan(context)]);
 const today=dailyTraining(plan,profile.timeZone);
 const greeting=welcomePeriod(profile.timeZone);
 const [{foods},recipes]=plan?await Promise.all([listFoods(context),listRecipes(context)]):[{foods:[]},[]];
 const linked=plan?.mealPlanId?await context.db.from('meal_plan_items').select('recipe_id,servings,meal_number,day').eq('plan_id',plan.mealPlanId).eq('user_id',context.userId):null;
 const shopping=new Map<string,{foodId:string;name:string;grams:number;sourceUrl:string;fixture:boolean}>();
 const meals=(plan?.payload.meals??[]).map(meal=>{
  const item=linked?.error?undefined:linked?.data?.find(i=>i.day===1&&i.meal_number===meal.slot&&i.recipe_id===meal.recipeId);
  const recipe=item?recipes.find(r=>r.id===meal.recipeId):undefined;
  const compatible=recipe?recipeFits(recipe,foods,profile):null;
  let nutrition:ReturnType<typeof recipeNutrition>|null=null;
  if(recipe&&compatible){try{nutrition=recipeNutrition(recipe,foods);}catch{/* Missing preparation or source data leaves values unavailable. */}}
  if(recipe&&compatible)for(const ingredient of recipe.ingredients){const food=foods.find(f=>f.id===ingredient.foodId);if(!food)continue;const grams=ingredient.grams/recipe.servings;const prior=shopping.get(food.id);shopping.set(food.id,{foodId:food.id,name:food.name,grams:grams+(prior?.grams??0),sourceUrl:food.sourceUrl,fixture:food.source==='development_fixture'});}
  return {...meal,nutrition,compatible,recipe:recipe&&compatible?recipe:null,sourceUrls:recipe&&compatible?recipe.ingredients.map(i=>foods.find(f=>f.id===i.foodId)?.sourceUrl).filter((s):s is string=>Boolean(s)):[]};
 });
 const totals=meals.length?Object.fromEntries(nutrientKeys.map(key=>[key,meals.some(m=>m.nutrition?.perServing[key]==null)?null:meals.reduce((sum,m)=>sum+m.nutrition!.perServing[key]!,0)])) as Nutrients:unknown();
 return {plan,planNeedsReview:Boolean(plan&&plan.preferenceFingerprint!==preferenceFingerprint(profile)),today,greeting,displayName:profile.displayName,onboardingComplete:profile.onboardingComplete,dietaryPattern:profile.dietaryPattern,allergies:profile.allergies,hasAllergyNotes:Boolean(profile.allergyNotes),meals,totals,shopping:[...shopping.values()]};
}
export type CoachingView=Awaited<ReturnType<typeof getCoachingView>>;
