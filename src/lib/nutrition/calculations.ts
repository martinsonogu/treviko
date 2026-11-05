import { foodSchema,nutrientKeys,quantitySchema,recipeSchema,type Food,type Nutrients,type Quantity,type Recipe } from './schema';
export function gramsFor(food:Food,quantity:Quantity) {
 const value=quantitySchema.parse(quantity); foodSchema.parse(food);
 switch(value.unit){case 'g':return value.amount;case 'kg':return value.amount*1000;case 'ml':case 'l':if(food.densityGPerMl===null)throw new Error('Density is missing: volume cannot be converted to grams.');return value.amount*(value.unit==='l'?1000:1)*food.densityGPerMl;case 'serving':if(food.servingGrams===null)throw new Error('Source serving weight is missing.');return value.amount*food.servingGrams;}
}
export function servingNutrition(food:Food,quantity:Quantity):Nutrients {
 const factor=gramsFor(food,quantity)/100;
 return Object.fromEntries(nutrientKeys.map(key=>[key,food.per100g[key]===null?null:food.per100g[key]*factor])) as Nutrients;
}
export function recipeNutrition(recipe:Recipe,foods:Food[]) {
 recipeSchema.parse(recipe);
 const totals:Nutrients={energyKcal:0,proteinG:0,carbohydrateG:0,fatG:0};
 for(const ingredient of recipe.ingredients){const food=foods.find(f=>f.id===ingredient.foodId);if(!food)throw new Error('Recipe ingredient source is missing.');if(food.preparation==='unknown')throw new Error('Ingredient preparation state is unknown.');const portion=servingNutrition(food,{amount:ingredient.grams,unit:'g'});for(const key of nutrientKeys)totals[key]=totals[key]===null||portion[key]===null?null:totals[key]+portion[key];}
 return {total:totals,perServing:Object.fromEntries(nutrientKeys.map(key=>[key,totals[key]===null?null:totals[key]/recipe.servings])) as Nutrients,kind:'calculated' as const,sourceMode:recipe.developmentFixture||foods.some(f=>f.source==='development_fixture')?'fixture' as const:'source' as const};
}
export function displayNutrient(value:number|null,unit:string) {return value===null?'Unknown':`${Math.round(value*10)/10} ${unit}`;}
