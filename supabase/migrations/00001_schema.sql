-- Lifepulse Schema Migration
-- Run this in your Supabase SQL editor

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  display_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. REALMS
create table if not exists public.realms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  icon text not null default '🌟',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. HABITS
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  realm_id uuid not null references public.realms(id) on delete cascade,
  title text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekdays', 'weekends', 'weekly')),
  days_of_week integer[],
  created_at timestamptz not null default now()
);

-- 4. HABIT LOGS
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_date date not null,
  created_at timestamptz not null default now(),
  unique(habit_id, completed_date)
);

-- 5. TASKS
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  realm_id uuid references public.realms(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 6. XP EVENTS
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('habit', 'task')),
  source_id uuid not null,
  amount integer not null,
  created_at timestamptz not null default now()
);

-- 7. JOURNAL ENTRIES
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  content text not null default '',
  mood integer check (mood >= 1 and mood <= 5),
  energy integer check (energy >= 1 and energy <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, entry_date)
);

-- ========== FUNCTIONS & TRIGGERS ==========

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists on_journal_updated on public.journal_entries;
create trigger on_journal_updated
  before update on public.journal_entries
  for each row execute function public.handle_updated_at();

-- ========== INDEXES ==========
create index if not exists idx_habits_user_id on public.habits(user_id);
create index if not exists idx_habit_logs_user_id on public.habit_logs(user_id);
create index if not exists idx_habit_logs_completed_date on public.habit_logs(completed_date);
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_xp_events_user_id on public.xp_events(user_id);
create index if not exists idx_xp_events_source on public.xp_events(source_type, source_id);
create index if not exists idx_journal_user_date on public.journal_entries(user_id, entry_date);
create index if not exists idx_realms_user_id on public.realms(user_id);

-- ========== ROW LEVEL SECURITY ==========
alter table public.profiles enable row level security;
alter table public.realms enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.tasks enable row level security;
alter table public.xp_events enable row level security;
alter table public.journal_entries enable row level security;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realms
drop policy if exists "realms_select_own" on public.realms;
create policy "realms_select_own" on public.realms
  for select using (auth.uid() = user_id);

drop policy if exists "realms_insert_own" on public.realms;
create policy "realms_insert_own" on public.realms
  for insert with check (auth.uid() = user_id);

drop policy if exists "realms_update_own" on public.realms;
create policy "realms_update_own" on public.realms
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- V1: No realm deletion allowed
drop policy if exists "realms_no_delete_v1" on public.realms;
create policy "realms_no_delete_v1" on public.realms
  for delete using (false);

-- Habits
drop policy if exists "habits_select_own" on public.habits;
create policy "habits_select_own" on public.habits
  for select using (auth.uid() = user_id);

drop policy if exists "habits_insert_own" on public.habits;
create policy "habits_insert_own" on public.habits
  for insert with check (auth.uid() = user_id);

drop policy if exists "habits_update_own" on public.habits;
create policy "habits_update_own" on public.habits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habits_delete_own" on public.habits;
create policy "habits_delete_own" on public.habits
  for delete using (auth.uid() = user_id);

-- Habit Logs
drop policy if exists "habit_logs_select_own" on public.habit_logs;
create policy "habit_logs_select_own" on public.habit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "habit_logs_insert_own" on public.habit_logs;
create policy "habit_logs_insert_own" on public.habit_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "habit_logs_delete_own" on public.habit_logs;
create policy "habit_logs_delete_own" on public.habit_logs
  for delete using (auth.uid() = user_id);

-- Tasks
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- XP Events
drop policy if exists "xp_events_select_own" on public.xp_events;
create policy "xp_events_select_own" on public.xp_events
  for select using (auth.uid() = user_id);

drop policy if exists "xp_events_insert_own" on public.xp_events;
create policy "xp_events_insert_own" on public.xp_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "xp_events_delete_own" on public.xp_events;
create policy "xp_events_delete_own" on public.xp_events
  for delete using (auth.uid() = user_id);

-- Journal Entries
drop policy if exists "journal_select_own" on public.journal_entries;
create policy "journal_select_own" on public.journal_entries
  for select using (auth.uid() = user_id);

drop policy if exists "journal_insert_own" on public.journal_entries;
create policy "journal_insert_own" on public.journal_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "journal_update_own" on public.journal_entries;
create policy "journal_update_own" on public.journal_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "journal_delete_own" on public.journal_entries;
create policy "journal_delete_own" on public.journal_entries
  for delete using (auth.uid() = user_id);
