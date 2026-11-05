-- Additive Milestone 4 schema. Apply with Supabase migrations, never via an admin browser client.
begin;
revoke create on schema public from public;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 units text not null default 'metric' check(units in ('metric','imperial')),
 time_zone text not null default 'Europe/London' check(length(time_zone) between 1 and 80),
 language text not null default 'en' check(language='en'),
 height_cm numeric check(height_cm between 80 and 250), weight_kg numeric check(weight_kg between 20 and 500), age integer check(age between 13 and 120),
 onboarding_step integer not null default 0 check(onboarding_step between 0 and 6), onboarding_complete boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_fitness_preferences (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 experience text check(experience in ('beginner','intermediate','advanced')),
 goals text[] not null default '{}' check(goals <@ array['muscle_gain','strength','recomposition','fat_loss','general_fitness']),
 equipment text[] check(equipment <@ array['dumbbells','bench','resistance-band','pull-up-bar','cable-machine','chest-press-machine','leg-extension-machine','leg-curl-machine']),
 environment text check(environment in ('gym','home','mixed')),
 training_days integer check(training_days between 1 and 7), session_minutes integer check(session_minutes between 10 and 240),
 target_muscles text[] not null default '{}' check(target_muscles <@ array['Traps','Lats','Chest','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Abs','Upper back']),
 updated_at timestamptz not null default now()
);
create table public.user_nutrition_preferences (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 dietary_pattern text not null default 'unspecified' check(dietary_pattern in ('unspecified','omnivore','vegetarian','vegan','pescatarian','halal','kosher','other')),
 cuisines text[] not null default '{}' check(cardinality(cuisines)<=20), dislikes text[] not null default '{}' check(cardinality(dislikes)<=20),
 allergies text[] not null default '{}' check(allergies <@ array['milk','eggs','fish','shellfish','peanuts','tree_nuts','soy','wheat','sesame','celery','mustard','lupin','molluscs','sulphites']),
 allergy_notes text not null default '' check(length(allergy_notes)<=300),
 weekly_budget numeric check(weekly_budget between 0 and 1000000), budget_currency text not null default 'GBP' check(budget_currency ~ '^[A-Z]{3}$'),
 meals_per_day integer check(meals_per_day between 1 and 8), updated_at timestamptz not null default now()
);
create table public.foods (
 id text primary key, name text not null, source text not null check(source in ('usda_fdc','development_fixture')),
 source_id text not null, source_url text not null, source_license text not null, retrieved_at timestamptz not null,
 preparation text not null check(preparation in ('raw','cooked','as_sold','unknown')),
 serving_grams numeric check(serving_grams>0), density_g_per_ml numeric check(density_g_per_ml>0),
 allergens text[] not null default '{}', allergen_status text not null default 'unknown' check(allergen_status in ('reviewed','unknown')),
 data_type text not null, verified boolean not null default false, unique(source,source_id)
);
create table public.food_nutrients (
 food_id text not null references public.foods(id) on delete cascade,
 nutrient text not null check(nutrient in ('energy_kcal','protein_g','carbohydrate_g','fat_g')),
 amount_per_100g numeric check(amount_per_100g>=0), unit text not null check(unit in ('kcal','g')),
 source_nutrient_id integer, primary key(food_id,nutrient),
 check((nutrient='energy_kcal' and unit='kcal') or (nutrient<>'energy_kcal' and unit='g'))
);
create table public.recipes (
 id text primary key, name text not null, cuisine text not null, dietary_patterns text[] not null default '{}',
 servings integer not null check(servings between 1 and 20), preparation_minutes integer not null check(preparation_minutes between 1 and 1440),
 instructions text[] not null, allergens text[] not null default '{}', allergen_status text not null default 'unknown' check(allergen_status in ('reviewed','unknown')),
 development_fixture boolean not null default true, source_url text, published boolean not null default false
);
create table public.recipe_ingredients (
 recipe_id text not null references public.recipes(id) on delete cascade, position integer not null check(position>=0),
 food_id text not null references public.foods(id), grams numeric not null check(grams>0), primary key(recipe_id,position)
);
create table public.meal_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(user_id) on delete cascade,
 title text not null check(length(title) between 1 and 100), created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.meal_plan_items (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null, user_id uuid not null,
 recipe_id text not null references public.recipes(id), servings numeric not null check(servings>0 and servings<=20),
 day integer not null check(day between 1 and 7), meal_number integer not null check(meal_number between 1 and 8),
 foreign key(plan_id,user_id) references public.meal_plans(id,user_id) on delete cascade,
 unique(plan_id,day,meal_number)
);
create table public.coach_conversations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(user_id) on delete cascade,
 title text not null default 'New conversation' check(length(title) between 1 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.coach_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null, user_id uuid not null,
 role text not null check(role in ('user','assistant')), content text not null check(length(content) between 1 and 5000),
 category text, response_status text, response_mode text, exercise_ids text[] not null default '{}',
 created_at timestamptz not null default now(),
 foreign key(conversation_id,user_id) references public.coach_conversations(id,user_id) on delete cascade
);
create index coach_messages_history on public.coach_messages(conversation_id,created_at,id);
create index conversations_owner on public.coach_conversations(user_id,updated_at desc);
create index meal_plans_owner on public.meal_plans(user_id,created_at desc);
-- Private operational data are RLS-enabled but have NO browser write policies.
create table public.ai_request_leases (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
 expires_at timestamptz not null, unique(conversation_id)
);
create table public.ai_rate_buckets (scope text not null, window_start timestamptz not null, count integer not null, primary key(scope,window_start));
create table public.ai_budgets (
 scope text not null, budget_day date not null, user_id uuid references auth.users(id) on delete cascade,
 tokens bigint not null default 0 check(tokens>=0), cost_usd numeric not null default 0 check(cost_usd>=0), primary key(scope,budget_day)
);
create table public.usage_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 stage text not null check(stage in ('scope','coach','review')), model text not null check(length(model)<=100),
 reserved_input bigint not null check(reserved_input>=0), reserved_output bigint not null check(reserved_output>=0),
 input_tokens bigint check(input_tokens>=0), output_tokens bigint check(output_tokens>=0),
 input_price numeric, output_price numeric, estimated_cost_usd numeric,
 status text not null default 'reserved' check(status in ('reserved','success','error')),
 created_at timestamptz not null default now()
);
create index usage_owner_time on public.usage_events(user_id,created_at desc);

