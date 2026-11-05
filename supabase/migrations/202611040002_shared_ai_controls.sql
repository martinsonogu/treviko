begin;
create function public.acquire_coach_request(p_user uuid,p_conversation uuid,p_user_rpm integer,p_global_rpm integer,p_concurrency integer,p_ttl integer default 120)
returns uuid language plpgsql security definer set search_path='' as $$
declare lease uuid; bucket_window timestamptz := date_trunc('minute',now()); n integer;
begin
 if p_user_rpm not between 1 and 60 or p_global_rpm not between 1 and 120 or p_concurrency not between 1 and 8 or p_ttl not between 30 and 180 then raise exception 'INVALID_LIMITS'; end if;
 perform pg_advisory_xact_lock(41004001);
 if not exists(select 1 from public.coach_conversations where id=p_conversation and user_id=p_user) then raise exception 'NOT_FOUND'; end if;
 delete from public.ai_request_leases where expires_at<=now();
 delete from public.ai_rate_buckets where window_start<now()-interval '2 minutes';
 insert into public.ai_rate_buckets(scope,window_start,count) values('global',bucket_window,1) on conflict(scope,window_start) do update set count=public.ai_rate_buckets.count+1 returning count into n;
 if n>p_global_rpm then raise exception 'RATE_LIMITED'; end if;
 insert into public.ai_rate_buckets(scope,window_start,count) values('user:'||p_user::text,bucket_window,1) on conflict(scope,window_start) do update set count=public.ai_rate_buckets.count+1 returning count into n;
 if n>p_user_rpm then raise exception 'RATE_LIMITED'; end if;
 if exists(select 1 from public.ai_request_leases where conversation_id=p_conversation) or (select count(*) from public.ai_request_leases where user_id=p_user)>=1 or (select count(*) from public.ai_request_leases)>=p_concurrency then raise exception 'BUSY'; end if;
 insert into public.ai_request_leases(user_id,conversation_id,expires_at) values(p_user,p_conversation,now()+make_interval(secs=>p_ttl)) returning id into lease;
 return lease;
end $$;
create function public.release_coach_request(p_lease uuid,p_user uuid) returns void language sql security definer set search_path='' as $$ delete from public.ai_request_leases where id=p_lease and user_id=p_user; $$;

