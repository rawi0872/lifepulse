-- Life Pulse NEXTRON Conversation v1
-- Stores private user-visible conversation threads only. No hidden prompts, raw evidence, tokens, or chain-of-thought.

BEGIN;

create table if not exists public.nextron_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New NEXTRON conversation',
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nextron_conversations_title_length check (char_length(title) between 1 and 120)
);

alter table public.nextron_conversations enable row level security;

drop policy if exists nextron_conversations_select_own on public.nextron_conversations;
create policy nextron_conversations_select_own on public.nextron_conversations
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists nextron_conversations_insert_own on public.nextron_conversations;
create policy nextron_conversations_insert_own on public.nextron_conversations
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists nextron_conversations_update_own on public.nextron_conversations;
create policy nextron_conversations_update_own on public.nextron_conversations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists nextron_conversations_delete_own on public.nextron_conversations;
create policy nextron_conversations_delete_own on public.nextron_conversations
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists on_nextron_conversations_updated on public.nextron_conversations;
create trigger on_nextron_conversations_updated
  before update on public.nextron_conversations
  for each row execute function public.handle_updated_at();

create index if not exists idx_nextron_conversations_user_updated
  on public.nextron_conversations(user_id, deleted_at, updated_at desc);

create table if not exists public.nextron_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.nextron_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  response jsonb,
  metadata jsonb not null default '{}'::jsonb,
  client_message_id text,
  created_at timestamptz not null default now(),
  constraint nextron_messages_content_length check (char_length(content) between 1 and 6000),
  constraint nextron_messages_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint nextron_messages_response_object check (response is null or jsonb_typeof(response) = 'object')
);

alter table public.nextron_messages enable row level security;

drop policy if exists nextron_messages_select_own on public.nextron_messages;
create policy nextron_messages_select_own on public.nextron_messages
  for select to authenticated using (
    auth.uid() = user_id
    and exists (
      select 1 from public.nextron_conversations c
      where c.id = conversation_id and c.user_id = auth.uid() and c.deleted_at is null
    )
  );

drop policy if exists nextron_messages_insert_own on public.nextron_messages;
create policy nextron_messages_insert_own on public.nextron_messages
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.nextron_conversations c
      where c.id = conversation_id and c.user_id = auth.uid() and c.deleted_at is null
    )
  );

drop policy if exists nextron_messages_update_own on public.nextron_messages;
create policy nextron_messages_update_own on public.nextron_messages
  for update to authenticated using (
    auth.uid() = user_id
    and exists (
      select 1 from public.nextron_conversations c
      where c.id = conversation_id and c.user_id = auth.uid() and c.deleted_at is null
    )
  ) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.nextron_conversations c
      where c.id = conversation_id and c.user_id = auth.uid() and c.deleted_at is null
    )
  );

drop policy if exists nextron_messages_delete_own on public.nextron_messages;
create policy nextron_messages_delete_own on public.nextron_messages
  for delete to authenticated using (
    auth.uid() = user_id
    and exists (
      select 1 from public.nextron_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create index if not exists idx_nextron_messages_conversation_created
  on public.nextron_messages(conversation_id, created_at asc);

create index if not exists idx_nextron_messages_user_client_id
  on public.nextron_messages(user_id, client_message_id)
  where client_message_id is not null;

create unique index if not exists idx_nextron_messages_user_client_id_unique
  on public.nextron_messages(user_id, client_message_id)
  where client_message_id is not null;

revoke all privileges on table public.nextron_conversations from anon;
revoke all privileges on table public.nextron_conversations from public;
revoke all privileges on table public.nextron_conversations from authenticated;
grant select, insert, update, delete on table public.nextron_conversations to authenticated;

revoke all privileges on table public.nextron_messages from anon;
revoke all privileges on table public.nextron_messages from public;
revoke all privileges on table public.nextron_messages from authenticated;
grant select, insert, update, delete on table public.nextron_messages to authenticated;

COMMIT;

comment on table public.nextron_conversations is
  'Owner-scoped private NEXTRON conversation threads. Conversation history is context only, not Memory or permission authority.';

comment on table public.nextron_messages is
  'Owner-scoped visible NEXTRON conversation messages. Stores no hidden prompts, raw evidence dumps, OAuth tokens, or chain-of-thought.';
