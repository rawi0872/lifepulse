-- Today Priorities: cross-device priority persistence
-- Replaces localStorage-only priorities with backend storage.
-- Each user can have up to 3 priorities per day.

create table public.today_priorities (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  position   smallint not null,
  text       text not null,
  task_id    uuid null references public.tasks(id) on delete set null,
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint today_priorities_position_check check (position >= 1 and position <= 3),
  constraint today_priorities_user_date_position_unique unique (user_id, local_date, position),
  constraint today_priorities_text_nonempty check (length(trim(text)) > 0)
);

alter table public.today_priorities enable row level security;

revoke all privileges on table public.today_priorities from anon;
revoke all privileges on table public.today_priorities from public;
revoke all privileges on table public.today_priorities from authenticated;
grant select, insert, update, delete on table public.today_priorities to authenticated;

-- SELECT: owner can read own priorities
create policy "today_priorities_select_own" on public.today_priorities
  for select to authenticated
  using (auth.uid() = user_id);

-- INSERT: owner can insert own priorities, task link must belong to owner
create policy "today_priorities_insert_own" on public.today_priorities
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (task_id is null or public.task_belongs_to_user(task_id))
  );

-- UPDATE: owner can update own priorities, task link must belong to owner
create policy "today_priorities_update_own" on public.today_priorities
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (task_id is null or public.task_belongs_to_user(task_id))
  );

-- DELETE: owner can delete own priorities
create policy "today_priorities_delete_own" on public.today_priorities
  for delete to authenticated
  using (auth.uid() = user_id);

-- Auto-set updated_at on update
create trigger handle_today_priorities_updated_at
  before update on public.today_priorities
  for each row
  execute function public.handle_updated_at();

-- Index for efficient daily queries
create index today_priorities_user_date_idx
  on public.today_priorities (user_id, local_date);
