-- Life Pulse NEXTRON Context Preferences
-- Persists one permission record per authenticated user.
-- Version: 0021
-- Depends on: 00020_results_authenticated_privilege_minimization.sql

BEGIN;

create table if not exists public.nextron_context_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  permission_version integer not null default 1 check (permission_version = 1),
  allow_profile boolean not null default true,
  allow_today boolean not null default true,
  allow_tasks boolean not null default true,
  allow_habits boolean not null default true,
  allow_results boolean not null default true,
  allow_goals boolean not null default true,
  allow_projects boolean not null default true,
  allow_journal boolean not null default false,
  allow_evening_shutdown boolean not null default false,
  allow_weekly_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nextron_context_preferences enable row level security;

drop policy if exists nextron_context_preferences_select_own on public.nextron_context_preferences;
create policy nextron_context_preferences_select_own on public.nextron_context_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists nextron_context_preferences_insert_own on public.nextron_context_preferences;
create policy nextron_context_preferences_insert_own on public.nextron_context_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists nextron_context_preferences_update_own on public.nextron_context_preferences;
create policy nextron_context_preferences_update_own on public.nextron_context_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists nextron_context_preferences_delete_own on public.nextron_context_preferences;
create policy nextron_context_preferences_delete_own on public.nextron_context_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists on_nextron_context_preferences_updated on public.nextron_context_preferences;
create trigger on_nextron_context_preferences_updated
  before update on public.nextron_context_preferences
  for each row execute function public.handle_updated_at();

revoke all on public.nextron_context_preferences from anon;
revoke all on public.nextron_context_preferences from public;
grant select, insert, update, delete on public.nextron_context_preferences to authenticated;

COMMIT;

comment on table public.nextron_context_preferences is
  'One owner-scoped NEXTRON context permission record per user. Stores permissions only, never evidence or coaching responses.';

comment on column public.nextron_context_preferences.permission_version is
  'Permission schema version. Version 1 uses explicit boolean fields and text-heavy context defaults to false.';

comment on column public.nextron_context_preferences.allow_journal is
  'Allows bounded sanitized Journal text evidence when true. Defaults false.';

comment on column public.nextron_context_preferences.allow_evening_shutdown is
  'Allows bounded sanitized Evening Shutdown reflection evidence when true. Defaults false.';

comment on column public.nextron_context_preferences.allow_weekly_review is
  'Allows bounded sanitized Weekly Review reflection evidence when true. Defaults false.';
