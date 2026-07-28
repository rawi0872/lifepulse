-- Life Pulse NEXTRON Explicit Preference Memory
-- Stores only user-confirmed preference memories for NEXTRON Memory v1.
-- Version: 0023
-- Depends on: 00022_nextron_context_preferences_privileges.sql

BEGIN;

create table if not exists public.nextron_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('PREFERENCE')),
  content text not null check (char_length(content) between 1 and 240),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUPERSEDED', 'DELETED')),
  source text not null default 'explicit_user' check (source in ('explicit_user')),
  confirmed_by_user boolean not null default true check (confirmed_by_user = true),
  supersedes_memory_id uuid references public.nextron_memories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint nextron_memories_deleted_state check ((status = 'DELETED') = (deleted_at is not null))
);

create index if not exists nextron_memories_user_active_idx
  on public.nextron_memories (user_id, status, updated_at desc)
  where status = 'ACTIVE';

create index if not exists nextron_memories_user_superseded_idx
  on public.nextron_memories (user_id, supersedes_memory_id)
  where supersedes_memory_id is not null;

alter table public.nextron_memories enable row level security;

drop policy if exists nextron_memories_select_own on public.nextron_memories;
create policy nextron_memories_select_own on public.nextron_memories
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists nextron_memories_insert_own on public.nextron_memories;
create policy nextron_memories_insert_own on public.nextron_memories
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and type = 'PREFERENCE'
    and status = 'ACTIVE'
    and source = 'explicit_user'
    and confirmed_by_user = true
    and deleted_at is null
  );

drop policy if exists nextron_memories_update_own on public.nextron_memories;
create policy nextron_memories_update_own on public.nextron_memories
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists nextron_memories_delete_own on public.nextron_memories;
create policy nextron_memories_delete_own on public.nextron_memories
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists on_nextron_memories_updated on public.nextron_memories;
create trigger on_nextron_memories_updated
  before update on public.nextron_memories
  for each row execute function public.handle_updated_at();

revoke all privileges on table public.nextron_memories from anon;
revoke all privileges on table public.nextron_memories from public;
revoke all privileges on table public.nextron_memories from authenticated;

grant select, insert, update, delete on table public.nextron_memories to authenticated;

COMMIT;

comment on table public.nextron_memories is
  'Owner-scoped NEXTRON Memory v1 records. Stores only explicit user-confirmed preference memories; never structured truth, model inference, conversation history, or workflow state.';

comment on column public.nextron_memories.content is
  'Sanitized confirmed preference text. Deleted memories are redacted and excluded from normal retrieval.';

comment on column public.nextron_memories.supersedes_memory_id is
  'Optional lineage link to a previous preference superseded by this active preference.';
