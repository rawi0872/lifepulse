-- Projects Migration
-- Adds projects table and links tasks to projects

-- 1. PROJECTS
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  realm_id uuid references public.realms(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  deadline date,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. ADD project_id TO TASKS
alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;

-- 3. INDEXES
create index if not exists idx_projects_user_id on public.projects(user_id);

-- 4. ROW LEVEL SECURITY
alter table public.projects enable row level security;

-- Projects policies
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- 5. UPDATED_AT TRIGGER
drop trigger if exists on_projects_updated on public.projects;
create trigger on_projects_updated
  before update on public.projects
  for each row execute function public.handle_updated_at();
