// Deliberate administrative import. Never invoked by an end-user request.
import nextEnv from '@next/env';
import {loadSource} from '../tests/load-source.mjs';
if(!process.argv.includes('--apply'))throw new Error('Use --apply after reviewing the fixture provenance and configuring your target project.');
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
try{
 const {createAdminSupabase}=loadSource('src/lib/supabase/admin.ts');
 const {fixtureFoods,fixtureRecipes}=loadSource('src/lib/nutrition/fixtures.ts');
 const db=createAdminSupabase();
 async function apply(table,rows){const {error}=await db.from(table).upsert(rows);if(error)throw new Error('Import failed for '+table);}
 const {fetchUsdaFood}=loadSource('src/lib/nutrition/usda.ts');
 const foods=process.argv.includes('--live')?await Promise.all(fixtureFoods.map(food=>fetchUsdaFood(food.sourceId))):fixtureFoods;
 for(const food of foods){await apply('foods',[{id:food.id,name:food.name,source:food.source,source_id:food.sourceId,source_url:food.sourceUrl,source_license:food.license,retrieved_at:food.retrievedAt,preparation:food.preparation,serving_grams:food.servingGrams,density_g_per_ml:food.densityGPerMl,allergens:food.allergens,allergen_status:food.allergenStatus,data_type:food.dataType,verified:food.verified}]);
 const map=[['energyKcal','energy_kcal','kcal',1008],['proteinG','protein_g','g',1003],['carbohydrateG','carbohydrate_g','g',1005],['fatG','fat_g','g',1004]];
 await apply('food_nutrients',map.map(([key,nutrient,unit,id])=>({food_id:food.id,nutrient,amount_per_100g:food.per100g[key],unit,source_nutrient_id:id})));
 }
 for(const recipe of fixtureRecipes){await apply('recipes',[{id:recipe.id,name:recipe.name,cuisine:recipe.cuisine,dietary_patterns:recipe.dietaryPatterns,servings:recipe.servings,preparation_minutes:recipe.preparationMinutes,instructions:recipe.instructions,allergens:recipe.allergens,allergen_status:recipe.allergenStatus,development_fixture:true,published:true}]);await apply('recipe_ingredients',recipe.ingredients.map((i,position)=>({recipe_id:recipe.id,position,food_id:i.foodId,grams:i.grams})));}
 console.log(process.argv.includes('--live')?'Imported four USDA source records and five labelled development recipes.':'Imported four development snapshots and five labelled development recipes; none marked verified live.');
}catch{console.error('Nutrition import failed. Check server-only configuration, migrations and connectivity. No credentials or provider diagnostics displayed.');process.exitCode=1;}
