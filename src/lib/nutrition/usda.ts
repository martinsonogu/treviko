import 'server-only';
import { z } from 'zod';
import { foodSchema,type Food } from './schema';
const fdcRecordSchema=z.object({fdcId:z.number().int().positive(),description:z.string().min(1),dataType:z.enum(['SR Legacy','Foundation','Survey (FNDDS)']),foodNutrients:z.array(z.object({nutrient:z.object({id:z.number(),unitName:z.string()}),amount:z.number().finite().min(0).optional()}))});
export function normalizeFdcRecord(value:unknown,fixture=false,retrievedAt=new Date().toISOString()):Food {
 const record=fdcRecordSchema.parse(value);
 function nutrient(id:number,unit:string){const matches=record.foodNutrients.filter(n=>n.nutrient.id===id);if(matches.length>1)throw new Error('Duplicate nutrient definition');const item=matches[0];if(!item||item.amount===undefined)return null;if(item.nutrient.unitName.toLowerCase()!==unit)throw new Error('Incompatible nutrient unit');return item.amount;}
 return foodSchema.parse({id:`fdc-${record.fdcId}`,name:record.description,source:fixture?'development_fixture':'usda_fdc',sourceId:String(record.fdcId),sourceUrl:`https://fdc.nal.usda.gov/food-details/${record.fdcId}/nutrients`,license:'CC0 1.0 · USDA FoodData Central',retrievedAt,dataType:record.dataType,preparation:/\b(?:cooked|boiled)\b/i.test(record.description)?'cooked':/\braw\b/i.test(record.description)?'raw':'unknown',per100g:{energyKcal:nutrient(1008,'kcal'),proteinG:nutrient(1003,'g'),carbohydrateG:nutrient(1005,'g'),fatG:nutrient(1004,'g')},servingGrams:null,densityGPerMl:null,allergens:[],allergenStatus:'unknown',verified:!fixture});
}
export async function fetchUsdaFood(id:string,transport:typeof fetch=fetch):Promise<Food> {
 if(!/^\d{1,10}$/.test(id))throw new Error('Invalid FDC ID');const key=process.env.USDA_FDC_API_KEY;if(!key)throw new Error('USDA FoodData Central is not configured.');
 const response=await transport(`https://api.nal.usda.gov/fdc/v1/food/${id}`,{headers:{'X-Api-Key':key},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('USDA source is unavailable.');return normalizeFdcRecord(await response.json());
}
export async function searchUsda(query:string,transport:typeof fetch=fetch):Promise<Food[]> {
 const key=process.env.USDA_FDC_API_KEY;if(!key)throw new Error('USDA FoodData Central is not configured.');
 const response=await transport('https://api.nal.usda.gov/fdc/v1/foods/search',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':key},body:JSON.stringify({query,pageSize:8,dataType:['Foundation','SR Legacy','Survey (FNDDS)']}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('USDA source is unavailable.');
 const result=z.object({foods:z.array(z.object({fdcId:z.number().int().positive()})).max(8)}).parse(await response.json());
 return Promise.all(result.foods.map(f=>fetchUsdaFood(String(f.fdcId),transport)));
}
