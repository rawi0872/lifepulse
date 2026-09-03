-- Wealth Realm V1 — financial awareness foundation (manual-first, integer minor units)
-- No Plaid/banking integration, no credentials, integer money only.

-- 1. WEALTH ACCOUNTS
create table if not exists public.wealth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  realm_id uuid not null references public.realms(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  account_type text not null check (account_type in ('checking','savings','cash','investment','credit_card','loan','asset','liability','other')),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  current_balance_minor bigint not null default 0, -- integer minor units, no float
  institution_name text check (length(institution_name) <= 120),
  is_archived boolean not null default false,
  source_type text not null default 'manual' check (source_type in ('manual','import','external')),
  external_provider text check (length(external_provider) <= 40),
  external_account_id text check (length(external_account_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wealth_accounts_user on public.wealth_accounts(user_id);
create index if not exists idx_wealth_accounts_realm on public.wealth_accounts(realm_id);

-- 2. WEALTH TRANSACTIONS
create table if not exists public.wealth_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.wealth_accounts(id) on delete set null,
  transaction_type text not null check (transaction_type in ('income','expense','transfer','adjustment')),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  category text not null check (category in ('income','housing','food','transport','health','education','entertainment','shopping','subscriptions','debt','savings','investments','other')),
  description text check (length(description) <= 200),
  transaction_date date not null default current_date,
  linked_transaction_id uuid references public.wealth_transactions(id) on delete set null,
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wealth_transactions_user_date on public.wealth_transactions(user_id, transaction_date);
create index if not exists idx_wealth_transactions_account on public.wealth_transactions(account_id);
create index if not exists idx_wealth_transactions_category on public.wealth_transactions(category);

-- 3. WEALTH RECURRING ITEMS
create table if not exists public.wealth_recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  realm_id uuid not null references public.realms(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null check (kind in ('income','bill','subscription','debt_payment','savings','investment','other')),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  next_due_date date not null,
  account_id uuid references public.wealth_accounts(id) on delete set null,
  category text check (category in ('income','housing','food','transport','health','education','entertainment','shopping','subscriptions','debt','savings','investments','other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wealth_recurring_user_next on public.wealth_recurring_items(user_id, next_due_date) where is_active;
create index if not exists idx_wealth_recurring_realm on public.wealth_recurring_items(realm_id);

-- 4. WEALTH PREFERENCES (privacy + base currency)
create table if not exists public.wealth_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'ILS' check (base_currency ~ '^[A-Z]{3}$'),
  nextron_access_enabled boolean not null default false,
  nextron_allowed_sections text[] not null default '{}' check (nextron_allowed_sections <@ array['balances','cash_flow','transactions_summary','recurring_items','wealth_goals']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.wealth_accounts enable row level security;
alter table public.wealth_transactions enable row level security;
alter table public.wealth_recurring_items enable row level security;
alter table public.wealth_preferences enable row level security;

drop policy if exists "wealth_accounts_select_own" on public.wealth_accounts;
create policy "wealth_accounts_select_own" on public.wealth_accounts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "wealth_accounts_insert_own" on public.wealth_accounts;
create policy "wealth_accounts_insert_own" on public.wealth_accounts for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.realms where id = realm_id and user_id = auth.uid()));
drop policy if exists "wealth_accounts_update_own" on public.wealth_accounts;
create policy "wealth_accounts_update_own" on public.wealth_accounts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wealth_accounts_delete_own" on public.wealth_accounts;
create policy "wealth_accounts_delete_own" on public.wealth_accounts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "wealth_transactions_select_own" on public.wealth_transactions;
create policy "wealth_transactions_select_own" on public.wealth_transactions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "wealth_transactions_insert_own" on public.wealth_transactions;
create policy "wealth_transactions_insert_own" on public.wealth_transactions for insert to authenticated with check (auth.uid() = user_id and (account_id is null or exists (select 1 from public.wealth_accounts where id = account_id and user_id = auth.uid())));
drop policy if exists "wealth_transactions_update_own" on public.wealth_transactions;
create policy "wealth_transactions_update_own" on public.wealth_transactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wealth_transactions_delete_own" on public.wealth_transactions;
create policy "wealth_transactions_delete_own" on public.wealth_transactions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "wealth_recurring_select_own" on public.wealth_recurring_items;
create policy "wealth_recurring_select_own" on public.wealth_recurring_items for select to authenticated using (auth.uid() = user_id);
drop policy if exists "wealth_recurring_insert_own" on public.wealth_recurring_items;
create policy "wealth_recurring_insert_own" on public.wealth_recurring_items for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.realms where id = realm_id and user_id = auth.uid()));
drop policy if exists "wealth_recurring_update_own" on public.wealth_recurring_items;
create policy "wealth_recurring_update_own" on public.wealth_recurring_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wealth_recurring_delete_own" on public.wealth_recurring_items;
create policy "wealth_recurring_delete_own" on public.wealth_recurring_items for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "wealth_preferences_select_own" on public.wealth_preferences;
create policy "wealth_preferences_select_own" on public.wealth_preferences for select to authenticated using (auth.uid() = user_id);
drop policy if exists "wealth_preferences_upsert_own" on public.wealth_preferences;
create policy "wealth_preferences_upsert_own" on public.wealth_preferences for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "wealth_preferences_update_own" on public.wealth_preferences;
create policy "wealth_preferences_update_own" on public.wealth_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at triggers
drop trigger if exists on_wealth_accounts_updated on public.wealth_accounts;
create trigger on_wealth_accounts_updated before update on public.wealth_accounts for each row execute function public.handle_updated_at();
drop trigger if exists on_wealth_transactions_updated on public.wealth_transactions;
create trigger on_wealth_transactions_updated before update on public.wealth_transactions for each row execute function public.handle_updated_at();
drop trigger if exists on_wealth_recurring_updated on public.wealth_recurring_items;
create trigger on_wealth_recurring_updated before update on public.wealth_recurring_items for each row execute function public.handle_updated_at();
drop trigger if exists on_wealth_preferences_updated on public.wealth_preferences;
create trigger on_wealth_preferences_updated before update on public.wealth_preferences for each row execute function public.handle_updated_at();
