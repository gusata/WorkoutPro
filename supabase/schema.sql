-- WorkoutPro cloud schema.
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Atleta',
  level integer not null default 1,
  xp integer not null default 0,
  total_volume numeric not null default 0,
  total_workouts integer not null default 0,
  streak integer not null default 0,
  longest_streak integer not null default 0,
  available_equipment text[] not null default '{}',
  last_workout_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  icon text not null,
  exercise_ids text[] not null default '{}',
  exercise_configs jsonb not null default '[]'::jsonb,
  scheduled_weekdays integer[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.exercises (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  notes text not null default '',
  equipment text not null default '',
  machine_settings text not null default '',
  alternatives text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.workout_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration integer not null default 0,
  exercises jsonb not null default '[]'::jsonb,
  total_volume numeric not null default 0,
  xp_earned integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.body_measurements (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  weight numeric,
  body_fat numeric,
  lean_mass numeric,
  chest numeric,
  arm numeric,
  forearm numeric,
  waist numeric,
  hip numeric,
  thigh numeric,
  calf numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.cardio_sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null,
  started_at timestamptz not null,
  duration integer not null default 0,
  distance numeric,
  calories numeric,
  avg_heart_rate integer,
  max_heart_rate integer,
  zones jsonb,
  effort integer,
  source text not null default 'manual',
  external_id text,
  source_name text,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.achievements (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  unlocked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists available_equipment text[] not null default '{}';
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists training_block jsonb;

alter table public.workouts add column if not exists updated_at timestamptz not null default now();
alter table public.workouts add column if not exists deleted_at timestamptz;
alter table public.workouts add column if not exists exercise_configs jsonb not null default '[]'::jsonb;
alter table public.workouts add column if not exists scheduled_weekdays integer[] not null default '{}';

alter table public.exercises add column if not exists updated_at timestamptz not null default now();
alter table public.exercises add column if not exists deleted_at timestamptz;
alter table public.exercises add column if not exists equipment text not null default '';
alter table public.exercises add column if not exists machine_settings text not null default '';
alter table public.exercises add column if not exists alternatives text[] not null default '{}';

alter table public.workout_sessions add column if not exists updated_at timestamptz not null default now();
alter table public.workout_sessions add column if not exists deleted_at timestamptz;

alter table public.body_measurements add column if not exists updated_at timestamptz not null default now();
alter table public.body_measurements add column if not exists deleted_at timestamptz;

alter table public.achievements add column if not exists updated_at timestamptz not null default now();
alter table public.achievements add column if not exists deleted_at timestamptz;

create index if not exists workouts_user_updated_idx on public.workouts (user_id, updated_at desc);
create index if not exists workouts_user_deleted_idx on public.workouts (user_id, deleted_at);
create index if not exists exercises_user_updated_idx on public.exercises (user_id, updated_at desc);
create index if not exists sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create index if not exists sessions_user_updated_idx on public.workout_sessions (user_id, updated_at desc);
create index if not exists measurements_user_date_idx on public.body_measurements (user_id, date desc);
create index if not exists achievements_user_updated_idx on public.achievements (user_id, updated_at desc);
create index if not exists cardio_user_updated_idx on public.cardio_sessions (user_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_workout_sessions_updated_at on public.workout_sessions;
create trigger touch_workout_sessions_updated_at
before update on public.workout_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists touch_workouts_updated_at on public.workouts;
create trigger touch_workouts_updated_at
before update on public.workouts
for each row execute function public.touch_updated_at();

drop trigger if exists touch_exercises_updated_at on public.exercises;
create trigger touch_exercises_updated_at
before update on public.exercises
for each row execute function public.touch_updated_at();

drop trigger if exists touch_body_measurements_updated_at on public.body_measurements;
create trigger touch_body_measurements_updated_at
before update on public.body_measurements
for each row execute function public.touch_updated_at();

drop trigger if exists touch_cardio_sessions_updated_at on public.cardio_sessions;
create trigger touch_cardio_sessions_updated_at
before update on public.cardio_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists touch_achievements_updated_at on public.achievements;
create trigger touch_achievements_updated_at
before update on public.achievements
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.body_measurements enable row level security;
alter table public.achievements enable row level security;
alter table public.cardio_sessions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "workouts_all_own" on public.workouts;
create policy "workouts_all_own" on public.workouts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercises_all_own" on public.exercises;
create policy "exercises_all_own" on public.exercises
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_all_own" on public.workout_sessions;
create policy "workout_sessions_all_own" on public.workout_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_measurements_all_own" on public.body_measurements;
create policy "body_measurements_all_own" on public.body_measurements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "achievements_all_own" on public.achievements;
create policy "achievements_all_own" on public.achievements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cardio_sessions_all_own" on public.cardio_sessions;
create policy "cardio_sessions_all_own" on public.cardio_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
