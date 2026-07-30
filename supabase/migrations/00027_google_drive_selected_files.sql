-- Life Pulse Google Drive selected-files connector
-- Stores owner-scoped Drive authorization and selected-file provenance only.

BEGIN;

alter table public.nextron_context_preferences
  add column if not exists allow_drive boolean not null default false;

alter table public.nextron_context_preferences
  alter column permission_version set default 4;

alter table public.nextron_context_preferences
  drop constraint if exists nextron_context_preferences_permission_version_check;

alter table public.nextron_context_preferences
  add constraint nextron_context_preferences_permission_version_check
  check (permission_version in (1, 2, 3, 4));

alter table public.knowledge_items
  add column if not exists source_provider text not null default 'life_pulse'
  check (source_provider in ('life_pulse', 'google_drive'));

create index if not exists idx_knowledge_items_source_provider
  on public.knowledge_items(user_id, source_provider);

create table if not exists public.google_drive_connections (
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

alter table public.google_drive_connections enable row level security;

drop policy if exists google_drive_connections_select_own on public.google_drive_connections;
create policy google_drive_connections_select_own on public.google_drive_connections
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists google_drive_connections_insert_own on public.google_drive_connections;
create policy google_drive_connections_insert_own on public.google_drive_connections
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists google_drive_connections_update_own on public.google_drive_connections;
create policy google_drive_connections_update_own on public.google_drive_connections
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists google_drive_connections_delete_own on public.google_drive_connections;
create policy google_drive_connections_delete_own on public.google_drive_connections
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists on_google_drive_connections_updated on public.google_drive_connections;
create trigger on_google_drive_connections_updated
  before update on public.google_drive_connections
  for each row execute function public.handle_updated_at();

create table if not exists public.google_drive_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_path text not null default '/settings',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.google_drive_oauth_states enable row level security;

drop policy if exists google_drive_oauth_states_select_own on public.google_drive_oauth_states;
create policy google_drive_oauth_states_select_own on public.google_drive_oauth_states
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists google_drive_oauth_states_insert_own on public.google_drive_oauth_states;
create policy google_drive_oauth_states_insert_own on public.google_drive_oauth_states
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists google_drive_oauth_states_update_own on public.google_drive_oauth_states;
create policy google_drive_oauth_states_update_own on public.google_drive_oauth_states
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists google_drive_oauth_states_delete_own on public.google_drive_oauth_states;
create policy google_drive_oauth_states_delete_own on public.google_drive_oauth_states
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.google_drive_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_drive_file_id text not null,
  resource_key text,
  display_title text not null,
  mime_type text not null,
  drive_modified_at timestamptz,
  imported_at timestamptz not null default now(),
  last_synced_at timestamptz,
  status text not null default 'active' check (status in ('active', 'removed', 'error', 'unsupported', 'too_large')),
  last_error_code text,
  content_hash text,
  content_size integer,
  knowledge_item_id uuid references public.knowledge_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_drive_file_id)
);

alter table public.google_drive_imports enable row level security;

drop policy if exists google_drive_imports_select_own on public.google_drive_imports;
create policy google_drive_imports_select_own on public.google_drive_imports
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists google_drive_imports_insert_own on public.google_drive_imports;
create policy google_drive_imports_insert_own on public.google_drive_imports
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists google_drive_imports_update_own on public.google_drive_imports;
create policy google_drive_imports_update_own on public.google_drive_imports
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists google_drive_imports_delete_own on public.google_drive_imports;
create policy google_drive_imports_delete_own on public.google_drive_imports
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_google_drive_imports_user_status
  on public.google_drive_imports(user_id, status, updated_at desc);

drop trigger if exists on_google_drive_imports_updated on public.google_drive_imports;
create trigger on_google_drive_imports_updated
  before update on public.google_drive_imports
  for each row execute function public.handle_updated_at();

revoke all privileges on table public.google_drive_connections from anon;
revoke all privileges on table public.google_drive_connections from public;
revoke all privileges on table public.google_drive_connections from authenticated;
grant select, insert, update, delete on table public.google_drive_connections to authenticated;

revoke all privileges on table public.google_drive_oauth_states from anon;
revoke all privileges on table public.google_drive_oauth_states from public;
revoke all privileges on table public.google_drive_oauth_states from authenticated;
grant select, insert, update, delete on table public.google_drive_oauth_states to authenticated;

revoke all privileges on table public.google_drive_imports from anon;
revoke all privileges on table public.google_drive_imports from public;
revoke all privileges on table public.google_drive_imports from authenticated;
grant select, insert, update, delete on table public.google_drive_imports to authenticated;

create or replace function public.search_knowledge_chunks_fts(
  query_text text,
  match_count integer default 3,
  candidate_count integer default 20,
  include_google_drive boolean default false
)
returns table (
  title text,
  type text,
  category text,
  section text,
  content text,
  source_url text,
  source_provider text,
  updated_at timestamptz,
  retrieval_source text
)
language sql
stable
set search_path = public, extensions
as $$
  with params as (
    select
      websearch_to_tsquery('english', left(coalesce(query_text, ''), 180)) as q,
      least(greatest(coalesce(match_count, 3), 1), 8) as final_limit,
      least(greatest(coalesce(candidate_count, 20), 1), 40) as candidate_limit
  )
  select
    item.title,
    item.type,
    item.category,
    chunk.section,
    chunk.content,
    item.source_url,
    item.source_provider,
    item.updated_at,
    'fts'::text as retrieval_source
  from params, public.knowledge_chunks chunk
  join public.knowledge_items item on item.id = chunk.knowledge_item_id
  where chunk.user_id = auth.uid()
    and item.user_id = auth.uid()
    and item.status = 'active'
    and (include_google_drive or item.source_provider <> 'google_drive')
    and chunk.search_vector @@ params.q
  order by ts_rank_cd(chunk.search_vector, params.q) desc, item.updated_at desc, chunk.chunk_index asc
  limit (select final_limit from params);