-- Strict RLS on every table. Parent ownership is duplicated in child composite FKs.
do $$
declare table_name text;
begin
 foreach table_name in array array['profiles','user_fitness_preferences','user_nutrition_preferences','meal_plans','meal_plan_items','coach_conversations'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',table_name);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',table_name);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',table_name);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',table_name);
 end loop;
 foreach table_name in array array['foods','food_nutrients','recipes','recipe_ingredients','coach_messages','usage_events','ai_request_leases','ai_rate_buckets','ai_budgets'] loop
  execute format('alter table public.%I enable row level security',table_name);
 end loop;
end $$;
create policy food_reference_read on public.foods for select to authenticated using (verified or source='development_fixture');
create policy nutrients_reference_read on public.food_nutrients for select to authenticated using (exists(select 1 from public.foods f where f.id=food_id));
create policy recipes_reference_read on public.recipes for select to authenticated using(published);
create policy ingredients_reference_read on public.recipe_ingredients for select to authenticated using(exists(select 1 from public.recipes r where r.id=recipe_id and r.published));
create policy messages_owner_read on public.coach_messages for select to authenticated using((select auth.uid())=user_id);
create policy usage_owner_read on public.usage_events for select to authenticated using((select auth.uid())=user_id);
grant usage on schema public to anon,authenticated,service_role;
grant select,insert,update,delete on public.profiles,public.user_fitness_preferences,public.user_nutrition_preferences,public.meal_plans,public.meal_plan_items,public.coach_conversations to authenticated;
grant select on public.foods,public.food_nutrients,public.recipes,public.recipe_ingredients,public.coach_messages,public.usage_events to authenticated;
revoke all on public.ai_request_leases,public.ai_rate_buckets,public.ai_budgets from anon,authenticated;
revoke insert,update,delete on public.foods,public.food_nutrients,public.recipes,public.recipe_ingredients,public.coach_messages,public.usage_events from anon,authenticated;
grant all on all tables in schema public to service_role;

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','user_fitness_preferences','user_nutrition_preferences','coach_conversations'] loop execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t); end loop; end $$;
create function public.initialize_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id) values(new.id) on conflict do nothing;
 insert into public.user_fitness_preferences(user_id) values(new.id) on conflict do nothing;
 insert into public.user_nutrition_preferences(user_id) values(new.id) on conflict do nothing;
 return new;
