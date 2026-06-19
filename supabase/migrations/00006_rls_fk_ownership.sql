-- Life Pulse RLS FK Ownership Checks Migration
-- Validates that foreign-key references point to the user's own rows

-- Helper: check if a realm belongs to the current user
create or replace function public.realm_belongs_to_user(realm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.realms where id = realm_id and user_id = auth.uid());
$$;

-- Helper: check if a habit belongs to the current user
create or replace function public.habit_belongs_to_user(habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.habits where id = habit_id and user_id = auth.uid());
$$;

-- Helper: check if a project belongs to the current user
create or replace function public.project_belongs_to_user(project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects where id = project_id and user_id = auth.uid());
$$;

-- Helper: check if a task belongs to the current user
create or replace function public.task_belongs_to_user(task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tasks where id = task_id and user_id = auth.uid());
$$;

-- Helper: check if a habit_log belongs to the current user
create or replace function public.habit_log_belongs_to_user(log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.habit_logs where id = log_id and user_id = auth.uid());
$$;

-- ===== HABITS =====
-- realm_id must belong to the same user
drop policy if exists "habits_insert_own" on public.habits;
create policy "habits_insert_own" on public.habits
  for insert with check (
    auth.uid() = user_id
    and public.realm_belongs_to_user(realm_id)
  );

drop policy if exists "habits_update_own" on public.habits;
create policy "habits_update_own" on public.habits
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.realm_belongs_to_user(realm_id)
  );

-- ===== TASKS =====
-- realm_id and project_id must belong to the same user (if set)
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (
    auth.uid() = user_id
    and (realm_id is null or public.realm_belongs_to_user(realm_id))
    and (project_id is null or public.project_belongs_to_user(project_id))
  );

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (realm_id is null or public.realm_belongs_to_user(realm_id))
    and (project_id is null or public.project_belongs_to_user(project_id))
  );

-- ===== HABIT LOGS =====
-- habit_id must belong to the same user
drop policy if exists "habit_logs_insert_own" on public.habit_logs;
create policy "habit_logs_insert_own" on public.habit_logs
  for insert with check (
    auth.uid() = user_id
    and public.habit_belongs_to_user(habit_id)
  );

-- ===== XP EVENTS =====
-- source_id must point to a task or habit_log owned by the same user
drop policy if exists "xp_events_insert_own" on public.xp_events;
create policy "xp_events_insert_own" on public.xp_events
  for insert with check (
    auth.uid() = user_id
    and (
      (source_type = 'task' and public.task_belongs_to_user(source_id))
      or (source_type = 'habit' and public.habit_log_belongs_to_user(source_id))
    )
  );

-- ===== PROJECTS =====
-- realm_id must belong to the same user (if set)
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (
    auth.uid() = user_id
    and (realm_id is null or public.realm_belongs_to_user(realm_id))
  );

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (realm_id is null or public.realm_belongs_to_user(realm_id))
  );
