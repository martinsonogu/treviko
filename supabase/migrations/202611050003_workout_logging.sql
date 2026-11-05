-- Immutable prescriptions and versioned actuals. Only validated server operations write.
begin;
create table public.workout_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(user_id) on delete cascade,
 -- Deliberately no cascading plan FK: history survives plan replacement/removal.
 plan_id uuid not null, plan_version integer not null check(plan_version>0), weekday integer not null check(weekday between 1 and 7),
 start_key uuid not null, status text not null default 'in_progress' check(status in ('in_progress','completed','discarded')),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), performance jsonb not null check(jsonb_typeof(performance)='object'),
 load_unit text not null check(load_unit in ('kg','lb')), version integer not null default 1 check(version>0), last_operation uuid,
 started_at timestamptz not null default now(), updated_at timestamptz not null default now(), finished_at timestamptz,
 unique(user_id,start_key), check((status='in_progress')=(finished_at is null))
);
create unique index one_open_workout_per_user on public.workout_sessions(user_id) where status='in_progress';
create index workouts_owner_history on public.workout_sessions(user_id,finished_at desc) where status='completed';
alter table public.workout_sessions enable row level security;
create policy workouts_owner_read on public.workout_sessions for select to authenticated using((select auth.uid())=user_id);
revoke all on public.workout_sessions from anon,authenticated;
grant select on public.workout_sessions to authenticated;
grant all on public.workout_sessions to service_role;
create function public.protect_workout_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status<>'in_progress' then raise exception 'WORKOUT_CLOSED'; end if;
 if new.snapshot is distinct from old.snapshot or new.user_id<>old.user_id or new.plan_id<>old.plan_id or new.plan_version<>old.plan_version or new.weekday<>old.weekday or new.start_key<>old.start_key or new.load_unit<>old.load_unit or new.started_at<>old.started_at then raise exception 'IMMUTABLE_PRESCRIPTION'; end if;
 return new;
end $$;
create trigger protect_workout_snapshot before update on public.workout_sessions for each row execute function public.protect_workout_snapshot();
create function public.start_workout_session(p_user uuid,p_plan uuid,p_plan_version integer,p_weekday integer,p_key uuid,p_snapshot jsonb,p_performance jsonb,p_unit text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.workout_sessions; current_plan public.coaching_plans;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,51005));
 select * into existing from public.workout_sessions where user_id=p_user and start_key=p_key;
 if found then return to_jsonb(existing); end if;
 select * into existing from public.workout_sessions where user_id=p_user and status='in_progress';
 if found then return to_jsonb(existing); end if;
 select * into current_plan from public.coaching_plans where id=p_plan and user_id=p_user and status='active' for share;
 if not found then raise exception 'NOT_FOUND'; end if;
 if current_plan.version<>p_plan_version then raise exception 'VERSION_CONFLICT'; end if;
 if not exists(select 1 from public.training_plan_days where plan_id=p_plan and user_id=p_user and weekday=p_weekday) then raise exception 'NOT_FOUND'; end if;
 insert into public.workout_sessions(user_id,plan_id,plan_version,weekday,start_key,snapshot,performance,load_unit) values(p_user,p_plan,p_plan_version,p_weekday,p_key,p_snapshot,p_performance,p_unit) returning * into existing;
 return to_jsonb(existing);
end $$;
create function public.update_workout_session(p_user uuid,p_session uuid,p_version integer,p_operation uuid,p_action text,p_performance jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare session public.workout_sessions; target text;
begin
 if p_action not in ('save','finish','discard') or p_operation is null then raise exception 'INVALID_INPUT'; end if;
 target:=case p_action when 'save' then 'in_progress' when 'finish' then 'completed' else 'discarded' end;
 select * into session from public.workout_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if session.last_operation=p_operation and session.performance=p_performance and session.status=target then return to_jsonb(session); end if;
 if session.status<>'in_progress' then raise exception 'WORKOUT_CLOSED'; end if;
 if session.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
 if jsonb_typeof(p_performance->'exercises') is distinct from 'array' or jsonb_array_length(p_performance->'exercises')<>jsonb_array_length(session.snapshot->'exercises') then raise exception 'INVALID_INPUT'; end if;
 if p_action='finish' and not exists(select 1 from jsonb_array_elements(p_performance->'exercises') e cross join lateral jsonb_array_elements(e->'sets') s where s->'done'='true'::jsonb and jsonb_typeof(s->'amount')='number') then raise exception 'INVALID_INPUT'; end if;
 update public.workout_sessions set performance=p_performance,status=target,finished_at=case when target='in_progress' then null else now() end,version=version+1,last_operation=p_operation,updated_at=now() where id=p_session returning * into session;
 return to_jsonb(session);
end $$;
revoke all on function public.protect_workout_snapshot(),public.start_workout_session(uuid,uuid,integer,integer,uuid,jsonb,jsonb,text),public.update_workout_session(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.start_workout_session(uuid,uuid,integer,integer,uuid,jsonb,jsonb,text),public.update_workout_session(uuid,uuid,integer,uuid,text,jsonb) to service_role;
commit;
