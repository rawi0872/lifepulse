-- Life Pulse Goals Migration
-- Adds goals and goal_milestones for long-term outcome tracking

-- 1. GOALS
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  realm_id uuid references public.realms(id) on delete set null,
  title text not null,
  description text,
  why text,
  status text not null default 'active',
  priority text not null default 'medium',
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_status_check check (status in ('active', 'paused', 'completed', 'archived')),
  constraint goals_priority_check check (priority in ('low', 'medium', 'high')),
  constraint goals_title_not_empty check (length(trim(title)) > 0)
);

-- 2. GOAL MILESTONES
create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_title_not_empty check (length(trim(title)) > 0)
);

-- 3. INDEXES
create index if not exists idx_goals_user_status on public.goals(user_id, status);
create index if not exists idx_goals_user_target_date on public.goals(user_id, target_date);
create index if not exists idx_goals_realm_id on public.goals(realm_id);
create index if not exists idx_goal_milestones_user_goal on public.goal_milestones(user_id, goal_id);
create index if not exists idx_goal_milestones_goal_sort on public.goal_milestones(goal_id, sort_order);

-- 4. FK OWNERSHIP HELPER FOR GOALS
-- Realm must belong to the same user
create or replace function public.goal_realm_belongs_to_user()
returns trigger
language plpgsql
security invoker
as $$
begin
  if NEW.realm_id is not null then
    if not exists (select 1 from public.realms where id = NEW.realm_id and user_id = NEW.user_id) then
      raise exception 'realm_id must belong to the same user';
    end if;
  end if;
  return NEW;
end;
$$;

-- 5. ROW LEVEL SECURITY
alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;

-- 6. POLICIES: GOALS
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

-- 7. POLICIES: GOAL MILESTONES
drop policy if exists "goal_milestones_select_own" on public.goal_milestones;
create policy "goal_milestones_select_own" on public.goal_milestones
  for select using (auth.uid() = user_id);

drop policy if exists "goal_milestones_insert_own" on public.goal_milestones;
create policy "goal_milestones_insert_own" on public.goal_milestones
  for insert with check (auth.uid() = user_id);

drop policy if exists "goal_milestones_update_own" on public.goal_milestones;
create policy "goal_milestones_update_own" on public.goal_milestones
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goal_milestones_delete_own" on public.goal_milestones;
create policy "goal_milestones_delete_own" on public.goal_milestones
  for delete using (auth.uid() = user_id);

-- 8. TRIGGERS
drop trigger if exists on_goals_realm_ownership on public.goals;
create trigger on_goals_realm_ownership
  before insert or update on public.goals
  for each row execute function public.goal_realm_belongs_to_user();

drop trigger if exists on_goals_updated on public.goals;
create trigger on_goals_updated
  before update on public.goals
  for each row execute function public.handle_updated_at();

drop trigger if exists on_goal_milestones_updated on public.goal_milestones;
create trigger on_goal_milestones_updated
  before update on public.goal_milestones
  for each row execute function public.handle_updated_at();
