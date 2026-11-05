// Explicit opt-in, LOCAL Supabase only. Creates/deletes two temporary test users.
// No valid AI message is sent and no OpenAI request can be made by this test.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const enabled=process.env.TREVIKO_LOCAL_INTEGRATION==='true';
test('local Supabase Auth + PostgREST + application enforce cross-user isolation and account deletion',{skip:!enabled,timeout:60000},async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;assert.ok(url&&['localhost','127.0.0.1'].includes(new URL(url).hostname),'Integration writes are allowed only against LOCAL Supabase.');
 const app=process.env.APP_ORIGIN||'http://localhost:3000';assert.ok(['localhost','127.0.0.1'].includes(new URL(app).hostname));
 const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;const secret=process.env.SUPABASE_SECRET_KEY;assert.ok(publishable&&secret,'Configure local Supabase keys first.');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,secret,options);const created=[];const profiles=[];
 try{
  for(let index=0;index<2;index++){
   const email=`treviko-${randomUUID()}@example.test`;const password=randomUUID()+'Aa1!';
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ok(!error&&data.user,'Create local test user');created.push(data.user.id);
   const client=createClient(url,publishable,options);const signed=await client.auth.signInWithPassword({email,password});assert.ok(!signed.error&&signed.data.session,'Local sign-in');profiles.push({id:data.user.id,client,token:signed.data.session.access_token,password});
  }
  const [a,b]=profiles;
  const selected=await a.client.from('profiles').select('user_id');assert.ok(!selected.error);assert.deepEqual(selected.data.map(row=>row.user_id),[a.id]);
  const invisible=await b.client.from('profiles').select('user_id').eq('user_id',a.id);assert.ok(!invisible.error);assert.equal(invisible.data.length,0);
  const conversation=await a.client.from('coach_conversations').insert({user_id:a.id,title:'Temporary isolation test'}).select('id').single();assert.ok(!conversation.error);const id=conversation.data.id;
  const crossed=await b.client.from('coach_conversations').select('id').eq('id',id);assert.ok(!crossed.error);assert.equal(crossed.data.length,0);
  const forged=await b.client.from('coach_messages').insert({user_id:a.id,conversation_id:id,role:'assistant',content:'forged'});assert.ok(forged.error);
  const privileged=await b.client.rpc('reserve_ai_usage',{p_user:a.id,p_stage:'scope',p_model:'mock',p_input:10,p_output:10,p_daily_tokens:1000,p_global_tokens:2000});assert.ok(privileged.error);
  async function api(path,token,method='GET',body){return fetch(app+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
  assert.equal((await api('/api/v1/profile')).status,401);
  assert.equal((await api('/api/v1/profile',a.token)).status,200);
  const patch=await api('/api/v1/profile',a.token,'PATCH',{experience:'beginner',equipment:['dumbbells']});assert.equal(patch.status,200);assert.deepEqual((await patch.json()).data.equipment,['dumbbells']);
  assert.equal((await api(`/api/v1/coach/conversations/${id}`,b.token)).status,404);
  assert.equal((await api('/api/v1/coach/messages',a.token,'POST',{message:''})).status,400);
  assert.equal((await api('/api/v1/coach/messages',null,'POST',{message:''})).status,401);
  assert.equal((await api('/api/v1/account',a.token,'DELETE',{password:'wrong',confirmation:'DELETE MY ACCOUNT'})).status,401);
  const deleted=await api('/api/v1/account',a.token,'DELETE',{password:a.password,confirmation:'DELETE MY ACCOUNT'});assert.equal(deleted.status,200);assert.equal((await deleted.json()).data.deleted,true);
  assert.equal((await api('/api/v1/profile',a.token)).status,401);
  const orphan=await admin.from('coach_conversations').select('id').eq('id',id);assert.ok(!orphan.error);assert.equal(orphan.data.length,0);
 }finally{for(const id of created)await admin.auth.admin.deleteUser(id);}
});
