-- Life Pulse daily planning (PLAN V1 — Prompt 2/3).
-- Extends today_priorities so a Daily Priority can reference a task, a
-- habit, or a Weekly Outcome (at most one) plus one optional Daily Must Win.
-- Adds daily_plan_events: minimal append-only history (confirm / add /
-- remove / replace / must-win change / midday reset) for later Weekly Review.
-- No old migrations altered. Deleting tasks/habits/outcomes never destroys
-- priorities (FKs set null); deleting a priority orphans only its events'
-- pointer (set null), never the events themselves.

-- 1. PRIORITY REFERENCE COLUMNS + DAILY MUST WIN
alter table public.today_priorities
  add column if not exists habit_id uuid null references public.habits(id) on delete set null,
  add column if not exists outcome_id uuid null references public.weekly_outcomes(id) on delete set null,
  add column if not exists is_must_win boolean not null default false;

-- At most one reference per priority (task XOR habit XOR outcome XOR free text).
alter table public.today_priorities
  drop constraint if exists today_priorities_single_reference;
alter table public.today_priorities
  add constraint today_priorities_single_reference check (
    (case when task_id is not null then 1 else 0 end)
    + (case when habit_id is not null then 1 else 0 end)
    + (case when outcome_id is not null then 1 else 0 end) <= 1
  );

-- Exactly zero or one Daily Must Win per user/day.
create unique index if not exists today_priorities_user_date_must_win_unique
  on public.today_priorities (user_id, local_date)
  where is_must_win;

-- 2. OWNERSHIP HELPER FOR WEEKLY OUTCOMES
create or replace function public.weekly_outcome_belongs_to_user(outcome_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.weekly_outcomes where id = outcome_id and user_id = auth.uid());
$$;

-- 3. TODAY PRIORITIES POLICIES: extend ownership to habit/outcome links.
-- Destination-parent ownership enforced (00044 lesson): a row may only
-- reference entities its owner owns.
drop policy if exists "today_priorities_insert_own" on public.today_priorities;
create policy "today_priorities_insert_own" on public.today_priorities
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (task_id is null or public.task_belongs_to_user(task_id))
    and (habit_id is null or public.habit_belongs_to_user(habit_id))
    and (outcome_id is null or public.weekly_outcome_belongs_to_user(outcome_id))
  );

drop policy if exists "today_priorities_update_own" on public.today_priorities;
create policy "today_priorities_update_own" on public.today_priorities
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (task_id is null or public.task_belongs_to_user(task_id))
    and (habit_id is null or public.habit_belongs_to_user(habit_id))
    and (outcome_id is null or public.weekly_outcome_belongs_to_user(outcome_id))
  );

-- 4. DAILY PLAN EVENTS (append-only adjustment history)
create table if not exists public.daily_plan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  event_type text not null,
  priority_id uuid null references public.today_priorities(id) on delete set null,
  detail text null,
  created_at timestamptz not null default now(),
  constraint daily_plan_events_type_check check (event_type in (
    'morning_plan_confirmed',
    'priority_added',
    'priority_removed',
    'priority_replaced',
    'must_win_changed',
    'midday_reset'
  ))
);

create index if not exists idx_daily_plan_events_user_date
  on public.daily_plan_events(user_id, local_date, created_at);

alter table public.daily_plan_events enable row level security;

revoke all privileges on table public.daily_plan_events from anon;
revoke all privileges on table public.daily_plan_events from public;
revoke all privileges on table public.daily_plan_events from authenticated;
grant select, insert on table public.daily_plan_events to authenticated;

-- Events are append-only: no update, no delete. Linked priority must be owned.
drop policy if exists "daily_plan_events_select_own" on public.daily_plan_events;
create policy "daily_plan_events_select_own" on public.daily_plan_events
  for select using (auth.uid() = user_id);

drop policy if exists "daily_plan_events_insert_own" on public.daily_plan_events;
create policy "daily_plan_events_insert_own" on public.daily_plan_events
  for insert with check (
    auth.uid() = user_id
    and (
      priority_id is null
      or exists (select 1 from public.today_priorities where id = priority_id and user_id = auth.uid())
    )
  );
