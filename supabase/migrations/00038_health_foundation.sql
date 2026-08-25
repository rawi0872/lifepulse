-- Life Pulse Health Foundation — normalized provider-neutral health persistence
-- Core V1 only: sleep_duration, steps, active_minutes, exercise_minutes, resting_heart_rate, weight

-- 1. health_preferences — Life Pulse storage consent (explicit, separate from OS and NEXTRON)
create table if not exists public.health_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allowed_metrics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_preferences_allowed_metrics_check check (
    allowed_metrics <@ array['sleep_duration','steps','active_minutes','exercise_minutes','resting_heart_rate','weight']::text[]
  )
);

alter table public.health_preferences enable row level security;
revoke all on table public.health_preferences from anon, public, authenticated;
grant select, insert, update, delete on table public.health_preferences to authenticated;

drop policy if exists health_preferences_select_own on public.health_preferences;
create policy health_preferences_select_own on public.health_preferences for select to authenticated using (auth.uid() = user_id);
drop policy if exists health_preferences_insert_own on public.health_preferences;
create policy health_preferences_insert_own on public.health_preferences for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists health_preferences_update_own on public.health_preferences;
create policy health_preferences_update_own on public.health_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists health_preferences_delete_own on public.health_preferences;
create policy health_preferences_delete_own on public.health_preferences for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists on_health_preferences_updated on public.health_preferences;
create trigger on_health_preferences_updated before update on public.health_preferences for each row execute function public.handle_updated_at();

-- 2. health_sources — per-provider connection (healthkit / health_connect only)
create table if not exists public.health_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('healthkit','health_connect')),
  status text not null default 'connected' check (status in ('connected','disconnected','revoked')),
  scopes_granted text[] not null default '{}',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider),
  unique(id, user_id)
);

alter table public.health_sources enable row level security;
revoke all on table public.health_sources from anon, public, authenticated;
grant select, insert, update, delete on table public.health_sources to authenticated;

drop policy if exists health_sources_select_own on public.health_sources;
create policy health_sources_select_own on public.health_sources for select to authenticated using (auth.uid() = user_id);
drop policy if exists health_sources_insert_own on public.health_sources;
create policy health_sources_insert_own on public.health_sources for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists health_sources_update_own on public.health_sources;
create policy health_sources_update_own on public.health_sources for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists health_sources_delete_own on public.health_sources;
create policy health_sources_delete_own on public.health_sources for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists on_health_sources_updated on public.health_sources;
create trigger on_health_sources_updated before update on public.health_sources for each row execute function public.handle_updated_at();

-- 3. helper for storage-consent DB enforcement (used in health_records RLS)
create or replace function public.is_health_metric_allowed(metric text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.health_preferences
    where user_id = auth.uid()
    and metric = any(allowed_metrics)
  );
$$;

-- 4. health_records — normalized, typed numeric, deduped, source-linked
create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  health_source_id uuid not null,
  dedupe_key text not null check (char_length(dedupe_key) > 0),
  metric_type text not null check (metric_type in ('sleep_duration','steps','active_minutes','exercise_minutes','resting_heart_rate','weight')),
  numeric_value double precision not null,
  unit text not null,
  recorded_at timestamptz not null,
  start_at timestamptz,
  end_at timestamptz,
  local_date date not null,
  synced_at timestamptz not null default now(),
  provenance jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- metric/unit compatibility
  constraint health_records_metric_unit_check check (
    (metric_type = 'sleep_duration' and unit = 'minutes') or
    (metric_type = 'steps' and unit = 'count') or
    (metric_type = 'active_minutes' and unit = 'minutes') or
    (metric_type = 'exercise_minutes' and unit = 'minutes') or
    (metric_type = 'resting_heart_rate' and unit = 'bpm') or
    (metric_type = 'weight' and unit = 'kg')
  ),
  -- numeric integrity: finite and sane (ingestion guard, not medical judgment)
  constraint health_records_numeric_finite_check check (
    numeric_value = numeric_value
    and numeric_value != 'Infinity'::double precision
    and numeric_value != '-Infinity'::double precision
  ),
  constraint health_records_numeric_sanity_check check (
    (metric_type = 'steps' and numeric_value >= 0) or
    (metric_type = 'sleep_duration' and numeric_value >= 0) or
    (metric_type = 'active_minutes' and numeric_value >= 0) or
    (metric_type = 'exercise_minutes' and numeric_value >= 0) or
    (metric_type = 'weight' and numeric_value > 0) or
    (metric_type = 'resting_heart_rate' and numeric_value > 0)
  ),
  -- sleep interval semantics
  constraint health_records_sleep_interval_check check (
    metric_type != 'sleep_duration' or (start_at is not null and end_at is not null and start_at <= end_at and recorded_at = end_at)
  ),
  constraint health_records_non_sleep_interval_check check (
    metric_type = 'sleep_duration' or (start_at is null and end_at is null)
  ),
  -- composite FK ensures record cannot reference another user's source
  constraint health_records_source_fk foreign key (health_source_id, user_id) references public.health_sources(id, user_id) on delete cascade,
  unique(user_id, health_source_id, dedupe_key)
);

alter table public.health_records enable row level security;
revoke all on table public.health_records from anon, public, authenticated;
grant select, insert, update, delete on table public.health_records to authenticated;

drop policy if exists health_records_select_own on public.health_records;
create policy health_records_select_own on public.health_records for select to authenticated using (auth.uid() = user_id);
drop policy if exists health_records_insert_own on public.health_records;
create policy health_records_insert_own on public.health_records for insert to authenticated with check (
  auth.uid() = user_id
  and public.is_health_metric_allowed(metric_type)
);
drop policy if exists health_records_update_own on public.health_records;
create policy health_records_update_own on public.health_records for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and public.is_health_metric_allowed(metric_type)
);
drop policy if exists health_records_delete_own on public.health_records;
create policy health_records_delete_own on public.health_records for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists on_health_records_updated on public.health_records;
create trigger on_health_records_updated before update on public.health_records for each row execute function public.handle_updated_at();

-- indexes
create index if not exists health_records_user_date_idx on public.health_records(user_id, local_date);
create index if not exists health_records_user_metric_idx on public.health_records(user_id, metric_type, recorded_at desc);
create index if not exists health_preferences_user_idx on public.health_preferences(user_id);
create index if not exists health_sources_user_idx on public.health_sources(user_id);
