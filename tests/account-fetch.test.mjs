import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';

// Native Window.fetch rejects a dependency object as its receiver. Node fetch
// and arrow-function mocks accept it, masking an immediate browser-only failure.
function browserFetch(reply){
 return function(_url,options){
  assert.equal(this,undefined,'fetch must be called without a dependency-object receiver');
  return Promise.resolve(Response.json({data:reply(options)}));
 };
}
test('all authentication submissions support receiver-sensitive browser fetch',async()=>{
 const {submitAuth}=load('src/components/account/auth-request.ts');
 for(const mode of ['signup','login','recover','password']){
  const result=await submitAuth(mode,{email:'reusable@example.test',password:'unique-long-password'},'/',{
   lock:{busy:false},request:browserFetch(()=>({authenticated:mode==='login',updated:true,message:'Check your inbox.'})),navigate:()=>{},clearPassword:()=>{},
  });
  assert.equal(result.kind,mode==='login'?'navigating':'success');
 }
});
test('account deletion supports receiver-sensitive browser fetch and clears credentials',async()=>{
 const {deleteAccount}=load('src/components/account/delete-account.ts');
 const events=[];
 await deleteAccount({password:'unique-long-password',confirmation:'DELETE'},{request:browserFetch(()=>({deleted:true})),clearCredentials:()=>events.push('clear'),navigate:path=>events.push(path)});
 assert.deepEqual(events,['clear','/login?deleted=true']);
});
test('profile saves support receiver-sensitive browser fetch',async()=>{
 const {persistProfileAndNavigate}=load('src/components/account/profile-save.ts');
 const {emptyProfile}=load('src/lib/profile/schema.ts');
 const errors=[];
 const result=await persistProfileAndNavigate(emptyProfile(),{nextStep:0,finish:false},{lock:{inFlight:false},request:browserFetch(options=>JSON.parse(options.body)),router:{replace:()=>{},refresh:()=>{}},onStart:()=>{},onSaved:()=>{},onError:error=>errors.push(error),onFinish:()=>{}});
 assert.equal(result,'saved');assert.deepEqual(errors,[]);
});
