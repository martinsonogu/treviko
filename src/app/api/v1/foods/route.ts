import {privateRoute,ApiError} from '@/lib/api/http';
import {listFoods,sourceSearch} from '@/lib/nutrition/service';
export const GET=privateRoute(async(r,c)=>{const url=new URL(r.url);const q=url.searchParams.get('q')||'';if(q.length>100)throw new ApiError(400,'INVALID_QUERY','Search is limited to 100 characters.');if(url.searchParams.get('source')==='live'){if(!q.trim())throw new ApiError(400,'QUERY_REQUIRED','Enter a food search.');return {foods:await sourceSearch(q),mode:'source',source:'USDA FoodData Central'};}return listFoods(c,q);});
