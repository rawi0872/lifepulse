-- Life Pulse Results Foundation Migration (Phase 1)
-- Creates metric_definitions and metric_entries tables with full RLS
-- Version: 0018
-- Tables: metric_definitions, metric_entries

-- ============================================
-- metric_definitions — What can be measured
-- ============================================
create table if not exists public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in (
    'body','mind','finance','business','learning','skills','passions','goals','custom'
  )),
  name text not null check (length(trim(name)) between 1 and 80),
  description text,
  value_kind text not null check (value_kind in (
    'number','count','percentage','duration','currency','rating'
  )),
  unit text not null check (length(trim(unit)) between 1 and 20),
  baseline_value numeric(20,6),
  target_value numeric(20,6),
  target_direction text check (target_direction in (
    'increase','decrease','maintain','none'
  )) default 'none',
  cadence text check (cadence in (
    'daily','weekly','monthly','quarterly','yearly','custom','none'
  )) default 'none',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, domain, name),
  unique(id, user_id)
);

-- System templates are static TypeScript config (src/lib/results/templates.ts).
-- No template rows in the database.

-- ============================================
-- metric_entries — Recorded measurements
-- ============================================
create table if not exists public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_definition_id uuid not null references public.metric_definitions(id) on delete cascade,
  value numeric(20,6) not null,
  recorded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  -- Composite FK prevents cross-user entry insertion
  foreign key (metric_definition_id, user_id)
    references public.metric_definitions(id, user_id) on delete cascade
);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_metric_definitions_user_domain
  on public.metric_definitions(user_id, domain);

create index if not exists idx_metric_entries_user_recorded
  on public.metric_entries(user_id, recorded_at desc);

create index if not exists idx_metric_entries_definition
  on public.metric_entries(metric_definition_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.metric_definitions enable row level security;
alter table public.metric_entries enable row level security;

-- ============================================
-- RLS POLICIES: metric_definitions
-- ============================================
drop policy if exists "metric_definitions_select_own" on public.metric_definitions;
create policy "metric_definitions_select_own" on public.metric_definitions
  for select using (auth.uid() = user_id);

drop policy if exists "metric_definitions_insert_own" on public.metric_definitions;
create policy "metric_definitions_insert_own" on public.metric_definitions
  for insert with check (auth.uid() = user_id);

drop policy if exists "metric_definitions_update_own" on public.metric_definitions;
create policy "metric_definitions_update_own" on public.metric_definitions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "metric_definitions_delete_own" on public.metric_definitions;
create policy "metric_definitions_delete_own" on public.metric_definitions
  for delete using (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: metric_entries
-- ============================================
-- SELECT: owner only
drop policy if exists "metric_entries_select_own" on public.metric_entries;
create policy "metric_entries_select_own" on public.metric_entries
  for select using (auth.uid() = user_id);

-- INSERT: owner only + composite FK ensures definition belongs to same user
drop policy if exists "metric_entries_insert_own" on public.metric_entries;
create policy "metric_entries_insert_own" on public.metric_entries
  for insert with check (auth.uid() = user_id);

-- UPDATE: owner only
drop policy if exists "metric_entries_update_own" on public.metric_entries;
create policy "metric_entries_update_own" on public.metric_entries
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: owner only
drop policy if exists "metric_entries_delete_own" on public.metric_entries;
create policy "metric_entries_delete_own" on public.metric_entries
  for delete using (auth.uid() = user_id);

-- ============================================
-- ARCHIVED DEFINITION WRITE PROTECTION
-- ============================================
-- Prevent INSERT/UPDATE on entries when parent definition is archived.
-- Application layer also enforces, but database guard is the source of truth.
create or replace function public.metric_definition_is_archived(def_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select archived from public.metric_definitions where id = def_id;
$$;

drop policy if exists "metric_entries_insert_own" on public.metric_entries;
create policy "metric_entries_insert_own" on public.metric_entries
  for insert with check (
    auth.uid() = user_id
    and not public.metric_definition_is_archived(metric_definition_id)
  );

drop policy if exists "metric_entries_update_own" on public.metric_entries;
create policy "metric_entries_update_own" on public.metric_entries
  for update using (
    auth.uid() = user_id
    and not public.metric_definition_is_archived(metric_definition_id)
  )
  with check (
    auth.uid() = user_id
    and not public.metric_definition_is_archived(metric_definition_id)
  );

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
drop trigger if exists on_metric_definitions_updated on public.metric_definitions;
create trigger on_metric_definitions_updated
  before update on public.metric_definitions
  for each row execute function public.handle_updated_at();

-- metric_entries has no updated_at (immutable after insert)

-- ============================================
-- GRANTS
-- ============================================
grant select, insert, update, delete on public.metric_definitions to authenticated;
grant select, insert, update, delete on public.metric_entries to authenticated;

-- ============================================
-- COMMENTS
-- ============================================
comment on table public.metric_definitions is
  'User-defined measurable metrics. Baseline and optional target live on the definition row.';

comment on table public.metric_entries is
  'Recorded measurements. Immutable after insert (no updated_at). Composite FK enforces same-user ownership.';

comment on column public.metric_definitions.baseline_value is
  'Optional starting value for progress calculations. numeric(20,6) for universal precision.';

comment on column public.metric_definitions.target_value is
  'Optional target value. Meaning depends on target_direction.';

comment on column public.metric_definitions.target_direction is
  'increase=higher is progress, decrease=lower is progress, maintain=stay near target, none=no target logic.';

comment on column public.metric_definitions.cadence is
  'Suggested recording frequency. UI hint only, not enforced.';

comment on column public.metric_definitions.archived is
  'Soft archive. Hides from default list view. Entries remain readable. New entries blocked by RLS.';

comment on column public.metric_entries.value is
  'Stored in definition''s unit. numeric(20,6) universal precision for all value_kinds.';

comment on column public.metric_entries.recorded_at is
  'Measurement timestamp (date + time). Used for chronological ordering.';

comment on constraint metric_entries_metric_definition_id_user_id_fkey on public.metric_entries is
  'Composite FK to metric_definitions(id, user_id). Prevents cross-user entry insertion and cascades delete.';

comment on function public.metric_definition_is_archived(uuid) is
  'Returns true if the definition is archived. Used by RLS to block writes to archived definitions.';