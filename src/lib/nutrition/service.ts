import 'server-only';
import { z } from 'zod';
import type { AuthContext } from '../auth/session';
import { ApiError } from '../api/http';
import { foodSchema,recipeSchema,type Food,type Recipe,type mealRequestSchema } from './schema';
import { fixtureFoods,fixtureRecipes } from './fixtures';
import { fetchUsdaFood,searchUsda } from './usda';
import { recipeNutrition } from './calculations';
import type { UserProfile } from '../profile/schema';
export function fixturesAllowed() {return process.env.NUTRITION_ALLOW_FIXTURES==='true'||(process.env.NODE_ENV!=='production'&&process.env.NUTRITION_ALLOW_FIXTURES!=='false');}
export function foodFromDatabase(row:Record<string,unknown>):Food {
 const nutrientRows=z.array(z.object({nutrient:z.string(),amount_per_100g:z.number().nullable(),unit:z.string()})).parse(row.food_nutrients);
 const read=(name:string,unit:string)=>{const values=nutrientRows.filter(n=>n.nutrient===name);if(values.length>1||values.some(n=>n.unit!==unit))throw new Error('Invalid nutrient definitions');return values[0]?.amount_per_100g??null;};
 return foodSchema.parse({id:row.id,name:row.name,source:row.source,sourceId:row.source_id,sourceUrl:row.source_url,license:row.source_license,retrievedAt:row.retrieved_at,dataType:row.data_type,preparation:row.preparation,servingGrams:row.serving_grams,densityGPerMl:row.density_g_per_ml,per100g:{energyKcal:read('energy_kcal','kcal'),proteinG:read('protein_g','g'),carbohydrateG:read('carbohydrate_g','g'),fatG:read('fat_g','g')},allergens:row.allergens,allergenStatus:row.allergen_status,verified:row.verified});
}
export async function listFoods(context:AuthContext,query='') {
 const {data,error}=await context.db.from('foods').select('*,food_nutrients(*)').order('name').limit(100);
 if(error)throw new ApiError(503,'REFERENCE_UNAVAILABLE','Nutrition reference data could not load. Apply migrations and import source data.');
 let foods=(data??[]).map(foodFromDatabase);let mode: 'source'|'fixture'=foods.some(f=>f.source==='development_fixture')?'fixture':'source';
 if(!foods.length&&fixturesAllowed()){foods=fixtureFoods;mode='fixture';}
 return {foods:foods.filter(f=>f.name.toLowerCase().includes(query.toLowerCase())),mode,source:'USDA FoodData Central',priceData:'not_connected'};
}
export async function getFood(context:AuthContext,id:string) {
 const {data,error}=await context.db.from('foods').select('*,food_nutrients(*)').eq('id',id).maybeSingle();if(error)throw new ApiError(503,'REFERENCE_UNAVAILABLE','Nutrition reference data is unavailable.');
 if(data)return foodFromDatabase(data);
 const fixture=fixturesAllowed()?fixtureFoods.find(f=>f.id===id):undefined;if(fixture)return fixture;
 throw new ApiError(404,'NOT_FOUND','Food record not found.');
}
export async function sourceSearch(query:string){try{return await searchUsda(query);}catch{throw new ApiError(503,'USDA_UNAVAILABLE','Live USDA search needs a server API key and a reachable source.');}}
export async function sourceFood(id:string){try{return await fetchUsdaFood(id);}catch{throw new ApiError(503,'USDA_UNAVAILABLE','Live USDA data is unavailable.');}}
export async function listRecipes(context:AuthContext):Promise<Recipe[]> {
 const {data,error}=await context.db.from('recipes').select('*,recipe_ingredients(*)').eq('published',true).limit(100);if(error)throw new ApiError(503,'RECIPES_UNAVAILABLE','Recipe data is unavailable.');
 if(!data?.length)return fixturesAllowed()?fixtureRecipes:[];
 return data.map(row=>recipeSchema.parse({id:row.id,name:row.name,cuisine:row.cuisine,dietaryPatterns:row.dietary_patterns,servings:row.servings,preparationMinutes:row.preparation_minutes,instructions:row.instructions,ingredients:row.recipe_ingredients.map((i:{food_id:string;grams:number})=>({foodId:i.food_id,grams:i.grams})),allergens:row.allergens,allergenStatus:row.allergen_status,developmentFixture:row.development_fixture}));
}
export function recipeFits(recipe:Recipe,foods:Food[],profile:UserProfile) {
 if(profile.allergyNotes)return false; // Unknown allergies require individual ingredient review.
 if(profile.dietaryPattern!=='unspecified'&&!recipe.dietaryPatterns.includes(profile.dietaryPattern))return false;
 const ingredients=recipe.ingredients.map(i=>foods.find(f=>f.id===i.foodId));if(ingredients.some(f=>!f))return false;
 if(profile.allergies.length&&(recipe.allergenStatus!=='reviewed'||ingredients.some(f=>f!.allergenStatus!=='reviewed')))return false;
 if(profile.allergies.some(a=>recipe.allergens.includes(a)||ingredients.some(f=>f!.allergens.includes(a))))return false;
 if(profile.dislikes.some(dislike=>recipe.name.toLowerCase().includes(dislike.toLowerCase())||ingredients.some(f=>f!.name.toLowerCase().includes(dislike.toLowerCase()))))return false;
 return true;
}
export function cuisineMatches(requested:string,available:string){
 const target=requested.toLowerCase().replaceAll('-',' ').trim();const label=available.toLowerCase().replaceAll('-',' ');
 const aliases:Record<string,string>={nigerian:'african',african:'african',indian:'indian',asian:'indian',european:'mediterranean',mediterranean:'mediterranean','middle eastern':'middle eastern','latin american':'latin american'};
 return label.includes(aliases[target]??target);
}
export async function recommendMeals(context:AuthContext,profile:UserProfile,request:z.infer<typeof mealRequestSchema>) {
 const [{foods,mode},recipes]=await Promise.all([listFoods(context),listRecipes(context)]);
 let matches=recipes.filter(r=>recipeFits(r,foods,profile));const cuisine=request.cuisine||profile.cuisines[0];if(cuisine)matches=matches.filter(r=>cuisineMatches(cuisine,r.cuisine));
 if(request.maxPreparationMinutes)matches=matches.filter(r=>r.preparationMinutes<=request.maxPreparationMinutes!);
 if(request.ingredients.length)matches=matches.filter(r=>request.ingredients.every(item=>r.ingredients.some(i=>foods.find(f=>f.id===i.foodId)?.name.toLowerCase().includes(item.toLowerCase()))));
 const meals=matches.map(recipe=>({recipe,nutrition:recipeNutrition(recipe,foods)}));if(request.proteinPreference==='higher')meals.sort((a,b)=>(b.nutrition.perServing.proteinG??-1)-(a.nutrition.perServing.proteinG??-1));
 return {meals:meals.slice(0,request.count),mode,pricing:'No live pricing data. Grocery costs vary; no budget fit is claimed.',allergyNotice:'Review all ingredient labels and cross-contact risks. Unknown allergen records are excluded when allergies are declared.',message:meals.length?'Available broader-cuisine examples, not verified traditional recipes. Calculated from the listed ingredients only; seasonings and substitutions change totals.':'No reviewed recipe matches your preferences and restrictions. Broaden the cuisine or ingredients; never remove a real allergy to get a result.'};
}
