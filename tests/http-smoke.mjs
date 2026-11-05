// Built application on port 3100. No valid paid AI request is ever sent.
import assert from 'node:assert/strict';
const base='http://localhost:3100';
for(const path of ['/','/training','/training/exercises/dumbbell-shrug','/api/v1/health','/api/v1/exercises?muscle=Traps','/api/v1/exercises/dumbbell-shrug','/login','/signup','/forgot-password']){
 const response=await fetch(base+path);assert.equal(response.status,200,path);console.log(`200 ${path}`);
}
for(const path of ['/progress','/coach','/nutrition','/profile','/onboarding','/settings']){
 const response=await fetch(base+path,{redirect:'manual'});const html=await response.text();
 assert.ok((response.status>=300&&response.status<400)||(/NEXT_REDIRECT|\/login/.test(html)),`${path} requires account access`);console.log(`Protected ${path}`);
}
const missing=await fetch(base+'/api/v1/exercises/not-in-library');assert.equal(missing.status,404);
for(const path of ['/api/v1/profile','/api/v1/foods','/api/v1/meal-plans','/api/v1/coach/conversations','/api/v1/coach/status','/api/v1/coaching/plan','/api/v1/coaching/today']){
 const response=await fetch(base+path);assert.ok([401,503].includes(response.status),path);assert.equal(response.headers.get('cache-control'),'private, no-store');
}
const invalid=await fetch(base+'/api/v1/coach/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.ok([401,503].includes(invalid.status));
console.log('Passed public pages, protected access and API boundaries. No AI calls.');

for(const endpoint of ['proposals','confirm','cancel']){
 const response=await fetch(base+'/api/v1/coaching/plan/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.ok([401,503].includes(response.status),endpoint);assert.equal(response.headers.get('cache-control'),'private, no-store');
}

for(const path of ['/','/training','/training/exercises/dumbbell-shrug','/login','/signup','/forgot-password','/reset-password']){
 const response=await fetch(base+path);const html=await response.text();assert.equal(response.status,200,path);assert.doesNotMatch(html,/aria-label="(?:Mobile|Main) navigation"/,path+' must hide signed-in navigation');
}
const forged=await (await fetch(base+'/login?deleted=true')).text();assert.doesNotMatch(forged,/Your account has been deleted\./);assert.match(forged,/link alone/);
for(const path of ['/coach','/nutrition','/progress']){
 const response=await fetch(base+path,{redirect:'manual'});const html=await response.text();const location=response.headers.get('location')??html;assert.ok(location.includes('next=')||location.includes('next%3D'),path+' preserves return destination');
}
console.log('Passed public/auth navigation separation, untrusted deletion query and return destinations.');