end $$;
create trigger initialize_treviko_profile after insert on auth.users for each row execute function public.initialize_profile();
-- Backfill existing accounts without replacing any data.
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;
insert into public.user_fitness_preferences(user_id) select user_id from public.profiles on conflict do nothing;
insert into public.user_nutrition_preferences(user_id) select user_id from public.profiles on conflict do nothing;

create function public.save_profile(p_base jsonb,p_fitness jsonb,p_nutrition jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid := auth.uid(); b public.profiles; f public.user_fitness_preferences; n public.user_nutrition_preferences;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into b from public.profiles where user_id=uid for update;
 if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
 b := jsonb_populate_record(b,p_base); f := jsonb_populate_record((select x from public.user_fitness_preferences x where x.user_id=uid),p_fitness); n := jsonb_populate_record((select x from public.user_nutrition_preferences x where x.user_id=uid),p_nutrition);
 update public.profiles set display_name=b.display_name,units=b.units,time_zone=b.time_zone,language=b.language,height_cm=b.height_cm,weight_kg=b.weight_kg,age=b.age,onboarding_step=b.onboarding_step,onboarding_complete=b.onboarding_complete where user_id=uid;
 update public.user_fitness_preferences set experience=f.experience,goals=f.goals,equipment=f.equipment,environment=f.environment,training_days=f.training_days,session_minutes=f.session_minutes,target_muscles=f.target_muscles where user_id=uid;
 update public.user_nutrition_preferences set dietary_pattern=n.dietary_pattern,cuisines=n.cuisines,dislikes=n.dislikes,allergies=n.allergies,allergy_notes=n.allergy_notes,weekly_budget=n.weekly_budget,budget_currency=n.budget_currency,meals_per_day=n.meals_per_day where user_id=uid;
end $$;
revoke all on function public.save_profile(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_profile(jsonb,jsonb,jsonb) to authenticated;

create function public.save_meal_plan(p_title text,p_items jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare plan uuid; uid uuid := auth.uid(); item jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if jsonb_array_length(p_items) not between 1 and 56 then raise exception 'INVALID_ITEMS'; end if;
 insert into public.meal_plans(user_id,title) values(uid,p_title) returning id into plan;
 for item in select * from jsonb_array_elements(p_items) loop
  if not exists(select 1 from public.recipes where id=item->>'recipeId' and published) then raise exception 'RECIPE_UNAVAILABLE'; end if;
  insert into public.meal_plan_items(plan_id,user_id,recipe_id,servings,day,meal_number) values(plan,uid,item->>'recipeId',(item->>'servings')::numeric,(item->>'day')::integer,(item->>'mealNumber')::integer);
 end loop;
 return plan;
end $$;
revoke all on function public.save_meal_plan(text,jsonb) from public,anon;
grant execute on function public.save_meal_plan(text,jsonb) to authenticated;
commit;
