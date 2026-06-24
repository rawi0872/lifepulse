-- Life Pulse Passions/Hobbies Migration
-- Adds passion/hobby tracking tables

-- 1. PASSIONS
create table if not exists public.passions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  description text,
  status text default 'active',
  skill_level text,
  target_hours_per_week numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. PASSION SESSIONS
create table if not exists public.passion_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  passion_id uuid not null references public.passions(id) on delete cascade,
  session_date date not null default current_date,
  duration_minutes integer,
  focus text,
  notes text,
  enjoyment integer,
  difficulty integer,
  created_at timestamptz not null default now()
);

-- 3. PASSION MILESTONES
create table if not exists public.passion_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  passion_id uuid not null references public.passions(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. ROW LEVEL SECURITY
alter table public.passions enable row level security;
alter table public.passion_sessions enable row level security;
alter table public.passion_milestones enable row level security;

-- 5. POLICIES: PASSIONS
drop policy if exists "passions_select_own" on public.passions;
create policy "passions_select_own" on public.passions
  for select using (auth.uid() = user_id);

drop policy if exists "passions_insert_own" on public.passions;
create policy "passions_insert_own" on public.passions
  for insert with check (auth.uid() = user_id);

drop policy if exists "passions_update_own" on public.passions;
create policy "passions_update_own" on public.passions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "passions_delete_own" on public.passions;
create policy "passions_delete_own" on public.passions
  for delete using (auth.uid() = user_id);

-- 6. POLICIES: PASSION SESSIONS
drop policy if exists "passion_sessions_select_own" on public.passion_sessions;
create policy "passion_sessions_select_own" on public.passion_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "passion_sessions_insert_own" on public.passion_sessions;
create policy "passion_sessions_insert_own" on public.passion_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "passion_sessions_update_own" on public.passion_sessions;
create policy "passion_sessions_update_own" on public.passion_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "passion_sessions_delete_own" on public.passion_sessions;
create policy "passion_sessions_delete_own" on public.passion_sessions
  for delete using (auth.uid() = user_id);

-- 7. POLICIES: PASSION MILESTONES
drop policy if exists "passion_milestones_select_own" on public.passion_milestones;
create policy "passion_milestones_select_own" on public.passion_milestones
  for select using (auth.uid() = user_id);

drop policy if exists "passion_milestones_insert_own" on public.passion_milestones;
create policy "passion_milestones_insert_own" on public.passion_milestones
  for insert with check (auth.uid() = user_id);

drop policy if exists "passion_milestones_update_own" on public.passion_milestones;
create policy "passion_milestones_update_own" on public.passion_milestones
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "passion_milestones_delete_own" on public.passion_milestones;
create policy "passion_milestones_delete_own" on public.passion_milestones
  for delete using (auth.uid() = user_id);

-- 8. INDEXES
create index if not exists idx_passions_user on public.passions(user_id);
create index if not exists idx_passion_sessions_user_date on public.passion_sessions(user_id, session_date);
create index if not exists idx_passion_sessions_passion on public.passion_sessions(passion_id);
create index if not exists idx_passion_milestones_passion on public.passion_milestones(passion_id);
create index if not exists idx_passion_milestones_user on public.passion_milestones(user_id);

-- 9. UPDATED_AT TRIGGER FOR PASSIONS
drop trigger if exists on_passions_updated on public.passions;
create trigger on_passions_updated
  before update on public.passions
  for each row execute function public.handle_updated_at();
