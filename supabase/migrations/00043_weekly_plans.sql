-- Life Pulse Weekly Planning foundation (PLAN V1 — Prompt 1/3)
-- One weekly plan per user per local calendar week (Monday..Sunday),
-- up to 3 Weekly Outcomes (one optional Must Win), plus references to
-- existing goals/projects/tasks/habits. Links reference canonical rows;
-- nothing is duplicated. Deleting a task/habit/goal/project never
-- destroys a plan (FKs set null; link rows carry no FK).

-- 1. WEEKLY PLANS
create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  intention text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_plans_week_start_monday check (extract(isodow from week_start) = 1),
  constraint weekly_plans_week_end_sunday check (week_end = week_start + 6),
  constraint weekly_plans_user_week_unique unique (user_id, week_start)
);

-- 2. WEEKLY OUTCOMES
create table if not exists public.weekly_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  position smallint not null,
  text text not null,
  done boolean not null default false,
  must_win boolean not null default false,
  goal_id uuid null references public.goals(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_outcomes_position_check check (position >= 1 and position <= 3),
  constraint weekly_outcomes_text_nonempty check (length(trim(text)) > 0),
  constraint weekly_outcomes_plan_position_unique unique (plan_id, position)
);

-- Exactly zero or one Must Win per plan (multiple false rows allowed).
create unique index if not exists weekly_outcomes_plan_must_win_unique
  on public.weekly_outcomes (plan_id)
  where must_win;

-- 3. WEEKLY PLAN LINKS (supporting tasks/habits — references only)
create table if not exists public.weekly_plan_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  linked_type text not null,
  linked_id uuid not null,
  created_at timestamptz not null default now(),
  constraint weekly_plan_links_type_check check (linked_type in ('task', 'habit')),
  constraint weekly_plan_links_unique_link unique (plan_id, linked_type, linked_id)
);

-- 4. INDEXES
create index if not exists idx_weekly_plans_user_week on public.weekly_plans(user_id, week_start desc);
create index if not exists idx_weekly_outcomes_plan on public.weekly_outcomes(plan_id);
create index if not exists idx_weekly_plan_links_plan on public.weekly_plan_links(plan_id);

-- 5. ROW LEVEL SECURITY
alter table public.weekly_plans enable row level security;
alter table public.weekly_outcomes enable row level security;
alter table public.weekly_plan_links enable row level security;

revoke all privileges on table public.weekly_plans from anon;
revoke all privileges on table public.weekly_plans from public;
revoke all privileges on table public.weekly_plans from authenticated;
grant select, insert, update, delete on table public.weekly_plans to authenticated;

revoke all privileges on table public.weekly_outcomes from anon;
revoke all privileges on table public.weekly_outcomes from public;
revoke all privileges on table public.weekly_outcomes from authenticated;
grant select, insert, update, delete on table public.weekly_outcomes to authenticated;

revoke all privileges on table public.weekly_plan_links from anon;
revoke all privileges on table public.weekly_plan_links from public;
revoke all privileges on table public.weekly_plan_links from authenticated;
grant select, insert, update, delete on table public.weekly_plan_links to authenticated;

-- 6. POLICIES: WEEKLY PLANS (owner only)
drop policy if exists "weekly_plans_select_own" on public.weekly_plans;
create policy "weekly_plans_select_own" on public.weekly_plans
  for select using (auth.uid() = user_id);

drop policy if exists "weekly_plans_insert_own" on public.weekly_plans;
create policy "weekly_plans_insert_own" on public.weekly_plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "weekly_plans_update_own" on public.weekly_plans;
create policy "weekly_plans_update_own" on public.weekly_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weekly_plans_delete_own" on public.weekly_plans;
create policy "weekly_plans_delete_own" on public.weekly_plans
  for delete using (auth.uid() = user_id);

-- 7. POLICIES: WEEKLY OUTCOMES (owner only; goal/project links must belong to owner)
drop policy if exists "weekly_outcomes_select_own" on public.weekly_outcomes;
create policy "weekly_outcomes_select_own" on public.weekly_outcomes
  for select using (auth.uid() = user_id);

drop policy if exists "weekly_outcomes_insert_own" on public.weekly_outcomes;
create policy "weekly_outcomes_insert_own" on public.weekly_outcomes
  for insert with check (
    auth.uid() = user_id
    and (goal_id is null or public.goal_belongs_to_user(goal_id))
    and (project_id is null or public.project_belongs_to_user(project_id))
  );

drop policy if exists "weekly_outcomes_update_own" on public.weekly_outcomes;
create policy "weekly_outcomes_update_own" on public.weekly_outcomes
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (goal_id is null or public.goal_belongs_to_user(goal_id))
    and (project_id is null or public.project_belongs_to_user(project_id))
  );

drop policy if exists "weekly_outcomes_delete_own" on public.weekly_outcomes;
create policy "weekly_outcomes_delete_own" on public.weekly_outcomes
  for delete using (auth.uid() = user_id);

-- 8. POLICIES: WEEKLY PLAN LINKS (owner only; linked task/habit must belong to owner)
drop policy if exists "weekly_plan_links_select_own" on public.weekly_plan_links;
create policy "weekly_plan_links_select_own" on public.weekly_plan_links
  for select using (auth.uid() = user_id);

drop policy if exists "weekly_plan_links_insert_own" on public.weekly_plan_links;
create policy "weekly_plan_links_insert_own" on public.weekly_plan_links
  for insert with check (
    auth.uid() = user_id
    and (
      (linked_type = 'task' and public.task_belongs_to_user(linked_id))
      or (linked_type = 'habit' and public.habit_belongs_to_user(linked_id))
    )
  );

drop policy if exists "weekly_plan_links_update_own" on public.weekly_plan_links;
create policy "weekly_plan_links_update_own" on public.weekly_plan_links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "weekly_plan_links_delete_own" on public.weekly_plan_links;
create policy "weekly_plan_links_delete_own" on public.weekly_plan_links
  for delete using (auth.uid() = user_id);

-- 9. UPDATED_AT TRIGGERS
drop trigger if exists on_weekly_plans_updated on public.weekly_plans;
create trigger on_weekly_plans_updated
  before update on public.weekly_plans
  for each row execute function public.handle_updated_at();

drop trigger if exists on_weekly_outcomes_updated on public.weekly_outcomes;
create trigger on_weekly_outcomes_updated
  before update on public.weekly_outcomes
  for each row execute function public.handle_updated_at();
