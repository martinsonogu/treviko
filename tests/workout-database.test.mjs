import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {loadSource} from './load-source.mjs';
import {proposal} from './conversation-fixture.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',plan='77777777-7777-4777-8777-777777777777';
test('workout migration enforces ownership, immutable snapshots, idempotency, optimistic concurrency, finish and discard',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`);
 for(const name of ['202611040001_milestone4.sql','202611040002_shared_ai_controls.sql','202611050001_coaching_plans.sql','202611050002_training_first.sql','202611050003_workout_logging.sql','202611050004_workout_feedback.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${A}'),('${B}');insert into public.coaching_plans(id,user_id,primary_goal,experience,equipment,training_days,session_minutes,version) values('${plan}','${A}','strength','beginner','{}',1,45,1);insert into public.training_plan_days(plan_id,user_id,weekday,name) values('${plan}','${A}',1,'Original session');`);
 const schema=loadSource('src/lib/workouts/schema.ts'),snapshot=JSON.parse(JSON.stringify(loadSource('src/lib/workouts/service.ts').snapshotDay({payload:proposal.payload},1))),performance=schema.emptyPerformance(snapshot),key=crypto.randomUUID();
 const start=async(startKey=key,version=1,user=A)=>(await db.query(`select public.start_workout_session($1,$2,$3,1,$4,$5,$6,'kg') as session`,[user,plan,version,startKey,JSON.stringify(snapshot),JSON.stringify(performance)])).rows[0].session;
 const update=async(id,version,operation,action,actual,user=A)=>(await db.query(`select public.update_workout_session($1,$2,$3,$4,$5,$6) as session`,[user,id,version,operation,action,JSON.stringify(actual)])).rows[0].session;
 await db.exec('set role service_role');const first=await start();assert.equal(first.status,'in_progress');assert.equal((await start()).id,first.id);assert.equal((await start(crypto.randomUUID())).id,first.id);
 const own=async user=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`);
 await own(B);assert.equal((await db.query('select * from public.workout_sessions')).rows.length,0);await assert.rejects(start(),/permission denied/);await assert.rejects(db.exec(`insert into public.workout_sessions(user_id,plan_id,plan_version,weekday,start_key,snapshot,performance,load_unit) values('${B}','${plan}',1,1,gen_random_uuid(),'{}','{}','kg')`),/permission denied/);
 await own(A);assert.equal((await db.query('select id from public.workout_sessions')).rows[0].id,first.id);await assert.rejects(db.exec(`update public.workout_sessions set performance='{}' where id='${first.id}'`),/permission denied/);
 await db.exec('reset role;set role service_role');await assert.rejects(update(first.id,1,crypto.randomUUID(),'save',performance,B),/NOT_FOUND/);
 const actual=structuredClone(performance);actual.exercises[0].sets[0]={load:null,amount:10,done:true};actual.notes='Partial workout, remaining sets incomplete.';const operation=crypto.randomUUID();const saved=await update(first.id,1,operation,'save',actual);assert.equal(saved.version,2);assert.deepEqual(saved.snapshot,snapshot);assert.equal((await update(first.id,1,operation,'save',actual)).version,2);
 await assert.rejects(update(first.id,1,crypto.randomUUID(),'save',performance),/VERSION_CONFLICT/);await assert.rejects(db.exec(`update public.workout_sessions set snapshot='{}' where id='${first.id}'`),/IMMUTABLE_PRESCRIPTION/);
 await assert.rejects(update(first.id,2,crypto.randomUUID(),'finish',performance),/INVALID_INPUT/);
 const finishKey=crypto.randomUUID();const finished=await update(first.id,2,finishKey,'finish',actual);assert.equal(finished.status,'completed');assert.ok(finished.finished_at);assert.equal((await update(first.id,2,finishKey,'finish',actual)).version,3);await assert.rejects(update(first.id,3,crypto.randomUUID(),'save',actual),/WORKOUT_CLOSED/);
 await assert.rejects(db.exec(`update public.workout_sessions set performance='{}' where id='${first.id}'`),/WORKOUT_CLOSED/);
 const feedback=async(effort='hard',owner=A,id=first.id)=>(await db.query('select public.save_workout_feedback($1,$2,$3) as feedback',[owner,id,effort])).rows[0].feedback;
 const recordedBefore=(await db.query('select snapshot,performance,version,finished_at from public.workout_sessions where id=$1',[first.id])).rows[0];
 const feeling=await feedback();assert.equal(feeling.effort,'hard');assert.deepEqual(await feedback(),feeling);await assert.rejects(feedback('easy'),/FEEDBACK_EXISTS/);await assert.rejects(feedback('unknown'),/INVALID_INPUT/);await assert.rejects(feedback('hard',B),/NOT_FOUND/);
 assert.deepEqual((await db.query('select snapshot,performance,version,finished_at from public.workout_sessions where id=$1',[first.id])).rows[0],recordedBefore,'Feedback must not update completed workouts');
 await own(B);assert.equal((await db.query('select * from public.workout_feedback')).rows.length,0);await assert.rejects(feedback(),/permission denied/);
 await own(A);assert.equal((await db.query('select * from public.workout_feedback')).rows.length,1);await assert.rejects(db.exec(`update public.workout_feedback set effort='easy'`),/permission denied/);
 await db.exec('reset role;set role service_role');

 await db.exec(`update public.coaching_plans set version=2 where id='${plan}';update public.training_plan_days set name='Revised session' where plan_id='${plan}';`);assert.equal((await start()).id,first.id,'An ambiguous start retry returns its original completed session despite plan revision');assert.deepEqual((await db.query(`select snapshot from public.workout_sessions where id=$1`,[first.id])).rows[0].snapshot,snapshot);
 await assert.rejects(start(crypto.randomUUID(),1),/VERSION_CONFLICT/);const second=await start(crypto.randomUUID(),2);assert.notEqual(second.id,first.id);await assert.rejects(feedback('hard',A,second.id),/NOT_FOUND/);const discarded=await update(second.id,1,crypto.randomUUID(),'discard',performance);assert.equal(discarded.status,'discarded');
 await own(A);assert.equal((await db.query(`select count(*)::int as count from public.workout_sessions where status='completed'`)).rows[0].count,1);assert.equal((await db.query(`select performance from public.workout_sessions where status='completed'`)).rows[0].performance.notes,actual.notes);
 await db.exec(`reset role;delete from public.coaching_plans where id='${plan}';`);assert.equal((await db.query('select count(*)::int as count from public.workout_sessions')).rows[0].count,2,'Historical logs survive plan removal');
 await db.exec(`delete from auth.users where id='${A}';`);assert.equal((await db.query('select * from public.workout_sessions')).rows.length,0,'Account deletion cascades workout data');assert.equal((await db.query('select * from public.workout_feedback')).rows.length,0);
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.workout_sessions'),/permission denied/);
 }finally{await db.close();}
});
