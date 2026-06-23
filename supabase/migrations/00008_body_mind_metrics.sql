-- Life Pulse Body & Mind Metrics Migration
-- Adds manual daily tracking tables for physical and mental signals

-- 1. BODY METRICS
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  sleep_hours numeric(4,2) check (sleep_hours >= 0 and sleep_hours <= 24),
  sleep_quality integer check (sleep_quality >= 1 and sleep_quality <= 5),
  energy integer check (energy >= 1 and energy <= 5),
  steps integer check (steps >= 0),
  workout_minutes integer check (workout_minutes >= 0),
  weight_kg numeric(6,2) check (weight_kg > 0),
  resting_heart_rate integer check (resting_heart_rate > 0),
  recovery_score integer check (recovery_score >= 0 and recovery_score <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, entry_date)
);

-- 2. MIND METRICS
create table if not exists public.mind_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  mood integer check (mood >= 1 and mood <= 5),
  stress integer check (stress >= 1 and stress <= 5),
  focus integer check (focus >= 1 and focus <= 5),
  clarity integer check (clarity >= 1 and clarity <= 5),
  motivation integer check (motivation >= 1 and motivation <= 5),
  reflection text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, entry_date)
);

-- 3. INDEXES
create index if not exists idx_body_metrics_user_date on public.body_metrics(user_id, entry_date);
create index if not exists idx_mind_metrics_user_date on public.mind_metrics(user_id, entry_date);

-- 4. ROW LEVEL SECURITY
alter table public.body_metrics enable row level security;
alter table public.mind_metrics enable row level security;

-- 5. POLICIES: BODY METRICS
drop policy if exists "body_metrics_select_own" on public.body_metrics;
create policy "body_metrics_select_own" on public.body_metrics
  for select using (auth.uid() = user_id);

drop policy if exists "body_metrics_insert_own" on public.body_metrics;
create policy "body_metrics_insert_own" on public.body_metrics
  for insert with check (auth.uid() = user_id);

drop policy if exists "body_metrics_update_own" on public.body_metrics;
create policy "body_metrics_update_own" on public.body_metrics
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_metrics_delete_own" on public.body_metrics;
create policy "body_metrics_delete_own" on public.body_metrics
  for delete using (auth.uid() = user_id);

-- 6. POLICIES: MIND METRICS
drop policy if exists "mind_metrics_select_own" on public.mind_metrics;
create policy "mind_metrics_select_own" on public.mind_metrics
  for select using (auth.uid() = user_id);

drop policy if exists "mind_metrics_insert_own" on public.mind_metrics;
create policy "mind_metrics_insert_own" on public.mind_metrics
  for insert with check (auth.uid() = user_id);

drop policy if exists "mind_metrics_update_own" on public.mind_metrics;
create policy "mind_metrics_update_own" on public.mind_metrics
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mind_metrics_delete_own" on public.mind_metrics;
create policy "mind_metrics_delete_own" on public.mind_metrics
  for delete using (auth.uid() = user_id);

-- 7. UPDATED_AT TRIGGERS
drop trigger if exists on_body_metrics_updated on public.body_metrics;
create trigger on_body_metrics_updated
  before update on public.body_metrics
  for each row execute function public.handle_updated_at();

drop trigger if exists on_mind_metrics_updated on public.mind_metrics;
create trigger on_mind_metrics_updated
  before update on public.mind_metrics
  for each row execute function public.handle_updated_at();