$$;

create or replace function public.search_knowledge_chunks_hybrid(
  query_text text,
  query_embedding_text text,
  match_count integer default 3,
  fts_candidate_count integer default 20,
  semantic_candidate_count integer default 20,
  full_text_weight double precision default 1.35,
  semantic_weight double precision default 1.0,
  rrf_k integer default 50,
  embedding_model_filter text default 'gte-small',
  include_google_drive boolean default false
)
returns table (
  title text,
  type text,
  category text,
  section text,
  content text,
  source_url text,
  source_provider text,
  updated_at timestamptz,
  retrieval_source text
)
language sql
stable
set search_path = public, extensions
as $$
  with params as (
    select
      websearch_to_tsquery('english', left(coalesce(query_text, ''), 180)) as q,
      query_embedding_text::extensions.vector(384) as e,
      least(greatest(coalesce(match_count, 3), 1), 8) as final_limit,
      least(greatest(coalesce(fts_candidate_count, 20), 1), 40) as fts_limit,
      least(greatest(coalesce(semantic_candidate_count, 20), 1), 40) as semantic_limit,
      greatest(coalesce(full_text_weight, 1.35), 0.0) as fts_w,
      greatest(coalesce(semantic_weight, 1.0), 0.0) as sem_w,
      greatest(coalesce(rrf_k, 50), 1) as k,
      coalesce(embedding_model_filter, 'gte-small') as model
  ),
  full_text as (
    select
      chunk.id,
      row_number() over(order by ts_rank_cd(chunk.search_vector, params.q) desc, item.updated_at desc, chunk.chunk_index asc) as rank_ix
    from params, public.knowledge_chunks chunk
    join public.knowledge_items item on item.id = chunk.knowledge_item_id
    where chunk.user_id = auth.uid()
      and item.user_id = auth.uid()
      and item.status = 'active'
      and (include_google_drive or item.source_provider <> 'google_drive')
      and chunk.search_vector @@ params.q
    limit (select fts_limit from params)
  ),
  semantic as (
    select
      chunk.id,
      row_number() over(order by chunk.embedding <#> params.e) as rank_ix
    from params, public.knowledge_chunks chunk
    join public.knowledge_items item on item.id = chunk.knowledge_item_id
    where chunk.user_id = auth.uid()
      and item.user_id = auth.uid()
      and item.status = 'active'
      and (include_google_drive or item.source_provider <> 'google_drive')
      and chunk.embedding_model = params.model
      and chunk.embedding is not null
    limit (select semantic_limit from params)
  ),
  fused as (
    select
      coalesce(full_text.id, semantic.id) as id,
      full_text.rank_ix as fts_rank,
      semantic.rank_ix as semantic_rank,
      coalesce(1.0 / ((select k from params) + full_text.rank_ix), 0.0) * (select fts_w from params)
        + coalesce(1.0 / ((select k from params) + semantic.rank_ix), 0.0) * (select sem_w from params) as score
    from full_text
    full outer join semantic on semantic.id = full_text.id
  )
  select
    item.title,
    item.type,
    item.category,
    chunk.section,
    chunk.content,
    item.source_url,
    item.source_provider,
    item.updated_at,
    case
      when fused.fts_rank is not null and fused.semantic_rank is not null then 'hybrid'
      when fused.semantic_rank is not null then 'semantic'
      else 'fts'
    end as retrieval_source
  from fused
  join public.knowledge_chunks chunk on chunk.id = fused.id
  join public.knowledge_items item on item.id = chunk.knowledge_item_id
  where chunk.user_id = auth.uid()
    and item.user_id = auth.uid()
    and item.status = 'active'
    and (include_google_drive or item.source_provider <> 'google_drive')
  order by fused.score desc, item.updated_at desc, chunk.chunk_index asc
  limit (select final_limit from params);
$$;

revoke all on function public.search_knowledge_chunks_fts(text, integer, integer, boolean) from public;
revoke all on function public.search_knowledge_chunks_hybrid(text, text, integer, integer, integer, double precision, double precision, integer, text, boolean) from public;
grant execute on function public.search_knowledge_chunks_fts(text, integer, integer, boolean) to authenticated;
grant execute on function public.search_knowledge_chunks_hybrid(text, text, integer, integer, integer, double precision, double precision, integer, text, boolean) to authenticated;

COMMIT;

comment on column public.nextron_context_preferences.allow_drive is
  'Allows NEXTRON to use explicitly imported Google Drive Knowledge sources. Defaults false and never grants whole-Drive access.';

comment on table public.google_drive_connections is
  'Owner-scoped Google Drive drive.file OAuth connection state. Tokens are encrypted server-side and are never browser-readable.';

comment on table public.google_drive_imports is
  'Owner-scoped provenance for Google Drive files explicitly selected through Picker and imported into Knowledge v2.';
