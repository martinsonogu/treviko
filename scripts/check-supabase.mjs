// Read-only schema checks. Never display environment values or user records.
import env from '@next/env';
import {createClient} from '@supabase/supabase-js';
env.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('Supabase configuration is missing.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})}});
for(const [table,column] of [['profiles','user_id'],['user_fitness_preferences','user_id'],['user_nutrition_preferences','user_id'],['foods','id'],['recipes','id'],['coach_conversations','id'],['coach_messages','id'],['meal_plans','id'],['ai_budgets','scope'],['usage_events','id']]){
 const result=await db.from(table).select(column).limit(1);
 console.log(JSON.stringify({table,available:!result.error,...(['foods','recipes'].includes(table)&&!result.error?{populated:result.data.length>0}:{})}));
 if(result.error)process.exitCode=1;
}
const response=await fetch(url+'/rest/v1/',{headers:{apikey:key,Accept:'application/openapi+json'},signal:AbortSignal.timeout(10000)});
if(response.ok){const schema=await response.json();for(const name of ['save_profile','save_meal_plan','acquire_coach_request','release_coach_request','reserve_ai_usage','settle_ai_usage','append_coach_turn']){const available=Boolean(schema.paths?.['/rpc/'+name]);console.log(JSON.stringify({function:name,available}));if(!available)process.exitCode=1;}}
else{console.log('Function metadata check unavailable.');process.exitCode=1;}
