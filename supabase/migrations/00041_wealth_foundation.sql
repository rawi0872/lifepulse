-- Wealth Realm V1 — correct foundation: evolve existing finance_* as canonical system
-- Numeric(12,2) is exact decimal (not float); bigint minor-units alternative is also exact.
-- This migration EXTENDS finance_* in place to avoid a parallel wealth_* system and preserves existing rows.

-- 1. FINANCE ACCOUNTS — add Wealth-required columns, extend types
alter table public.finance_accounts add column if not exists realm_id uuid references public.realms(id) on delete set null;
alter table public.finance_accounts add column if not exists is_archived boolean not null default false;
alter table public.finance_accounts add column if not exists source_type text not null default 'manual' check (source_type in ('manual','import','external'));
alter table public.finance_accounts add column if not exists institution_name text check (length(institution_name) <= 120);
alter table public.finance_accounts add column if not exists external_provider text check (length(external_provider) <= 40);
alter table public.finance_accounts add column if not exists external_account_id text check (length(external_account_id) <= 200);

-- extend type check to include Wealth account types (keep existing cash,bank,card,savings,investment,other)
do $$ begin
  alter table public.finance_accounts drop constraint if exists finance_accounts_type_check;
  alter table public.finance_accounts add constraint finance_accounts_type_check
    check (type in ('cash','bank','card','savings','investment','other','checking','credit_card','loan','asset','liability'));
exception when duplicate_object then null; end $$;

create index if not exists idx_finance_accounts_realm on public.finance_accounts(realm_id);
create index if not exists idx_finance_accounts_archived on public.finance_accounts(user_id, is_archived) where not is_archived;

-- 2. FINANCE TRANSACTIONS — extend to support transfer/adjustment + linkage
do $$ begin
  alter table public.finance_transactions drop constraint if exists finance_transactions_type_check;
  alter table public.finance_transactions add constraint finance_transactions_type_check
    check (type in ('income','expense','transfer','adjustment'));
exception when duplicate_object then null; end $$;

alter table public.finance_transactions add column if not exists linked_transaction_id uuid references public.finance_transactions(id) on delete set null;

-- existing finance_transactions already has: account_id, category_id, amount numeric(12,2), currency, title, note, transaction_date
-- amount remains numeric(12,2) exact decimal — no bigint conversion, preserves existing data
-- categories remain canonical via finance_categories (user-defined) + finance_categories.type
-- transfer/adjustment must allow any category or null, so patch FK helper + RLS to not enforce strict type for those types
create or replace function public.finance_category_belongs_to_user(category_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.finance_categories where id = category_id and user_id = auth.uid());
$$;

-- 3. FINANCE RECURRING ITEMS — new canonical table (no prior recurring table existed)
create table if not exists public.finance_recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  realm_id uuid references public.realms(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null check (kind in ('income','bill','subscription','debt_payment','savings','investment','other')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  next_due_date date not null,
  account_id uuid references public.finance_accounts(id) on delete set null,
  category_id uuid references public.finance_categories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_finance_recurring_user_next on public.finance_recurring_items(user_id, next_due_date) where is_active;
create index if not exists idx_finance_recurring_realm on public.finance_recurring_items(realm_id);

-- 4. FINANCE PREFERENCES — Wealth privacy + base currency (canonical, replaces wealth_preferences)
create table if not exists public.finance_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'ILS' check (base_currency ~ '^[A-Z]{3}$'),
  nextron_access_enabled boolean not null default false,
  nextron_allowed_sections text[] not null default '{}' check (nextron_allowed_sections <@ array['balances','cash_flow','transactions_summary','recurring_items','wealth_goals']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- patch finance_transactions RLS to allow transfer/adjustment with any category (categories are income/expense only)
drop policy if exists "finance_transactions_insert_own" on public.finance_transactions;
create policy "finance_transactions_insert_own" on public.finance_transactions
  for insert with check (
    auth.uid() = user_id
    and (account_id is null or public.finance_account_belongs_to_user(account_id))
    and (
      category_id is null
      or public.finance_category_belongs_to_user(category_id)
      or public.finance_category_belongs_to_user_and_type(category_id, type)
    )
  );
drop policy if exists "finance_transactions_update_own" on public.finance_transactions;
create policy "finance_transactions_update_own" on public.finance_transactions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (account_id is null or public.finance_account_belongs_to_user(account_id))
    and (
      category_id is null
      or public.finance_category_belongs_to_user(category_id)
      or public.finance_category_belongs_to_user_and_type(category_id, type)
    )
  );

-- RLS for new/altered tables
alter table public.finance_recurring_items enable row level security;
alter table public.finance_preferences enable row level security;

drop policy if exists "finance_recurring_select_own" on public.finance_recurring_items;
create policy "finance_recurring_select_own" on public.finance_recurring_items for select to authenticated using (auth.uid() = user_id);
drop policy if exists "finance_recurring_insert_own" on public.finance_recurring_items;
create policy "finance_recurring_insert_own" on public.finance_recurring_items for insert to authenticated with check (auth.uid() = user_id and (realm_id is null or exists (select 1 from public.realms where id = realm_id and user_id = auth.uid())) and (account_id is null or exists (select 1 from public.finance_accounts where id = account_id and user_id = auth.uid())));
drop policy if exists "finance_recurring_update_own" on public.finance_recurring_items;
create policy "finance_recurring_update_own" on public.finance_recurring_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "finance_recurring_delete_own" on public.finance_recurring_items;
create policy "finance_recurring_delete_own" on public.finance_recurring_items for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_preferences_select_own" on public.finance_preferences;
create policy "finance_preferences_select_own" on public.finance_preferences for select to authenticated using (auth.uid() = user_id);
drop policy if exists "finance_preferences_upsert_own" on public.finance_preferences;
create policy "finance_preferences_upsert_own" on public.finance_preferences for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "finance_preferences_update_own" on public.finance_preferences;
create policy "finance_preferences_update_own" on public.finance_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at triggers
drop trigger if exists on_finance_recurring_updated on public.finance_recurring_items;
create trigger on_finance_recurring_updated before update on public.finance_recurring_items for each row execute function public.handle_updated_at();
drop trigger if exists on_finance_preferences_updated on public.finance_preferences;
create trigger on_finance_preferences_updated before update on public.finance_preferences for each row execute function public.handle_updated_at();

-- 5. GOALS — extend 00039 Body columns to be truly cross-domain (Wealth + Body)
-- 00039 already added goal_type, target_metric, target_value, target_unit, baseline_value as nullable with Body-only checks.
-- Now make them generic: add Wealth goal types/metrics
do $$ begin
  alter table public.goals drop constraint if exists goals_goal_type_check;
  alter table public.goals add constraint goals_goal_type_check check (goal_type in ('general','weight_target','steps_average','exercise_frequency','sleep_duration','weight_trend','savings_target','net_worth_target','debt_payoff','investment_contribution','emergency_fund'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.goals drop constraint if exists goals_target_metric_check;
  alter table public.goals add constraint goals_target_metric_check check (target_metric in ('steps','active_minutes','exercise_minutes','sleep_duration','resting_heart_rate','weight','exercise_sessions_per_week','savings_balance','net_worth','debt_balance','investment_contribution'));
exception when duplicate_object then null; end $$;

comment on column public.goals.goal_type is 'Cross-realm goal kind: Body (weight_target etc.) and Wealth (savings_target etc.)';
