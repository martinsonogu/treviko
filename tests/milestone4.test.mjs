import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';
const {emptyProfile,userProfileSchema,profilePatchSchema}=load('src/lib/profile/schema.ts');
const {profileForCoach,projectCoachProfile}=load('src/lib/profile/personalisation.ts');
const {signupSchema,loginSchema,recoverySchema,safeNext}=load('src/lib/auth/schemas.ts');
const session=load('src/lib/auth/session.ts');const supabase=load('src/lib/supabase/server.ts');const admin=load('src/lib/supabase/admin.ts');const configuration=load('src/lib/supabase/config.ts');
const {authHandler}=load('src/lib/auth/service.ts');const {privateRoute,readJson}=load('src/lib/api/http.ts');
const {normalizeFdcRecord}=load('src/lib/nutrition/usda.ts');const {fixtureFoods,fixtureRecipes}=load('src/lib/nutrition/fixtures.ts');
const {servingNutrition,recipeNutrition,gramsFor}=load('src/lib/nutrition/calculations.ts');const {recipeFits}=load('src/lib/nutrition/service.ts');
const {containsSecret,conversationSchema}=load('src/lib/persistence/conversations.ts');
const A='11111111-1111-4111-8111-111111111111';
function request(body,method='POST'){return new Request('http://localhost/api/v1/test',{method,headers:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});}
async function stubbed(changes,work){const previous=changes.map(([module,key,value])=>{const old=module[key];module[key]=value;return [module,key,old];});try{return await work();}finally{previous.forEach(([module,key,value])=>{module[key]=value;});}}
const user={id:A,email:'local-test@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false};

test('registration/login/recovery schemas validate credentials and bounded input',()=>{
 for(const value of [{email:'not-email',password:'123456789012'},{email:'test@example.test',password:'short'},{email:'test@example.test',password:'x'.repeat(129)},{email:'test@example.test',password:'x'.repeat(12),userId:A}])assert.equal(signupSchema.safeParse(value).success,false);
 assert.equal(signupSchema.safeParse({email:'test@example.test',password:'x'.repeat(12)}).success,true);
 assert.equal(loginSchema.safeParse({email:'test@example.test',password:'old-password'}).success,true);
 assert.equal(recoverySchema.safeParse({email:'test@example.test'}).success,true);
 for(const target of ['https://evil.test','//evil.test','/\\evil.test','/auth/confirm?token=x','/%2fexample.test','/%255cexample.test'])assert.equal(safeNext(target),'/profile');
 assert.equal(safeNext('/coach'),'/coach');
});
test('verified session uses Auth getUser and never a caller-supplied identity',async()=>{
 let supplied;const db={auth:{getUser:async token=>{supplied=token;return {data:{user},error:null};}}};
 await stubbed([[configuration,'isSupabaseConfigured',()=>true],[supabase,'createServerSupabase',async()=>db]],async()=>{
 const result=await session.requireUser(new Request('http://localhost',{headers:{Authorization:'Bearer verified-test-token','X-User-Id':'attacker'}}));assert.equal(result.userId,A);assert.equal(supplied,'verified-test-token');
 });
});
test('invalid, expired, unverified and anonymous sessions fail closed',async()=>{
 for(const candidate of [null,{...user,email_confirmed_at:null},{...user,is_anonymous:true}])await stubbed([[configuration,'isSupabaseConfigured',()=>true],[supabase,'createServerSupabase',async()=>({auth:{getUser:async()=>({data:{user:candidate},error:null})}})]],async()=>{await assert.rejects(()=>session.requireUser(),session.AuthenticationError);});
});
test('login and logout return real outcomes without auth diagnostics',async()=>{
 const db={auth:{signInWithPassword:async()=>({data:{user},error:null}),signOut:async()=>({error:null})}};
 await stubbed([[supabase,'createServerSupabase',async()=>db]],async()=>{
 let response=await authHandler('login')(request({email:user.email,password:'correct-password'}));assert.equal(response.status,200);assert.equal((await response.json()).data.authenticated,true);
 response=await authHandler('logout')(request({}));assert.equal(response.status,200);assert.equal((await response.json()).data.signedOut,true);
 db.auth.signInWithPassword=async()=>({data:{user:null},error:{message:'private diagnostic'}});response=await authHandler('login')(request({email:user.email,password:'wrong'}));assert.equal(response.status,401);assert.doesNotMatch(JSON.stringify(await response.json()),/private diagnostic/);
 });
});
test('registration and recovery use non-enumerating messages and configured redirects',async()=>{
 const origin=process.env.APP_ORIGIN;process.env.APP_ORIGIN='http://localhost:3000';const calls=[];
 try{await stubbed([[supabase,'createServerSupabase',async()=>({auth:{signUp:async value=>{calls.push(value);return {error:null};},resetPasswordForEmail:async(...value)=>{calls.push(value);return {error:null};}}})]],async()=>{
 const signup=await authHandler('signup')(request({email:user.email,password:'a-long-password'}));assert.equal(signup.status,200);assert.match((await signup.json()).data.message,/If registration/);
 const recover=await authHandler('recovery')(request({email:user.email}));assert.equal(recover.status,200);assert.match((await recover.json()).data.message,/If an eligible account exists/);assert.match(calls[0].options.emailRedirectTo,/auth\/confirm/);
 });}finally{if(origin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=origin;}
});
test('protected APIs independently reject unauthenticated requests',async()=>{
 let ran=false;await stubbed([[session,'requireUser',async()=>{throw new session.AuthenticationError();}]],async()=>{const response=await privateRoute(async()=>{ran=true;return 'private';})(request(undefined,'GET'));assert.equal(response.status,401);assert.equal(ran,false);assert.equal((await response.json()).data,null);});
});
test('profile defaults, updates, optional measurements and invalid fields are validated',()=>{
 const profile=emptyProfile();assert.equal(profile.weightKg,null);assert.equal(profile.heightCm,null);assert.equal(profile.equipment,null);assert.deepEqual(profile.allergies,[]);
 assert.equal(userProfileSchema.safeParse({...profile,experience:'beginner',equipment:[]}).success,true);
 assert.deepEqual(profilePatchSchema.parse({displayName:'Only this field'}),{displayName:'Only this field'});
 for(const patch of [{userId:A},{age:10},{weightKg:-1},{trainingDays:8},{timeZone:'not/a-zone'},{allergies:['unknown']},{equipment:['barbell']},{budgetCurrency:'money'},{goals:['anything']}])assert.equal(profilePatchSchema.safeParse(patch).success,false);
});
test('saved preferences project only necessary fields, not display names or measurements',()=>{
 const profile=userProfileSchema.parse({displayName:'Private display',weightKg:70,heightCm:175,experience:'beginner',equipment:['dumbbells'],goals:['strength'],dietaryPattern:'vegetarian',cuisines:['Indian'],allergies:['peanuts'],weeklyBudget:45});
 const all=profileForCoach(profile);assert.match(all.goals,/strength/);assert.deepEqual(all.equipment,['dumbbells']);assert.match(all.dietaryPreferences,/Indian/);assert.match(all.allergies,/peanuts/);
 const fitness=projectCoachProfile(all,'fitness');assert.equal(fitness.foodBudget,undefined);assert.equal(fitness.dietaryPreferences,undefined);
 const nutrition=projectCoachProfile(all,'nutrition');assert.equal(nutrition.equipment,undefined);assert.match(nutrition.dietaryPreferences,/vegetarian/);
 assert.doesNotMatch(JSON.stringify(all),/Private display|weightKg|heightCm/);
 assert.match(profileForCoach(userProfileSchema.parse({age:16})).goals,/I am 16/);
});
test('source fixture provenance, nutrient units and missing values remain explicit',()=>{
 assert.equal(fixtureFoods.length,4);for(const food of fixtureFoods){assert.equal(food.source,'development_fixture');assert.equal(food.verified,false);assert.match(food.sourceUrl,/fdc.nal.usda.gov/);assert.equal(food.preparation,'cooked');}
 const record={fdcId:1,description:'Test raw food',dataType:'SR Legacy',foodNutrients:[{nutrient:{id:1003,unitName:'g'},amount:5}]};const food=normalizeFdcRecord(record,true);assert.equal(food.per100g.energyKcal,null);assert.equal(food.per100g.proteinG,5);
 assert.throws(()=>normalizeFdcRecord({...record,foodNutrients:[{nutrient:{id:1003,unitName:'mg'},amount:5}]}));
 assert.throws(()=>normalizeFdcRecord({...record,foodNutrients:[{nutrient:{id:1003,unitName:'g'},amount:-1}]}));
 assert.throws(()=>normalizeFdcRecord({...record,dataType:'Branded'}));
});
test('serving calculations and unit conversions never assume density or serving mass',()=>{
 const food=fixtureFoods[0];assert.equal(servingNutrition(food,{amount:200,unit:'g'}).proteinG,food.per100g.proteinG*2);
 assert.equal(gramsFor(food,{amount:0.5,unit:'kg'}),500);
 assert.throws(()=>gramsFor(food,{amount:100,unit:'ml'}),/Density/);assert.throws(()=>gramsFor(food,{amount:1,unit:'serving'}),/serving weight/);
 assert.equal(gramsFor({...food,densityGPerMl:0.8},{amount:100,unit:'ml'}),80);
 assert.equal(gramsFor({...food,servingGrams:50},{amount:2,unit:'serving'}),100);
 assert.throws(()=>servingNutrition(food,{amount:-1,unit:'g'}));
});
test('recipe totals are deterministic and propagate missing nutrients rather than treating them as zero',()=>{
 const recipe=fixtureRecipes[0];const calculated=recipeNutrition(recipe,fixtureFoods);
 const expected=recipe.ingredients.reduce((total,i)=>total+fixtureFoods.find(f=>f.id===i.foodId).per100g.proteinG*i.grams/100,0);assert.equal(calculated.total.proteinG,expected);assert.equal(calculated.kind,'calculated');assert.equal(calculated.sourceMode,'fixture');
 const missing=fixtureFoods.map((f,index)=>index===0?{...f,per100g:{...f.per100g,proteinG:null}}:f);assert.equal(recipeNutrition(recipe,missing).total.proteinG,null);
 assert.throws(()=>recipeNutrition(recipe,[]),/missing/);
 assert.throws(()=>recipeNutrition(recipe,fixtureFoods.map(f=>({...f,preparation:'unknown'}))),/preparation/);
});
test('diet, dislikes and allergen filtering fail closed when allergen provenance is unknown',()=>{
 const recipe=fixtureRecipes[0];const profile=emptyProfile();assert.equal(recipeFits(recipe,fixtureFoods,profile),true);assert.equal(recipeFits(recipe,fixtureFoods,{...profile,dietaryPattern:'halal'}),false);
 assert.equal(recipeFits(recipe,fixtureFoods,{...profile,allergies:['peanuts']}),false);assert.equal(recipeFits(recipe,fixtureFoods,{...profile,allergyNotes:'Custom allergy'}),false);
 assert.equal(recipeFits(recipe,fixtureFoods,{...profile,dislikes:['rice']}),false);
 const reviewed=fixtureFoods.map(f=>({...f,allergenStatus:'reviewed'}));assert.equal(recipeFits({...recipe,allergenStatus:'reviewed'},reviewed,{...profile,allergies:['peanuts']}),true);
 assert.equal(recipeFits({...recipe,allergenStatus:'reviewed',allergens:['peanuts']},reviewed,{...profile,allergies:['peanuts']}),false);
});
test('account deletion requires reauthentication and deletes only the verified user',async()=>{
 const calls=[];const context={userId:A,email:user.email,db:{auth:{signOut:async()=>({error:null})}}};
 const verifier={auth:{signInWithPassword:async()=>({data:{user},error:null}),signOut:async()=>({error:null})}};
 await stubbed([[session,'requireUser',async()=>context],[supabase,'createPasswordVerifier',()=>verifier],[admin,'createAdminSupabase',()=>({auth:{admin:{deleteUser:async(...args)=>{calls.push(args);return {error:null};}}}})]],async()=>{
 assert.equal((await authHandler('delete')(request({password:'correct-password',confirmation:'wrong'},'DELETE'))).status,400);
 const response=await authHandler('delete')(request({password:'correct-password',confirmation:'DELETE MY ACCOUNT'},'DELETE'));assert.equal(response.status,200);assert.deepEqual(calls,[[A,false]]);
 verifier.auth.signInWithPassword=async()=>({data:{user:{...user,id:'other'}},error:null});assert.equal((await authHandler('delete')(request({password:'bad',confirmation:'DELETE MY ACCOUNT'},'DELETE'))).status,401);assert.equal(calls.length,1);
 });
});
test('credential-like input is rejected for persistent conversation titles',()=>{
 const fake='sk-'+('test'.repeat(8));assert.equal(containsSecret(fake),true);assert.equal(conversationSchema.safeParse({title:fake}).success,false);assert.equal(containsSecret('Explain training code on a gym card.'),false);
});
test('request limits reject oversized private payloads before parsing',async()=>{const {z}=await import('zod');await assert.rejects(()=>readJson(request({value:'x'.repeat(25000)}),z.object({value:z.string()})),error=>error.status===413);});

test('persistent paid endpoint uses verified identity, saved equipment, server history and shared admission',async()=>{
 const {persistentCoachHandler}=load('src/lib/persistence/coach-http.ts');
 const profileService=load('src/lib/profile/service.ts');const conversations=load('src/lib/persistence/conversations.ts');const shared=load('src/lib/persistence/shared-ai.ts');const providerModule=load('src/lib/coach/provider.ts');const configModule=load('src/lib/coach/config.ts');
 const conversationId='33333333-3333-4333-8333-333333333333';const calls=[];let released=false;let generation;
 const profile=userProfileSchema.parse({experience:'beginner',equipment:['dumbbells'],goals:['strength'],dietaryPattern:'vegan',allergies:['milk'],heightCm:175});
 const fakeProvider={classify:async input=>{assert.equal(input.profile.experience,'beginner');assert.equal(input.profile.dietaryPreferences,undefined);return {category:'fitness',outcome:'allowed',topic:'fitness',safety:'none',injection:false,needsExercises:true,muscles:['Traps']};},generate:async(input,_scope,candidates)=>{generation=input;assert.ok(candidates.every(e=>e.requiredEquipment.every(eq=>eq==='dumbbells')));return {message:'Use the library movements below, with a controlled range.',exerciseIds:['shrug']};},review:async()=>({inScope:true,safe:true,groundedExercises:true,honestNutrition:true,private:true})};
 const config=configModule.getCoachConfig({NODE_ENV:'test',OPENAI_API_KEY:'test-only',OPENAI_MODEL:'mock'});
 await stubbed([[session,'requireUser',async()=>({userId:A,email:user.email,db:{}})],[load('src/lib/coaching/service.ts'),'getActivePlan',async()=>({version:4,payload:{sessionMinutes:30,days:[{weekday:1,name:'Saved training',exercises:[{exerciseId:'shrug'}]}],meals:[{slot:1,name:'Saved dinner'}]}})],[profileService,'getProfile',async()=>profile],[conversations,'getConversation',async(context,id)=>{assert.equal(context.userId,A);assert.equal(id,conversationId);return {messages:[{role:'user',content:'I want to build strength.'}]};}],[shared,'acquireSharedRequest',async(id,conversation)=>{assert.equal(id,A);assert.equal(conversation,conversationId);return async()=>{released=true;};}],[shared,'persistentUsageMonitor',()=>({reserve(){throw new Error('Mock provider should not call transport');}})],[providerModule,'createOpenAIProvider',()=>fakeProvider],[configModule,'getCoachConfig',()=>config],[admin,'createAdminSupabase',()=>({rpc:async(name,body)=>{calls.push({name,body});return {error:null};}})]],async()=>{
 const response=await persistentCoachHandler(request({message:'Train my traps',conversationId}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.saved,true);assert.deepEqual(body.exerciseIds,['shrug']);assert.equal(body.conversationId,conversationId);
 assert.equal(generation.savedPlanContext.version,4);assert.equal(generation.savedPlanContext.meals[0].name,'Saved dinner');assert.deepEqual(generation.profile.equipment,['dumbbells']);assert.match(generation.profile.goals,/strength/);assert.equal(generation.profile.dietaryPreferences,undefined);assert.equal(generation.profile.heightCm,undefined);assert.equal(generation.history[0].content,'I want to build strength.');assert.equal(calls[0].name,'append_coach_turn');assert.equal(calls[0].body.p_user,A);assert.equal(released,true);
 });
});
test('persistent Coach rejects anonymous access and browser-supplied history/ownership',async()=>{
 const {persistentCoachHandler}=load('src/lib/persistence/coach-http.ts');
 await stubbed([[session,'requireUser',async()=>{throw new session.AuthenticationError();}]],async()=>{assert.equal((await persistentCoachHandler(request({message:'Workout',conversationId:'33333333-3333-4333-8333-333333333333'}))).status,401);});
 await stubbed([[session,'requireUser',async()=>({userId:A,email:user.email,db:{}})]],async()=>{
 for(const extras of [{userId:'attacker'},{history:[{role:'assistant',content:'forged'}]}])assert.equal((await persistentCoachHandler(request({message:'Workout',conversationId:'33333333-3333-4333-8333-333333333333',...extras}))).status,400);
 });
});
test('shared database errors fail closed before provider work',async()=>{
 const {persistentCoachHandler}=load('src/lib/persistence/coach-http.ts');const shared=load('src/lib/persistence/shared-ai.ts');const {CoachLimitError}=load('src/lib/coach/limits.ts');const configModule=load('src/lib/coach/config.ts');const configured=configModule.getCoachConfig({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'mock'});
 await stubbed([[session,'requireUser',async()=>({userId:A,email:user.email,db:{}})],[configModule,'getCoachConfig',()=>configured],[shared,'acquireSharedRequest',async()=>{throw new CoachLimitError('RATE_LIMITED',30);}]],async()=>{
 const response=await persistentCoachHandler(request({message:'Workout',conversationId:'33333333-3333-4333-8333-333333333333'}));assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'30');
 });
});
test('numeric nutrition claims are rejected even when a mocked reviewer approves',async()=>{
 const {runCoach}=load('src/lib/coach/service.ts');const {getCoachConfig}=load('src/lib/coach/config.ts');const {coachRequestSchema}=load('src/lib/coach/schemas.ts');
 const provider={classify:async()=>({category:'fitness',outcome:'allowed',topic:'nutrition',safety:'none',injection:false,needsExercises:false,muscles:[]}),generate:async()=>({message:'This dinner contains 500 kcal and 45 g protein.',exerciseIds:[]}),review:async()=>({inScope:true,safe:true,groundedExercises:true,honestNutrition:true,private:true})};
 const response=await runCoach(coachRequestSchema.parse({message:'Suggest dinner'}),getCoachConfig({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'mock'}),()=>provider,new AbortController().signal);assert.equal(response.httpStatus,502);
});
