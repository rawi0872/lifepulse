-- Life Pulse Finance Module Migration
-- Adds personal finance tracking tables

-- 1. FINANCE ACCOUNTS
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  type text not null default 'cash' check (type in ('cash', 'bank', 'card', 'savings', 'investment', 'other')),
  starting_balance numeric(12,2) not null default 0,
  currency text not null default 'ILS' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. FINANCE CATEGORIES
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  type text not null check (type in ('income', 'expense')),
  color text,
  icon text check (length(icon) <= 50),
  created_at timestamptz not null default now()
);

-- 3. FINANCE TRANSACTIONS
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.finance_accounts(id) on delete set null,
  category_id uuid references public.finance_categories(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  title text not null check (length(trim(title)) between 1 and 160),
  note text check (length(note) <= 1000),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. FINANCE BUDGETS
create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. INDEXES
create index if not exists idx_finance_accounts_user on public.finance_accounts(user_id);
create index if not exists idx_finance_categories_user on public.finance_categories(user_id);
create index if not exists idx_finance_transactions_user_date on public.finance_transactions(user_id, transaction_date);
create index if not exists idx_finance_transactions_category on public.finance_transactions(user_id, category_id);
create index if not exists idx_finance_budgets_user_month on public.finance_budgets(user_id, month);

create unique index if not exists idx_finance_categories_user_type_name_lower
  on public.finance_categories(user_id, type, lower(name));

-- 6. ROW LEVEL SECURITY
alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_budgets enable row level security;

-- 7. FK OWNERSHIP HELPERS
create or replace function public.finance_account_belongs_to_user(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.finance_accounts where id = account_id and user_id = auth.uid());
$$;

create or replace function public.finance_category_belongs_to_user_and_type(category_id uuid, expected_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.finance_categories
    where id = category_id and user_id = auth.uid() and type = expected_type
  );
$$;

-- 8. POLICIES: FINANCE ACCOUNTS
drop policy if exists "finance_accounts_select_own" on public.finance_accounts;
create policy "finance_accounts_select_own" on public.finance_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "finance_accounts_insert_own" on public.finance_accounts;
create policy "finance_accounts_insert_own" on public.finance_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "finance_accounts_update_own" on public.finance_accounts;
create policy "finance_accounts_update_own" on public.finance_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_accounts_delete_own" on public.finance_accounts;
create policy "finance_accounts_delete_own" on public.finance_accounts
  for delete using (auth.uid() = user_id);

-- 9. POLICIES: FINANCE CATEGORIES
drop policy if exists "finance_categories_select_own" on public.finance_categories;
create policy "finance_categories_select_own" on public.finance_categories
  for select using (auth.uid() = user_id);

drop policy if exists "finance_categories_insert_own" on public.finance_categories;
create policy "finance_categories_insert_own" on public.finance_categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "finance_categories_update_own" on public.finance_categories;
create policy "finance_categories_update_own" on public.finance_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_categories_delete_own" on public.finance_categories;
create policy "finance_categories_delete_own" on public.finance_categories
  for delete using (auth.uid() = user_id);

-- 10. POLICIES: FINANCE TRANSACTIONS
drop policy if exists "finance_transactions_select_own" on public.finance_transactions;
create policy "finance_transactions_select_own" on public.finance_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "finance_transactions_insert_own" on public.finance_transactions;
create policy "finance_transactions_insert_own" on public.finance_transactions
  for insert with check (
    auth.uid() = user_id
    and (account_id is null or public.finance_account_belongs_to_user(account_id))
    and (category_id is null or public.finance_category_belongs_to_user_and_type(category_id, type))
  );

drop policy if exists "finance_transactions_update_own" on public.finance_transactions;
create policy "finance_transactions_update_own" on public.finance_transactions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (account_id is null or public.finance_account_belongs_to_user(account_id))
    and (category_id is null or public.finance_category_belongs_to_user_and_type(category_id, type))
  );

drop policy if exists "finance_transactions_delete_own" on public.finance_transactions;
create policy "finance_transactions_delete_own" on public.finance_transactions
  for delete using (auth.uid() = user_id);

-- 11. POLICIES: FINANCE BUDGETS
drop policy if exists "finance_budgets_select_own" on public.finance_budgets;
create policy "finance_budgets_select_own" on public.finance_budgets
  for select using (auth.uid() = user_id);

drop policy if exists "finance_budgets_insert_own" on public.finance_budgets;
create policy "finance_budgets_insert_own" on public.finance_budgets
  for insert with check (
    auth.uid() = user_id
    and public.finance_category_belongs_to_user_and_type(category_id, 'expense')
  );

drop policy if exists "finance_budgets_update_own" on public.finance_budgets;
create policy "finance_budgets_update_own" on public.finance_budgets
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.finance_category_belongs_to_user_and_type(category_id, 'expense')
  );

drop policy if exists "finance_budgets_delete_own" on public.finance_budgets;
create policy "finance_budgets_delete_own" on public.finance_budgets
  for delete using (auth.uid() = user_id);

-- 12. UPDATED_AT TRIGGERS
drop trigger if exists on_finance_accounts_updated on public.finance_accounts;
create trigger on_finance_accounts_updated
  before update on public.finance_accounts
  for each row execute function public.handle_updated_at();

drop trigger if exists on_finance_transactions_updated on public.finance_transactions;
create trigger on_finance_transactions_updated
  before update on public.finance_transactions
  for each row execute function public.handle_updated_at();

drop trigger if exists on_finance_budgets_updated on public.finance_budgets;
create trigger on_finance_budgets_updated
  before update on public.finance_budgets
  for each row execute function public.handle_updated_at();
