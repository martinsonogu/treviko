-- Read-only, owner-scoped progression samples and exact calendar frequency. No new storage.
begin;
create function public.progression_workout_history(p_from timestamptz,p_until timestamptz,p_zone text,p_exercise_ids text[] default '{}',p_exercise_slugs text[] default '{}',p_title text default null,p_region text default null,p_split timestamptz default null,p_anchor uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); anchor public.workout_sessions; result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_from is null or p_until is null or p_from>=p_until or p_until-p_from>interval '93 days' or p_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_zone)
 or p_exercise_ids is null or cardinality(p_exercise_ids)>8 or p_exercise_slugs is null or cardinality(p_exercise_slugs)>8
 or (p_title is not null and lower(p_title) not in ('upper a','upper b','lower a','lower b','full body a','full body b'))
 or (p_region is not null and p_region not in ('upper','lower','full'))
 or (p_split is not null and (p_split<=p_from or p_split>=p_until)) then raise exception 'INVALID_HISTORY_QUERY'; end if;
 if p_anchor is not null then
  select * into anchor from public.workout_sessions where id=p_anchor and user_id=uid and status='completed';
  if not found then raise exception 'NOT_FOUND'; end if;
 end if;
 with owned as materialized (
  select * from public.workout_sessions where user_id=uid and status='completed' and finished_at>=p_from and finished_at<p_until
  and (p_anchor is null or finished_at<anchor.finished_at or (finished_at=anchor.finished_at and id<=anchor.id))
 ), filtered as materialized (
  select * from owned where (p_region is null or public.workout_history_region(snapshot->>'title')=p_region)
  and (p_title is null or lower(regexp_replace(trim(snapshot->>'title'),'[ -]+',' ','g')) in (lower(p_title),replace(replace(lower(p_title),'upper ','upper body '),'lower ','lower body ')))
  and (cardinality(p_exercise_ids)=0 or exists(select 1 from jsonb_array_elements(snapshot->'exercises') e where e->>'exerciseId'=any(p_exercise_ids) or (coalesce(e->>'exerciseId','')='' and e->>'slug'=any(p_exercise_slugs))))
 ), ranked as (
  select f.*,row_number() over(partition by case when p_split is null then 0 when finished_at<p_split then 1 else 2 end order by finished_at desc,id desc) as position from filtered f
 ), sample as (
  select * from ranked where position<=case when p_split is null then 30 else 15 end
 ), daily as (
  select (finished_at at time zone p_zone)::date as day,count(*) as count from owned group by 1
 )
 select jsonb_build_object(
 'sessions',coalesce((select jsonb_agg(to_jsonb(s)-'position' order by finished_at desc,id desc) from sample s),'[]'::jsonb),
 'matchingCount',(select count(*) from filtered),'sampleLimit',30,
 'frequency',jsonb_build_object('from',p_from,'until',p_until,'timeZone',p_zone,'completedWorkouts',(select count(*) from owned),'trainingDays',(select count(*) from daily),'days',coalesce((select jsonb_agg(jsonb_build_object('day',day,'workouts',count) order by day) from daily),'[]'::jsonb))
 ) into result;
 return result;
end $$;
revoke all on function public.progression_workout_history(timestamptz,timestamptz,text,text[],text[],text,text,timestamptz,uuid) from public,anon;
grant execute on function public.progression_workout_history(timestamptz,timestamptz,text,text[],text[],text,text,timestamptz,uuid) to authenticated;
commit;
