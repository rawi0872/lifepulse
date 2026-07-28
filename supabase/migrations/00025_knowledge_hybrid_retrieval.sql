-- Life Pulse Knowledge v2 hybrid retrieval
-- Adds owner-scoped chunk storage, FTS, vector embeddings, and read-only RPC search.

BEGIN;

create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0 and chunk_index < 200),
  section text,
  content text not null check (char_length(content) between 1 and 1800),
  content_hash text not null check (char_length(content_hash) between 32 and 128),
  embedding_model text not null default 'gte-small' check (char_length(embedding_model) between 1 and 80),
  embedding extensions.vector(384),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(section, '') || ' ' || content)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (knowledge_item_id, chunk_index)
);

create index if not exists knowledge_chunks_user_item_idx
  on public.knowledge_chunks (user_id, knowledge_item_id, chunk_index);

create index if not exists knowledge_chunks_hash_idx
  on public.knowledge_chunks (knowledge_item_id, chunk_index, content_hash, embedding_model);

create index if not exists knowledge_chunks_fts_idx
  on public.knowledge_chunks using gin (search_vector);

alter table public.knowledge_chunks enable row level security;

drop policy if exists knowledge_chunks_select_own on public.knowledge_chunks;
create policy knowledge_chunks_select_own on public.knowledge_chunks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists knowledge_chunks_insert_own on public.knowledge_chunks;
create policy knowledge_chunks_insert_own on public.knowledge_chunks
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.knowledge_items item
      where item.id = knowledge_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists knowledge_chunks_update_own on public.knowledge_chunks;
create policy knowledge_chunks_update_own on public.knowledge_chunks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists knowledge_chunks_delete_own on public.knowledge_chunks;
create policy knowledge_chunks_delete_own on public.knowledge_chunks
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists on_knowledge_chunks_updated on public.knowledge_chunks;
create trigger on_knowledge_chunks_updated
  before update on public.knowledge_chunks
  for each row execute function public.handle_updated_at();

revoke all privileges on table public.knowledge_chunks from anon;
revoke all privileges on table public.knowledge_chunks from public;
revoke all privileges on table public.knowledge_chunks from authenticated;
grant select, insert, update, delete on table public.knowledge_chunks to authenticated;

create or replace function public.search_knowledge_chunks_fts(
  query_text text,
  match_count integer default 3,
  candidate_count integer default 20
)
returns table (
  title text,
  type text,
  category text,
  section text,
  content text,
  source_url text,
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
    item.updated_at,
    'fts'::text as retrieval_source
  from params, public.knowledge_chunks chunk
  join public.knowledge_items item on item.id = chunk.knowledge_item_id
  where chunk.user_id = auth.uid()
    and item.user_id = auth.uid()
    and item.status = 'active'
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
  embedding_model_filter text default 'gte-small'
)
returns table (
  title text,
  type text,
  category text,
  section text,
  content text,
  source_url text,
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
  order by fused.score desc, item.updated_at desc, chunk.chunk_index asc
  limit (select final_limit from params);
$$;

revoke all on function public.search_knowledge_chunks_fts(text, integer, integer) from public;
revoke all on function public.search_knowledge_chunks_hybrid(text, text, integer, integer, integer, double precision, double precision, integer, text) from public;
grant execute on function public.search_knowledge_chunks_fts(text, integer, integer) to authenticated;
grant execute on function public.search_knowledge_chunks_hybrid(text, text, integer, integer, integer, double precision, double precision, integer, text) to authenticated;

COMMIT;

comment on table public.knowledge_chunks is
  'Owner-scoped Knowledge v2 chunks for FTS and optional gte-small semantic retrieval. Normal application access uses authenticated RLS, not service role.';

comment on function public.search_knowledge_chunks_hybrid(text, text, integer, integer, integer, double precision, double precision, integer, text) is
  'Owner-filtered Knowledge hybrid search using FTS plus gte-small vector retrieval fused with Reciprocal Rank Fusion.';
