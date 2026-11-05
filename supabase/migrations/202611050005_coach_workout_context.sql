-- Persist only selected IDs, never a second copy of workout logs.
begin;
create table public.coach_workout_context (
 message_id uuid primary key references public.coach_messages(id) on delete cascade,
 conversation_id uuid not null,user_id uuid not null,
 workout_ids uuid[] not null check(cardinality(workout_ids) between 1 and 2),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(conversation_id,user_id) references public.coach_conversations(id,user_id) on delete cascade
);
alter table public.coach_workout_context enable row level security;
create policy workout_context_owner_read on public.coach_workout_context for select to authenticated using((select auth.uid())=user_id);
revoke all on public.coach_workout_context from public,anon,authenticated;
grant select on public.coach_workout_context to authenticated;
grant all on public.coach_workout_context to service_role;
create function public.append_coach_turn_with_workouts(p_user uuid,p_conversation uuid,p_message text,p_reply text,p_category text,p_status text,p_mode text,p_exercise_ids text[],p_workouts uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare message uuid; previous_messages uuid[];
begin
 if p_workouts is null or cardinality(p_workouts) not between 1 and 2 then raise exception 'INVALID_WORKOUT_REFERENCES'; end if;
 if (select count(*) from public.workout_sessions where user_id=p_user and status='completed' and id=any(p_workouts))<>cardinality(p_workouts) then raise exception 'NOT_FOUND'; end if;
 -- Serialize selection and append; identify the inserted row even if timestamps tie.
 perform 1 from public.coach_conversations where id=p_conversation and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into previous_messages from public.coach_messages where conversation_id=p_conversation;
 -- Existing append retains its ownership and conversation-size checks.
 perform public.append_coach_turn(p_user,p_conversation,p_message,p_reply,p_category,p_status,p_mode,p_exercise_ids);
 select id into message from public.coach_messages where conversation_id=p_conversation and user_id=p_user and role='assistant' and not(id=any(previous_messages));
 insert into public.coach_workout_context(message_id,conversation_id,user_id,workout_ids) values(message,p_conversation,p_user,p_workouts);
end $$;
revoke all on function public.append_coach_turn_with_workouts(uuid,uuid,text,text,text,text,text,text[],uuid[]) from public,anon,authenticated;
grant execute on function public.append_coach_turn_with_workouts(uuid,uuid,text,text,text,text,text,text[],uuid[]) to service_role;
commit;
