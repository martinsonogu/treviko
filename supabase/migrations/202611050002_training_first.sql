-- Additive training-first scopes and complete workout prescriptions. Preserve existing data/RLS.
begin;
alter table public.user_fitness_preferences drop constraint user_fitness_preferences_equipment_check;
alter table public.user_fitness_preferences add constraint user_fitness_preferences_equipment_check check(equipment <@ array['dumbbells','bench','resistance-band','pull-up-bar','cable-machine','lat-pulldown-machine','chest-press-machine','leg-extension-machine','leg-curl-machine']);
alter table public.coaching_plans drop constraint coaching_plans_training_days_check;
alter table public.coaching_plans add constraint coaching_plans_training_days_check check(training_days between 0 and 7);
alter table public.coaching_plans add column training_preference_fingerprint text, add column nutrition_preference_fingerprint text;
update public.coaching_plans set training_preference_fingerprint=case when training_days>0 then preference_fingerprint else null end,
 nutrition_preference_fingerprint=case when exists(select 1 from public.coaching_meal_ideas m where m.plan_id=coaching_plans.id) then preference_fingerprint else null end;
alter table public.training_plan_days add column warmup_minutes integer check(warmup_minutes between 1 and 10),add column estimated_minutes integer check(estimated_minutes between 1 and 240),add column warmup text check(length(warmup)<=600),add column recovery text check(length(recovery)<=600);
alter table public.training_plan_exercises add column rest_seconds integer check(rest_seconds between 30 and 180),add column repetitions_in_reserve integer check(repetitions_in_reserve between 2 and 4),add column cue text check(length(cue)<=700),add column reason text check(length(reason)<=500),add column progression text check(length(progression)<=700),add column substitution_id text check(length(substitution_id) between 1 and 80);
create or replace function public.confirm_coaching_proposal(p_user uuid,p_proposal uuid,p_confirm boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare proposal public.plan_proposals; current_plan public.coaching_plans; doc jsonb; merged jsonb; previous jsonb; requested_scope text; change_training boolean; change_nutrition boolean; field_name text; d jsonb; e jsonb; m jsonb; day_id uuid; meal_id uuid; new_meal boolean:=false; next_version integer; pos integer;
begin
 if p_confirm is distinct from true then raise exception 'CONFIRMATION_REQUIRED'; end if;
 perform 1 from public.profiles where user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into proposal from public.plan_proposals where id=p_proposal and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into current_plan from public.coaching_plans where user_id=p_user for update;
 if proposal.status='confirmed' then return current_plan.id; end if;
 if proposal.status<>'pending' or proposal.expires_at<=now() then raise exception 'PROPOSAL_UNAVAILABLE'; end if;
 if coalesce(current_plan.version,0)<>proposal.base_version then raise exception 'VERSION_CONFLICT'; end if;
 if proposal.profile_guard is distinct from public.coaching_profile_guard(p_user) then raise exception 'PREFERENCES_CHANGED'; end if;
 doc:=proposal.payload; next_version:=proposal.base_version+1;
 requested_scope:=coalesce(doc->>'scope','training_and_nutrition');
 if requested_scope not in ('training_only','nutrition_only','training_and_nutrition') then raise exception 'INVALID_PROPOSAL'; end if;
 change_training:=requested_scope<>'nutrition_only'; change_nutrition:=requested_scope<>'training_only';
 if jsonb_typeof(doc->'days') is distinct from 'array' or jsonb_typeof(doc->'meals') is distinct from 'array' then raise exception 'INVALID_PROPOSAL'; end if;
 if (change_training and jsonb_array_length(doc->'days') not between 1 and 7) or (not change_training and jsonb_array_length(doc->'days')<>0)
  or (change_nutrition and jsonb_array_length(doc->'meals') not between 1 and 8) or (not change_nutrition and jsonb_array_length(doc->'meals')<>0) then raise exception 'INVALID_PROPOSAL'; end if;
 select snapshot into previous from public.plan_revisions where plan_id=current_plan.id and version=current_plan.version;
 merged:=doc;
 if not change_training then
  foreach field_name in array array['days','equipment','experience','sessionMinutes','progression','targetMuscles','excludedExerciseIds','qualityWarnings'] loop
   if previous ? field_name then merged:=jsonb_set(merged,array[field_name],previous->field_name); end if;
  end loop;
  merged:=jsonb_set(merged,'{days}',coalesce(previous->'days','[]'));
 end if;
 if not change_nutrition then merged:=jsonb_set(merged,'{meals}',coalesce(previous->'meals','[]')); end if;
 merged:=jsonb_set(merged,'{trainingGoal}',case when change_training then doc->'primaryGoal' when jsonb_array_length(coalesce(previous->'days','[]'))>0 then coalesce(nullif(previous->'trainingGoal','null'),previous->'primaryGoal') else 'null'::jsonb end);
 merged:=jsonb_set(merged,'{nutritionGoal}',case when change_nutrition then doc->'primaryGoal' when jsonb_array_length(coalesce(previous->'meals','[]'))>0 then coalesce(nullif(previous->'nutritionGoal','null'),previous->'primaryGoal') else 'null'::jsonb end);
 merged:=jsonb_set(merged,'{primaryGoal}',coalesce(nullif(merged->'trainingGoal','null'),nullif(merged->'nutritionGoal','null'),doc->'primaryGoal'));
 merged:=jsonb_set(merged,'{scope}',to_jsonb(case when jsonb_array_length(merged->'days')>0 and jsonb_array_length(merged->'meals')>0 then 'training_and_nutrition' when jsonb_array_length(merged->'days')>0 then 'training_only' else 'nutrition_only' end));
 if change_training then merged:=jsonb_set(merged,'{trainingRationale}',doc->'rationale'); elsif previous ? 'trainingRationale' or previous ? 'rationale' then merged:=jsonb_set(merged,'{trainingRationale}',coalesce(previous->'trainingRationale',previous->'rationale')); end if;
 if change_nutrition then merged:=jsonb_set(merged,'{nutritionRationale}',doc->'rationale'); elsif previous ? 'nutritionRationale' or previous ? 'rationale' then merged:=jsonb_set(merged,'{nutritionRationale}',coalesce(previous->'nutritionRationale',previous->'rationale')); end if;
 insert into public.coaching_plans(user_id,primary_goal,preference_fingerprint,training_preference_fingerprint,nutrition_preference_fingerprint,experience,equipment,training_days,session_minutes,version)
 values(p_user,merged->>'primaryGoal',proposal.preference_fingerprint,case when change_training then proposal.preference_fingerprint else current_plan.training_preference_fingerprint end,case when change_nutrition then proposal.preference_fingerprint else current_plan.nutrition_preference_fingerprint end,merged->>'experience',array(select jsonb_array_elements_text(merged->'equipment')),jsonb_array_length(merged->'days'),(merged->>'sessionMinutes')::integer,next_version)
 on conflict(user_id) do update set primary_goal=excluded.primary_goal,preference_fingerprint=excluded.preference_fingerprint,training_preference_fingerprint=excluded.training_preference_fingerprint,nutrition_preference_fingerprint=excluded.nutrition_preference_fingerprint,experience=excluded.experience,equipment=excluded.equipment,training_days=excluded.training_days,session_minutes=excluded.session_minutes,version=excluded.version,status='active',updated_at=now()
 returning * into current_plan;
 if change_training then
 delete from public.training_plan_days where plan_id=current_plan.id;
 for d in select * from jsonb_array_elements(doc->'days') loop
  insert into public.training_plan_days(plan_id,user_id,weekday,name,warmup_minutes,estimated_minutes,warmup,recovery) values(current_plan.id,p_user,(d->>'weekday')::integer,d->>'name',(d->>'warmupMinutes')::integer,(d->>'estimatedMinutes')::integer,d->>'warmup',d->>'recovery') returning id into day_id;
  pos:=0;
  for e in select * from jsonb_array_elements(d->'exercises') loop
   insert into public.training_plan_exercises(day_id,user_id,position,exercise_id,sets,reps,unit,rest_seconds,repetitions_in_reserve,cue,reason,progression,substitution_id) values(day_id,p_user,pos,e->>'exerciseId',(e->>'sets')::integer,e->>'reps',e->>'unit',(e->>'restSeconds')::integer,(e->>'repetitionsInReserve')::integer,e->>'cue',e->>'reason',e->>'progression',e->>'substitutionId'); pos:=pos+1;
  end loop;
 end loop;
 end if;
 if change_nutrition then
 delete from public.nutrition_plan_references where plan_id=current_plan.id;
 delete from public.coaching_meal_ideas where plan_id=current_plan.id;
 meal_id:=null;
 if exists(select 1 from jsonb_array_elements(doc->'meals') as meal_entry(value) where meal_entry.value->>'recipeId' is not null) then
  -- Reuse an identical owned daily plan, including an existing standalone saved meal plan.
  select mp.id into meal_id from public.meal_plans mp where mp.user_id=p_user
   and not exists(select 1 from public.meal_plan_items mi where mi.plan_id=mp.id and (mi.day<>1 or mi.servings<>1))
   and (select coalesce(jsonb_agg(jsonb_build_object('recipeId',mi.recipe_id,'slot',mi.meal_number) order by mi.meal_number),'[]') from public.meal_plan_items mi where mi.plan_id=mp.id)
    = (select jsonb_agg(jsonb_build_object('recipeId',entry.value->>'recipeId','slot',(entry.value->>'slot')::integer) order by (entry.value->>'slot')::integer) from jsonb_array_elements(doc->'meals') as entry(value) where entry.value->>'recipeId' is not null)
   order by mp.created_at desc limit 1;
  if meal_id is null then
   insert into public.meal_plans(user_id,title) values(p_user,'Daily meals · coaching revision '||next_version) returning id into meal_id; new_meal:=true;
  end if;
 end if;
 for m in select * from jsonb_array_elements(doc->'meals') loop
  insert into public.coaching_meal_ideas(plan_id,user_id,slot,name,guidance) values(current_plan.id,p_user,(m->>'slot')::integer,m->>'name',m->>'guidance');
  if m->>'recipeId' is not null then
   if not exists(select 1 from public.recipes where id=m->>'recipeId' and published) then raise exception 'RECIPE_UNAVAILABLE'; end if;
   if new_meal then insert into public.meal_plan_items(plan_id,user_id,recipe_id,servings,day,meal_number) values(meal_id,p_user,m->>'recipeId',1,1,(m->>'slot')::integer); end if;
  end if;
 end loop;
 insert into public.nutrition_plan_references(plan_id,user_id,meal_plan_id) values(current_plan.id,p_user,meal_id);
 end if;
 insert into public.plan_revisions(plan_id,user_id,version,proposal_id,snapshot) values(current_plan.id,p_user,next_version,proposal.id,merged);
 update public.plan_proposals set status='confirmed',confirmed_version=next_version where id=proposal.id;
 return current_plan.id;
end $$;
revoke all on function public.confirm_coaching_proposal(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.confirm_coaching_proposal(uuid,uuid,boolean) to service_role;
commit;
