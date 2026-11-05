import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
async function database() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role;`);
 for(const migration of ['202611040001_milestone4.sql','202611040002_shared_ai_controls.sql','202611050001_coaching_plans.sql','202611050002_training_first.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id) values('${A}'),('${B}');`);
 return db;
}
async function asUser(db,id) { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`); }
test('actual PostgreSQL migrations enforce RLS isolation for two users and ownership-safe relationships', async()=>{
 const db=await database();
 try {
  await asUser(db,A);
  for(const table of ['profiles','user_fitness_preferences','user_nutrition_preferences']) {const result=await db.query(`select user_id from public.${table}`);assert.deepEqual(result.rows.map(r=>r.user_id),[A]);}
  await db.exec(`select public.save_profile('{"display_name":"A"}','{"equipment":[],"experience":"beginner"}','{"allergies":["peanuts"]}');`);
  assert.equal((await db.query(`select display_name from public.profiles`)).rows[0].display_name,'A');
  await db.exec(`select public.save_profile('{"display_name":"Updated A"}','{}','{}');`);
  assert.deepEqual((await db.query('select equipment from public.user_fitness_preferences')).rows[0].equipment,[]);
  assert.deepEqual((await db.query('select allergies from public.user_nutrition_preferences')).rows[0].allergies,['peanuts']);
  assert.equal((await db.query(`update public.profiles set display_name='attack' where user_id='${B}' returning user_id`)).rows.length,0);
  await assert.rejects(db.exec(`update public.profiles set user_id='${B}' where user_id='${A}'`));
  await assert.rejects(db.exec(`insert into public.coach_conversations(user_id,title) values('${B}','forged')`));
  const conversation=(await db.query(`insert into public.coach_conversations(user_id,title) values('${A}','A private') returning id`)).rows[0].id;
  await assert.rejects(db.exec(`insert into public.coach_messages(conversation_id,user_id,role,content) values('${conversation}','${A}','assistant','forged')`));
  await assert.rejects(db.exec(`select public.append_coach_turn('${A}','${conversation}','a','b','fitness','ok','live','{}')`));
  await db.exec('reset role');
  await db.exec(`insert into public.recipes(id,name,cuisine,servings,preparation_minutes,instructions,published) values('test-recipe','test fixture','test',1,5,'{test}',true);`);
  await db.exec(`select public.append_coach_turn('${A}','${conversation}','hello','general advice','fitness','ok','policy','{}');`);
  await asUser(db,A);
  const plan=(await db.query(`select public.save_meal_plan('A plan','[{"recipeId":"test-recipe","servings":1,"day":1,"mealNumber":1}]') as id`)).rows[0].id;
  assert.equal((await db.query('select * from public.coach_messages')).rows.length,2);
  await asUser(db,B);
  for(const table of ['coach_conversations','coach_messages','meal_plans','meal_plan_items']) assert.equal((await db.query(`select * from public.${table}`)).rows.length,0,table);
  assert.equal((await db.query(`update public.coach_conversations set title='B' where id='${conversation}' returning id`)).rows.length,0);
  assert.equal((await db.query(`delete from public.meal_plans where id='${plan}' returning id`)).rows.length,0);
  await assert.rejects(db.exec(`insert into public.meal_plan_items(plan_id,user_id,recipe_id,servings,day,meal_number) values('${plan}','${B}','test-recipe',1,1,2)`));
  await assert.rejects(db.exec(`insert into public.recipes(id,name,cuisine,servings,preparation_minutes,instructions) values('forged','fake','x',1,1,'{x}')`));
  await assert.rejects(db.exec(`select public.reserve_ai_usage('${B}','scope','mock',10,10,1000,1000)`));
  await asUser(db,A); await db.exec(`delete from public.coach_conversations where id='${conversation}'; delete from public.meal_plans where id='${plan}';`);
  assert.equal((await db.query('select * from public.coach_messages')).rows.length,0);assert.equal((await db.query('select * from public.meal_plan_items')).rows.length,0);
  await db.exec(`reset role; delete from auth.users where id='${A}';`);
  assert.equal((await db.query(`select * from public.profiles where user_id='${A}'`)).rows.length,0);
  await db.exec(`set role anon;`); await assert.rejects(db.query('select * from public.profiles'));
 } finally {await db.close();}
});
test('shared SQL admission, concurrency, token/cost reservations, settlement and account cascade',async()=>{
 const db=await database();
 try {
  const conversation=(await db.query(`insert into public.coach_conversations(user_id,title) values('${A}','A') returning id`)).rows[0].id;
  await db.exec('set role service_role');
  const lease=(await db.query(`select public.acquire_coach_request('${A}','${conversation}',8,30,2) as id`)).rows[0].id;
  await assert.rejects(db.exec(`select public.acquire_coach_request('${A}','${conversation}',8,30,2)`),/BUSY/);
  await assert.rejects(db.exec(`select public.acquire_coach_request('${B}','${conversation}',8,30,2)`),/NOT_FOUND/);
  await db.exec(`select public.release_coach_request('${lease}','${A}')`);
  const event=(await db.query(`select public.reserve_ai_usage('${A}','scope','mock',100,100,1000,2000,1,2,1,2) as id`)).rows[0].id;
  await assert.rejects(db.exec(`select public.reserve_ai_usage('${A}','scope','mock',900,100,1000,2000,1,2,1,2)`),/TOKEN_BUDGET/);
  await assert.rejects(db.exec(`select public.reserve_ai_usage('${B}','scope','mock',100,100,1000,2000,1000,1000,0.01,2)`),/COST_BUDGET/);
  await db.exec(`select public.settle_ai_usage('${event}','${A}',true,20,10); select public.settle_ai_usage('${event}','${A}',true,20,10);`);
  assert.equal(Number((await db.query(`select tokens from public.ai_budgets where scope='user:${A}'`)).rows[0].tokens),30);
  await asUser(db,B); assert.equal((await db.query('select * from public.usage_events')).rows.length,0);
  await asUser(db,A); assert.equal((await db.query('select * from public.usage_events')).rows.length,1);
  await db.exec(`reset role; delete from auth.users where id='${A}';`);
  assert.equal((await db.query(`select * from public.ai_rate_buckets where scope='user:${A}'`)).rows.length,0);
  for(const table of ['usage_events','ai_request_leases']) assert.equal((await db.query(`select * from public.${table} where user_id='${A}'`)).rows.length,0);
 } finally {await db.close();}
});

test('completed onboarding preferences survive leaving and returning to the user session',async()=>{
 const db=await database();
 try{
  await asUser(db,A);
  await db.exec(`select public.save_profile('{"display_name":"Saved preferences","onboarding_step":6,"onboarding_complete":true}','{"experience":"intermediate","equipment":["dumbbells"]}','{"allergies":["peanuts"]}');`);
  await asUser(db,B);assert.equal((await db.query('select onboarding_complete from public.profiles')).rows[0].onboarding_complete,false);
  await asUser(db,A);
  const profile=(await db.query('select display_name,onboarding_step,onboarding_complete from public.profiles')).rows[0];assert.equal(profile.display_name,'Saved preferences');assert.equal(profile.onboarding_step,6);assert.equal(profile.onboarding_complete,true);
  assert.deepEqual((await db.query('select equipment from public.user_fitness_preferences')).rows[0].equipment,['dumbbells']);assert.deepEqual((await db.query('select allergies from public.user_nutrition_preferences')).rows[0].allergies,['peanuts']);
 }finally{await db.close();}
});


test('coaching plans require confirmed owned proposals, protect concurrent revisions, isolate rows and cascade deletion',async()=>{
 const db=await database();
 const payload={primaryGoal:'muscle_gain',experience:'intermediate',equipment:['dumbbells'],sessionMinutes:30,rationale:'A starting option.',assumptions:[],days:[{weekday:1,name:'Full body',exercises:[{exerciseId:'shrug',sets:3,reps:'10–15',unit:'reps'}]}],meals:[{slot:1,name:'Lentil dinner',guidance:'Check labels.',recipeId:null}]};
 try{
  const insert=async(user,base,doc=payload)=>(await db.query('insert into public.plan_proposals(user_id,base_version,payload,profile_guard) values($1,$2,$3,public.coaching_profile_guard($1)) returning id',[user,base,JSON.stringify(doc)])).rows[0].id;
  const proposal=await insert(A,0), stale=await insert(A,0);
  await asUser(db,A);
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,proposal]),/permission denied/);
  await assert.rejects(db.query('insert into public.plan_proposals(user_id,base_version,payload) values($1,0,$2)',[A,JSON.stringify(payload)]),/permission denied/);
  await db.exec('reset role; set role service_role');
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,false)',[A,proposal]),/CONFIRMATION_REQUIRED/);
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,true)',[B,proposal]),/NOT_FOUND/);
  const plan=(await db.query('select public.confirm_coaching_proposal($1,$2,true) as id',[A,proposal])).rows[0].id;
  await db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,proposal]);
  assert.equal((await db.query('select version from public.coaching_plans')).rows[0].version,1);
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,stale]),/VERSION_CONFLICT/);
  const revised=await insert(A,1,{...payload,days:[{...payload.days[0],weekday:3,name:'Revised workout'}]});
  await db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,revised]);
  assert.equal((await db.query('select weekday from public.training_plan_days')).rows[0].weekday,3);
  assert.equal((await db.query('select * from public.plan_revisions')).rows.length,2);
  const cancelled=await insert(A,2);await db.query("update public.plan_proposals set status='cancelled' where id=$1",[cancelled]);
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,cancelled]),/PROPOSAL_UNAVAILABLE/);
  const expired=await insert(A,2);await db.query("update public.plan_proposals set expires_at=now()-interval '1 hour' where id=$1",[expired]);
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,expired]),/PROPOSAL_UNAVAILABLE/);
  const changedPreferences=await insert(A,2);
  await db.query("update public.profiles set display_name='Changed during review' where user_id=$1",[A]);
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,changedPreferences]),/PREFERENCES_CHANGED/);
  const badRecipe=await insert(A,2,{...payload,meals:[{...payload.meals[0],recipeId:'missing-source-recipe'}]});
  await assert.rejects(db.query('select public.confirm_coaching_proposal($1,$2,true)',[A,badRecipe]),/RECIPE_UNAVAILABLE/);
  assert.equal((await db.query('select version from public.coaching_plans')).rows[0].version,2,'failed publication rolls back the complete revision');
  assert.equal((await db.query('select name from public.training_plan_days')).rows[0].name,'Revised workout');
  await asUser(db,B);
  for(const table of ['coaching_plans','training_plan_days','training_plan_exercises','coaching_meal_ideas','nutrition_plan_references','plan_revisions','plan_proposals'])assert.equal((await db.query('select * from public.'+table)).rows.length,0,table);
  await asUser(db,A);assert.equal((await db.query('select version from public.coaching_plans')).rows[0].version,2);
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[A]);
  assert.equal((await db.query('select id from public.coaching_plans where id=$1',[plan])).rows.length,0);
 }finally{await db.close();}
});

test('partial plan confirmations preserve the other component atomically, including first nutrition-only plans',async()=>{
 const db=await database();
 const base={primaryGoal:'muscle_gain',experience:'intermediate',equipment:['dumbbells'],sessionMinutes:30,rationale:'A starting option.',assumptions:[],scope:'training_and_nutrition',days:[{weekday:1,name:'Original workout',exercises:[{exerciseId:'shrug',sets:3,reps:'10–15',unit:'reps'}]}],meals:[{slot:1,name:'Lentil dinner',guidance:'Review labels.',recipeId:'partial-recipe'}]};
 try{
  await db.exec("insert into public.recipes(id,name,cuisine,servings,preparation_minutes,instructions,published) values('partial-recipe','Lentil dinner','test',1,5,'{test}',true);set role service_role;");
  const insert=async(user,version,payload)=>(await db.query('insert into public.plan_proposals(user_id,base_version,payload,profile_guard,preference_fingerprint) values($1,$2,$3,public.coaching_profile_guard($1),$4) returning id',[user,version,JSON.stringify(payload),'guard-'+version])).rows[0].id;
  const confirm=async(user,id)=>(await db.query('select public.confirm_coaching_proposal($1,$2,true) as id',[user,id])).rows[0].id;
  const id=await confirm(A,await insert(A,0,base));
  const read=async(table,condition='plan_id')=>(await db.query(`select * from public.${table} where ${condition}=$1`,[id])).rows;
  const nutrition=await read('nutrition_plan_references'),ideas=await read('coaching_meal_ideas');const mealId=nutrition[0].meal_plan_id;
  const mealItems=(await db.query('select * from public.meal_plan_items where plan_id=$1',[mealId])).rows;
  const training={...base,scope:'training_only',primaryGoal:'strength',meals:[],days:[{...base.days[0],weekday:3,name:'Updated training'}]};
  await confirm(A,await insert(A,1,training));
  assert.deepEqual(await read('nutrition_plan_references'),nutrition);assert.deepEqual(await read('coaching_meal_ideas'),ideas);assert.deepEqual((await db.query('select * from public.meal_plan_items where plan_id=$1',[mealId])).rows,mealItems);
  const days=await read('training_plan_days');const movements=(await db.query('select * from public.training_plan_exercises where user_id=$1',[A])).rows;
  const header=(await db.query('select experience,equipment,training_days,session_minutes,training_preference_fingerprint from public.coaching_plans where id=$1',[id])).rows[0];
  const stale=await insert(A,2,training);
  const foodOnly={...base,scope:'nutrition_only',primaryGoal:'strength',days:[],meals:[{...base.meals[0],guidance:'Updated meals supporting strength and recovery.'}]};
  await confirm(A,await insert(A,2,foodOnly));
  assert.deepEqual(await read('training_plan_days'),days);assert.deepEqual((await db.query('select * from public.training_plan_exercises where user_id=$1',[A])).rows,movements);assert.deepEqual((await db.query('select experience,equipment,training_days,session_minutes,training_preference_fingerprint from public.coaching_plans where id=$1',[id])).rows[0],header);
  const snapshot=(await db.query('select snapshot from public.plan_revisions where plan_id=$1 and version=3',[id])).rows[0].snapshot;assert.equal(snapshot.days[0].name,'Updated training');assert.equal(snapshot.meals[0].guidance,foodOnly.meals[0].guidance);assert.equal(snapshot.primaryGoal,'strength');assert.equal(snapshot.scope,'training_and_nutrition');
  await assert.rejects(confirm(A,stale),/VERSION_CONFLICT/);
  const nutritionFirst=await confirm(B,await insert(B,0,foodOnly));assert.equal((await db.query('select training_days from public.coaching_plans where id=$1',[nutritionFirst])).rows[0].training_days,0);assert.equal((await db.query('select * from public.training_plan_days where plan_id=$1',[nutritionFirst])).rows.length,0);
  const ownMeals=(await db.query('select * from public.coaching_meal_ideas where plan_id=$1',[nutritionFirst])).rows;
  await confirm(B,await insert(B,1,training));assert.deepEqual((await db.query('select * from public.coaching_meal_ideas where plan_id=$1',[nutritionFirst])).rows,ownMeals);
  const forbidden=await insert(A,3,training);await assert.rejects(confirm(B,forbidden),/NOT_FOUND/);
  const before=(await db.query('select goals from public.user_fitness_preferences where user_id=$1',[A])).rows[0].goals;assert.deepEqual(before,[],'plan goals do not overwrite profile preferences');
  await asUser(db,A);assert.equal((await db.query('select * from public.coaching_plans where user_id=$1',[B])).rows.length,0);
 }finally{await db.close();}
});
