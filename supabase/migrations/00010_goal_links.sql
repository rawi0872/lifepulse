-- Life Pulse Goal Links Migration
-- Connects goals to existing projects, tasks, and habits

-- 1. HELPER: check if a goal belongs to the current user
create or replace function public.goal_belongs_to_user(goal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.goals where id = goal_id and user_id = auth.uid());
$$;

-- 2. GOAL LINKS TABLE
create table if not exists public.goal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  linked_type text not null,
  linked_id uuid not null,
  created_at timestamptz not null default now(),
  constraint goal_links_type_check check (linked_type in ('project', 'task', 'habit')),
  constraint goal_links_unique_link unique (user_id, goal_id, linked_type, linked_id)
);

-- 3. INDEXES
create index if not exists idx_goal_links_user_goal on public.goal_links(user_id, goal_id);
create index if not exists idx_goal_links_user_linked on public.goal_links(user_id, linked_type, linked_id);
create index if not exists idx_goal_links_goal on public.goal_links(goal_id);

-- 4. ROW LEVEL SECURITY
alter table public.goal_links enable row level security;

-- 5. POLICIES
drop policy if exists "goal_links_select_own" on public.goal_links;
create policy "goal_links_select_own" on public.goal_links
  for select using (auth.uid() = user_id);

drop policy if exists "goal_links_insert_own" on public.goal_links;
create policy "goal_links_insert_own" on public.goal_links
  for insert with check (
    auth.uid() = user_id
    and public.goal_belongs_to_user(goal_id)
    and (
      (linked_type = 'project' and public.project_belongs_to_user(linked_id))
      or (linked_type = 'task' and public.task_belongs_to_user(linked_id))
      or (linked_type = 'habit' and public.habit_belongs_to_user(linked_id))
    )
  );

drop policy if exists "goal_links_update_own" on public.goal_links;
create policy "goal_links_update_own" on public.goal_links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goal_links_delete_own" on public.goal_links;
create policy "goal_links_delete_own" on public.goal_links
  for delete using (auth.uid() = user_id);