create function public.reserve_ai_usage(p_user uuid,p_stage text,p_model text,p_input bigint,p_output bigint,p_daily_tokens bigint,p_global_tokens bigint,p_input_price numeric default null,p_output_price numeric default null,p_daily_cost numeric default null,p_global_cost numeric default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare event uuid; amount bigint:=p_input+p_output; cost numeric; day date:=(now() at time zone 'UTC')::date; b public.ai_budgets; scope_name text;
begin
 if p_input<0 or p_output<0 or amount>200000 or p_daily_tokens<1000 or p_global_tokens<1000 or p_daily_tokens>10000000 or p_global_tokens>100000000 or p_input_price<0 or p_output_price<0 then raise exception 'INVALID_BUDGET'; end if;
 if (p_daily_cost is not null or p_global_cost is not null) and (p_input_price is null or p_output_price is null) then raise exception 'PRICING_REQUIRED'; end if;
 cost:=case when p_input_price is not null and p_output_price is not null then (p_input*p_input_price+p_output*p_output_price)/1000000 else null end;
 perform pg_advisory_xact_lock(41004002);
 foreach scope_name in array array['global','user:'||p_user::text] loop
  insert into public.ai_budgets(scope,budget_day,user_id) values(scope_name,day,case when scope_name='global' then null else p_user end) on conflict do nothing;
  select * into b from public.ai_budgets where scope=scope_name and budget_day=day for update;
  if b.tokens+amount>(case when scope_name='global' then p_global_tokens else p_daily_tokens end) then raise exception 'TOKEN_BUDGET'; end if;
  if scope_name='global' and p_global_cost is not null and b.cost_usd+cost>p_global_cost then raise exception 'COST_BUDGET'; end if;
  if scope_name<>'global' and p_daily_cost is not null and b.cost_usd+cost>p_daily_cost then raise exception 'COST_BUDGET'; end if;
  update public.ai_budgets set tokens=tokens+amount,cost_usd=cost_usd+coalesce(cost,0) where scope=scope_name and budget_day=day;
 end loop;
 insert into public.usage_events(user_id,stage,model,reserved_input,reserved_output,input_price,output_price,estimated_cost_usd) values(p_user,p_stage,p_model,p_input,p_output,p_input_price,p_output_price,cost) returning id into event;
 return event;
end $$;
create function public.settle_ai_usage(p_event uuid,p_user uuid,p_success boolean,p_input bigint default null,p_output bigint default null)
returns void language plpgsql security definer set search_path='' as $$
declare e public.usage_events; amount bigint; cost numeric; day date;
begin
 if p_input<0 or p_output<0 then raise exception 'INVALID_USAGE'; end if;
 perform pg_advisory_xact_lock(41004002);
 select * into e from public.usage_events where id=p_event and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if e.status<>'reserved' then return; end if;
 amount:=coalesce(p_input,e.reserved_input)+coalesce(p_output,e.reserved_output);
 cost:=case when e.input_price is not null and e.output_price is not null then (coalesce(p_input,e.reserved_input)*e.input_price+coalesce(p_output,e.reserved_output)*e.output_price)/1000000 else null end;
 day:=(e.created_at at time zone 'UTC')::date;
 update public.ai_budgets set tokens=greatest(0,tokens-e.reserved_input-e.reserved_output+amount),cost_usd=greatest(0,cost_usd-coalesce(e.estimated_cost_usd,0)+coalesce(cost,0)) where budget_day=day and scope in ('global','user:'||p_user::text);
 update public.usage_events set input_tokens=p_input,output_tokens=p_output,estimated_cost_usd=cost,status=case when p_success then 'success' else 'error' end where id=e.id;
end $$;

create function public.append_coach_turn(p_user uuid,p_conversation uuid,p_message text,p_reply text,p_category text,p_status text,p_mode text,p_exercise_ids text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.coach_conversations where id=p_conversation and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if (select count(*) from public.coach_messages where conversation_id=p_conversation)>=500 then raise exception 'CONVERSATION_FULL'; end if;
 insert into public.coach_messages(conversation_id,user_id,role,content) values(p_conversation,p_user,'user',p_message);
 insert into public.coach_messages(conversation_id,user_id,role,content,category,response_status,response_mode,exercise_ids,created_at) values(p_conversation,p_user,'assistant',p_reply,p_category,p_status,p_mode,p_exercise_ids,now()+interval '1 microsecond');
 update public.coach_conversations set updated_at=now() where id=p_conversation and user_id=p_user;
end $$;
-- These functions perform privileged writes and MUST NOT be callable with a publishable key/JWT.
revoke all on function public.acquire_coach_request(uuid,uuid,integer,integer,integer,integer), public.release_coach_request(uuid,uuid), public.reserve_ai_usage(uuid,text,text,bigint,bigint,bigint,bigint,numeric,numeric,numeric,numeric), public.settle_ai_usage(uuid,uuid,boolean,bigint,bigint), public.append_coach_turn(uuid,uuid,text,text,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.acquire_coach_request(uuid,uuid,integer,integer,integer,integer), public.release_coach_request(uuid,uuid), public.reserve_ai_usage(uuid,text,text,bigint,bigint,bigint,bigint,numeric,numeric,numeric,numeric), public.settle_ai_usage(uuid,uuid,boolean,bigint,bigint), public.append_coach_turn(uuid,uuid,text,text,text,text,text,text[]) to service_role;
revoke all on function public.initialize_profile() from public,anon,authenticated;
create function public.clean_deleted_user_access() returns trigger language plpgsql security definer set search_path='' as $$ begin delete from public.ai_rate_buckets where scope='user:'||old.id::text; return old; end $$;
create trigger clean_deleted_user_access after delete on auth.users for each row execute function public.clean_deleted_user_access();
revoke all on function public.clean_deleted_user_access() from public,anon,authenticated;
commit;
