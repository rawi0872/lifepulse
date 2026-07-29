-- Life Pulse Google Calendar read-only connector foundation
-- Stores owner-scoped encrypted OAuth tokens and keeps NEXTRON Calendar read permission separate.

BEGIN;

alter table public.nextron_context_preferences
  add column if not exists allow_calendar boolean not null default false;

alter table public.nextron_context_preferences
  alter column permission_version set default 3;

alter table public.nextron_context_preferences
  drop constraint if exists nextron_context_preferences_permission_version_check;

alter table public.nextron_context_preferences
  add constraint nextron_context_preferences_permission_version_check
  check (permission_version in (1, 2, 3));

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_tokens text not null,
  token_iv text not null,
  token_tag text not null,
  encryption_version integer not null default 1 check (encryption_version = 1),
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  google_account_hint text,
  status text not null default 'connected' check (status in ('connected', 'error', 'revoked')),
  last_error_code text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

drop policy if exists google_calendar_connections_select_own on public.google_calendar_connections;
create policy google_calendar_connections_select_own on public.google_calendar_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists google_calendar_connections_insert_own on public.google_calendar_connections;
create policy google_calendar_connections_insert_own on public.google_calendar_connections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists google_calendar_connections_update_own on public.google_calendar_connections;
create policy google_calendar_connections_update_own on public.google_calendar_connections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists google_calendar_connections_delete_own on public.google_calendar_connections;
create policy google_calendar_connections_delete_own on public.google_calendar_connections
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists on_google_calendar_connections_updated on public.google_calendar_connections;
create trigger on_google_calendar_connections_updated
  before update on public.google_calendar_connections
  for each row execute function public.handle_updated_at();

create table if not exists public.google_calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_path text not null default '/settings',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.google_calendar_oauth_states enable row level security;

drop policy if exists google_calendar_oauth_states_select_own on public.google_calendar_oauth_states;
create policy google_calendar_oauth_states_select_own on public.google_calendar_oauth_states
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists google_calendar_oauth_states_insert_own on public.google_calendar_oauth_states;
create policy google_calendar_oauth_states_insert_own on public.google_calendar_oauth_states
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists google_calendar_oauth_states_update_own on public.google_calendar_oauth_states;
create policy google_calendar_oauth_states_update_own on public.google_calendar_oauth_states
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists google_calendar_oauth_states_delete_own on public.google_calendar_oauth_states;
create policy google_calendar_oauth_states_delete_own on public.google_calendar_oauth_states
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all privileges on table public.google_calendar_connections from anon;
revoke all privileges on table public.google_calendar_connections from public;
revoke all privileges on table public.google_calendar_connections from authenticated;
grant select, insert, update, delete on table public.google_calendar_connections to authenticated;

revoke all privileges on table public.google_calendar_oauth_states from anon;
revoke all privileges on table public.google_calendar_oauth_states from public;
revoke all privileges on table public.google_calendar_oauth_states from authenticated;
grant select, insert, update, delete on table public.google_calendar_oauth_states to authenticated;

COMMIT;

comment on column public.nextron_context_preferences.allow_calendar is
  'Allows NEXTRON to perform bounded read-only Google Calendar retrieval when the user also has a connected Calendar account. Defaults false.';

comment on table public.google_calendar_connections is
  'Owner-scoped Google Calendar OAuth connection state. Tokens are encrypted server-side before persistence and are never browser-readable.';

comment on table public.google_calendar_oauth_states is
  'Owner-scoped one-time OAuth state records for Google Calendar connector CSRF and callback binding.';
