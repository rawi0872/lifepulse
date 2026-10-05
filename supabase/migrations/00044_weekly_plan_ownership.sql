-- Life Pulse Weekly Planning ownership hardening (PLAN V1 acceptance).
-- Live RLS testing proved the 00043 insert/update policies checked only
-- auth.uid() = user_id, never plan ownership: a user could attach THEIR OWN
-- rows to ANOTHER user's plan_id and squat positions / Must Win through the
-- per-plan unique constraints. This migration closes that hole. Reads are
-- unchanged (owner-only selects already isolate rows).

-- 1. HELPER: check if a weekly plan belongs to the current user
create or replace function public.weekly_plan_belongs_to_user(plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.weekly_plans where id = plan_id and user_id = auth.uid());
$$;

-- 2. WEEKLY OUTCOMES INSERT: own row + own plan + own goal/project
drop policy if exists "weekly_outcomes_insert_own" on public.weekly_outcomes;
create policy "weekly_outcomes_insert_own" on public.weekly_outcomes
  for insert with check (
    auth.uid() = user_id
    and public.weekly_plan_belongs_to_user(plan_id)
    and (goal_id is null or public.goal_belongs_to_user(goal_id))
    and (project_id is null or public.project_belongs_to_user(project_id))
  );

-- 3. WEEKLY OUTCOMES UPDATE: own row + destination plan stays own
drop policy if exists "weekly_outcomes_update_own" on public.weekly_outcomes;
create policy "weekly_outcomes_update_own" on public.weekly_outcomes
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and public.weekly_plan_belongs_to_user(plan_id)
    and (goal_id is null or public.goal_belongs_to_user(goal_id))
    and (project_id is null or public.project_belongs_to_user(project_id))
  );

-- 4. WEEKLY PLAN LINKS INSERT: own row + own plan + owned entity
drop policy if exists "weekly_plan_links_insert_own" on public.weekly_plan_links;
create policy "weekly_plan_links_insert_own" on public.weekly_plan_links
  for insert with check (
    auth.uid() = user_id
    and public.weekly_plan_belongs_to_user(plan_id)
    and (
      (linked_type = 'task' and public.task_belongs_to_user(linked_id))
      or (linked_type = 'habit' and public.habit_belongs_to_user(linked_id))
    )
  );

-- 5. WEEKLY PLAN LINKS UPDATE: destination plan stays own
drop policy if exists "weekly_plan_links_update_own" on public.weekly_plan_links;
create policy "weekly_plan_links_update_own" on public.weekly_plan_links
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and public.weekly_plan_belongs_to_user(plan_id)
  );
