-- Optional, write-once effort feedback; completed workout rows remain immutable.
begin;
alter table public.workout_sessions add constraint workout_sessions_id_owner unique(id,user_id);
create table public.workout_feedback (
 session_id uuid primary key, user_id uuid not null,
 effort text not null check(effort in ('easy','about_right','hard','very_hard')),
 created_at timestamptz not null default now(),
 foreign key(session_id,user_id) references public.workout_sessions(id,user_id) on delete cascade
);
alter table public.workout_feedback enable row level security;
create policy feedback_owner_read on public.workout_feedback for select to authenticated using((select auth.uid())=user_id);
revoke all on public.workout_feedback from public,anon,authenticated;
grant select on public.workout_feedback to authenticated;
grant all on public.workout_feedback to service_role;
create function public.save_workout_feedback(p_user uuid,p_session uuid,p_effort text) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.workout_feedback;
begin
 if p_effort is null or p_effort not in ('easy','about_right','hard','very_hard') then raise exception 'INVALID_INPUT'; end if;
 perform 1 from public.workout_sessions where id=p_session and user_id=p_user and status='completed' for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into row from public.workout_feedback where session_id=p_session and user_id=p_user;
 if found then
  if row.effort<>p_effort then raise exception 'FEEDBACK_EXISTS'; end if;
  return to_jsonb(row);
 end if;
 insert into public.workout_feedback(session_id,user_id,effort) values(p_session,p_user,p_effort) returning * into row;
 return to_jsonb(row);
end $$;
revoke all on function public.save_workout_feedback(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.save_workout_feedback(uuid,uuid,text) to service_role;
commit;
