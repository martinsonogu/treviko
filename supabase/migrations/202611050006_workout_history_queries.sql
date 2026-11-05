-- Read-only aggregation over the existing immutable workout store. No new stored history.
begin;
create function public.workout_history_region(p_title text) returns text
language sql immutable set search_path='' as $$
 select case
 when lower(trim(p_title)) ~ '^upper([ -]+body)?([ -]+([ab]|[0-9]+))?$' then 'upper'
 when lower(trim(p_title)) ~ '^lower([ -]+body)?([ -]+([ab]|[0-9]+))?$' then 'lower'
 when lower(trim(p_title)) ~ '^full[ -]*body([ -]+([ab]|[0-9]+))?$' then 'full'
 else 'unknown' end
$$;
revoke all on function public.workout_history_region(text) from public,anon;
grant execute on function public.workout_history_region(text) to authenticated,service_role;
create function public.completed_workout_history(p_region text default null,p_from timestamptz default null,p_until timestamptz default null,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if (p_region is not null and p_region not in ('upper','lower','full','unknown')) or p_offset is null or p_offset not between 0 and 1000000 or (p_from is not null and p_until is not null and p_from>=p_until) then raise exception 'INVALID_HISTORY_QUERY'; end if;
 with owned as materialized (
  select id,finished_at,plan_id,weekday,snapshot->>'title' as name,public.workout_history_region(snapshot->>'title') as region
  from public.workout_sessions where user_id=uid and status='completed'
 ), matched as materialized (
  select * from owned where (p_region is null or region=p_region) and (p_from is null or finished_at>=p_from) and (p_until is null or finished_at<p_until)
 ), page as (
  select * from matched order by finished_at desc,id desc limit 30 offset p_offset
 )
 select jsonb_build_object(
  'totalCompleted',(select count(*) from owned),
  'matchedCount',(select count(*) from matched),
  'countsByRegion',(select jsonb_build_object('upper',count(*) filter(where region='upper'),'lower',count(*) filter(where region='lower'),'full',count(*) filter(where region='full'),'unknown',count(*) filter(where region='unknown')) from owned),
  'offset',p_offset,'limit',30,'hasMore',(select count(*)>p_offset+30 from matched),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'completedAt',finished_at,'planId',plan_id,'weekday',weekday,'region',region) order by finished_at desc,id desc) from page),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.completed_workout_history(text,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.completed_workout_history(text,timestamptz,timestamptz,integer) to authenticated;
commit;
