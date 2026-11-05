-- Additive AI-first plans. Browser clients can read only their own rows.
begin;
create table public.coaching_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(user_id) on delete cascade,
 primary_goal text not null, preference_fingerprint text not null default '', experience text not null check(experience in ('beginner','intermediate','advanced')),
 equipment text[] not null, training_days integer not null check(training_days between 1 and 7),
 session_minutes integer not null check(session_minutes between 10 and 240), version integer not null check(version>0),
 status text not null default 'active' check(status in ('active','paused')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.training_plan_days (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null, user_id uuid not null,
 weekday integer not null check(weekday between 1 and 7), name text not null check(length(name) between 1 and 100),
 foreign key(plan_id,user_id) references public.coaching_plans(id,user_id) on delete cascade,
 unique(plan_id,weekday), unique(id,user_id)
);
create table public.training_plan_exercises (
 day_id uuid not null, user_id uuid not null, position integer not null check(position between 0 and 5),
 exercise_id text not null check(length(exercise_id) between 1 and 80), sets integer not null check(sets between 1 and 4),
 reps text not null check(length(reps) between 1 and 30), unit text not null check(unit in ('reps','seconds')),
 foreign key(day_id,user_id) references public.training_plan_days(id,user_id) on delete cascade, primary key(day_id,position)
);
-- A daily meal plan is repeated across the week only when the preview explicitly says so.
create table public.nutrition_plan_references (
 plan_id uuid primary key, user_id uuid not null, meal_plan_id uuid,
 foreign key(plan_id,user_id) references public.coaching_plans(id,user_id) on delete cascade,
 foreign key(meal_plan_id,user_id) references public.meal_plans(id,user_id) on delete cascade
);
create table public.coaching_meal_ideas (
 plan_id uuid not null, user_id uuid not null, slot integer not null check(slot between 1 and 8),
 name text not null check(length(name) between 1 and 120), guidance text not null check(length(guidance)<=700),
 foreign key(plan_id,user_id) references public.coaching_plans(id,user_id) on delete cascade, primary key(plan_id,slot)
);
create table public.plan_proposals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(user_id) on delete cascade,
 base_version integer not null check(base_version>=0), preference_fingerprint text not null default '', profile_guard jsonb not null default '{}', payload jsonb not null check(jsonb_typeof(payload)='object'),
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 confirmed_version integer, unique(id,user_id)
);
create index plan_proposals_owner on public.plan_proposals(user_id,created_at desc);
create table public.plan_revisions (
 plan_id uuid not null, user_id uuid not null, version integer not null,
 proposal_id uuid not null unique, snapshot jsonb not null, created_at timestamptz not null default now(),
 foreign key(plan_id,user_id) references public.coaching_plans(id,user_id) on delete cascade,
 foreign key(proposal_id,user_id) references public.plan_proposals(id,user_id) on delete cascade,
 primary key(plan_id,version)
);
do $$ declare t text; begin
 foreach t in array array['coaching_plans','training_plan_days','training_plan_exercises','nutrition_plan_references','coaching_meal_ideas','plan_proposals','plan_revisions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
-- Opaque database timestamp guard: reject preference changes during generation/confirmation.
create function public.coaching_profile_guard(p_user uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_array(p.updated_at,f.updated_at,n.updated_at) from public.profiles p
 join public.user_fitness_preferences f using(user_id) join public.user_nutrition_preferences n using(user_id) where p.user_id=p_user;
$$;
revoke all on function public.coaching_profile_guard(uuid) from public,anon,authenticated;
grant execute on function public.coaching_profile_guard(uuid) to service_role;
-- Only the server may publish a validated proposal. Lock the profile to serialize first-plan creation too.
create function public.confirm_coaching_proposal(p_user uuid,p_proposal uuid,p_confirm boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare proposal public.plan_proposals; current_plan public.coaching_plans; doc jsonb; d jsonb; e jsonb; m jsonb; day_id uuid; meal_id uuid; new_meal boolean:=false; next_version integer; pos integer;
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
 if jsonb_array_length(doc->'days') not between 1 and 7 or jsonb_array_length(doc->'meals') not between 1 and 8 then raise exception 'INVALID_PROPOSAL'; end if;
 insert into public.coaching_plans(user_id,primary_goal,preference_fingerprint,experience,equipment,training_days,session_minutes,version)
 values(p_user,doc->>'primaryGoal',proposal.preference_fingerprint,doc->>'experience',array(select jsonb_array_elements_text(doc->'equipment')),jsonb_array_length(doc->'days'),(doc->>'sessionMinutes')::integer,next_version)
 on conflict(user_id) do update set primary_goal=excluded.primary_goal,preference_fingerprint=excluded.preference_fingerprint,experience=excluded.experience,equipment=excluded.equipment,training_days=excluded.training_days,session_minutes=excluded.session_minutes,version=excluded.version,status='active',updated_at=now()
 returning * into current_plan;
 delete from public.training_plan_days where plan_id=current_plan.id;
 for d in select * from jsonb_array_elements(doc->'days') loop
  insert into public.training_plan_days(plan_id,user_id,weekday,name) values(current_plan.id,p_user,(d->>'weekday')::integer,d->>'name') returning id into day_id;
  pos:=0;
  for e in select * from jsonb_array_elements(d->'exercises') loop
   insert into public.training_plan_exercises(day_id,user_id,position,exercise_id,sets,reps,unit) values(day_id,p_user,pos,e->>'exerciseId',(e->>'sets')::integer,e->>'reps',e->>'unit'); pos:=pos+1;
  end loop;
 end loop;
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
 insert into public.plan_revisions(plan_id,user_id,version,proposal_id,snapshot) values(current_plan.id,p_user,next_version,proposal.id,doc);
 update public.plan_proposals set status='confirmed',confirmed_version=next_version where id=proposal.id;
 return current_plan.id;
end $$;
revoke all on function public.confirm_coaching_proposal(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.confirm_coaching_proposal(uuid,uuid,boolean) to service_role;
commit;
