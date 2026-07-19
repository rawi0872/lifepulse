# Finance v2 — Real-Life Personal Finance Design

## Purpose
A serious manual personal-finance system supporting multi-account, multi-currency, personal/business classification, recurring transactions, transfers, and exact balances — with no bank connections, no advice, and no silent conversions.

---

## 1. Current State Audit

### What Exists (`00007_finance.sql`, `src/components/finance/types.ts`)
| Table | Key Fields | Gaps |
|-------|------------|------|
| `finance_accounts` | name, type (cash/bank/card/savings/investment/other), starting_balance, currency (ISO-3) | No opening balance date, no archived state, no account-level currency override |
| `finance_categories` | name, type (income/expense), color, icon | No parent/subcategory, no merchant mapping |
| `finance_transactions` | account_id, category_id, amount, type, title, note, transaction_date | No transfer type, no source/merchant, no recurring flag, no personal/business, no original currency/rate, no linked project/client |
| `finance_budgets` | category_id, month (first day), amount | No rollover, no alerts, no category groups |

### What Is Too Shallow
- **Single currency only** — `currency` on account but transactions have no currency field; conversion is implicit
- **No transfers** — Moving money between own accounts requires two offsetting transactions (double-counts in reports)
- **No recurring** — Manual re-entry each period
- **No merchant/source** — Can't track "Starbucks" vs "Salary from Acme Corp"
- **No personal/business split** — All mixed; no tax-ready classification
- **Exact balances only via full-history read** — No snapshot/RPC; `test:prod:network-audit` shows unbounded `finance_transactions` read
- **Charts** — Monthly trend only; no cash flow, no currency exposure, no recurring cost view

### Overlap with Results System
- Finance transactions → `metric_entries` adapter for "Net Worth", "Savings Rate", "Monthly Cash Flow"
- Recurring transactions → measurement schedule
- Account balances → baselines/targets

### Must Remain Backward-Compatible
- Existing `finance_accounts`, `finance_categories`, `finance_transactions`, `finance_budgets` tables unchanged
- Existing RLS policies unchanged
- Existing API routes and UI components unchanged
- Migration: new tables + adapters; legacy tables stay

### Major Risks
| Risk | Mitigation |
|------|------------|
| Double-counting transfers in reports | `transfer` type excluded from income/expense aggregates; separate transfer view |
| Silent currency conversion | Store original amount + currency + rate; reporting currency is a *display preference* only |
| Floating-point money | `numeric(12,2)` everywhere; never `float`/`real` |
| Category hierarchy breaking budgets | Budgets point to leaf categories; parent categories are UI-only groupings |
| Breaking exact balance meaning | New `account_balances` snapshot table is *derived*, not authoritative; fallback to full-history sum |

---

## 2. Data Model — New Tables

### `finance_accounts` (Extended)
```sql
alter table public.finance_accounts add column if not exists archived boolean not null default false;
alter table public.finance_accounts add column if not exists opening_balance_date date not null default current_date;
alter table public.finance_accounts add column if not exists institution text;  -- e.g., "Chase", "Revolut"
alter table public.finance_accounts add column if not exists last_synced_at timestamptz;  -- future: manual CSV import timestamp
```

### `finance_income_sources` — Where money comes from
```sql
create table public.finance_income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  type text not null check (type in ('salary', 'freelance', 'business', 'product_sales', 'rental', 'investments', 'gifts', 'other')),
  is_recurring boolean not null default false,
  expected_amount numeric(12,2),
  expected_currency text check (expected_currency ~ '^[A-Z]{3}$'),
  expected_frequency text check (expected_frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  expected_day_of_month integer check (expected_day_of_month between 1 and 31),
  is_business boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
```

### `finance_merchants` — Where money goes (expense sources)
```sql
create table public.finance_merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  category_id uuid references public.finance_categories(id) on delete set null,
  is_recurring boolean not null default false,
  default_amount numeric(12,2),
  default_currency text check (default_currency ~ '^[A-Z]{3}$'),
  is_business boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
```

### `finance_transactions` (Extended)
```sql
alter table public.finance_transactions add column if not exists transaction_type text not null default 'regular' check (transaction_type in ('regular', 'transfer', 'recurring_income', 'recurring_expense'));
alter table public.finance_transactions add column if not exists original_amount numeric(12,2);
alter table public.finance_transactions add column if not exists original_currency text check (original_currency ~ '^[A-Z]{3}$');
alter table public.finance_transactions add column if not exists conversion_rate numeric(10,6);
alter table public.finance_transactions add column if not exists conversion_date date;
alter table public.finance_transactions add column if not exists source_id uuid references public.finance_income_sources(id) on delete set null;
alter table public.finance_transactions add column if not exists merchant_id uuid references public.finance_merchants(id) on delete set null;
alter table public.finance_transactions add column if not exists is_business boolean not null default false;
alter table public.finance_transactions add column if not exists linked_project_id uuid references public.projects(id) on delete set null;
alter table public.finance_transactions add column if not exists linked_client_id uuid;  -- future: clients table
alter table public.finance_transactions add column if not exists recurring_group_id uuid;  -- groups recurring instances
alter table public.finance_transactions add column if not exists transfer_pair_id uuid;    -- links two sides of a transfer
```

**Transfer semantics:**
- Two rows: one `expense` (outgoing account), one `income` (incoming account)
- Both have `transaction_type = 'transfer'` and same `transfer_pair_id`
- Excluded from income/expense totals; shown in dedicated "Transfers" view
- Net worth unchanged

### `finance_recurring_rules` — Template for recurring transactions
```sql
create table public.finance_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  category_id uuid references public.finance_categories(id) on delete set null,
  source_id uuid references public.finance_income_sources(id) on delete set null,
  merchant_id uuid references public.finance_merchants(id) on delete set null,
  title text not null,
  note text,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  day_of_month integer check (day_of_month between 1 and 31),
  day_of_week integer check (day_of_week between 0 and 6),  -- for weekly
  start_date date not null default current_date,
  end_date date,
  is_business boolean not null default false,
  next_generation_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Generation:** Background job (or manual "Generate Now" button) creates `finance_transactions` with `transaction_type = 'recurring_income'|'recurring_expense'`, `recurring_group_id = rule.id`, and updates `next_generation_date`.

### `finance_reporting_currency` — User preference
```sql
create table public.finance_reporting_currency (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);
```

### `account_balances_snapshot` — Exact balance cache (derived, not authoritative)
```sql
create table public.account_balances_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  snapshot_date date not null default current_date,
  balance_original_currency numeric(14,2) not null,
  balance_reporting_currency numeric(14,2),  -- converted using rate on snapshot_date
  conversion_rate numeric(10,6),
  conversion_date date,
  is_authoritative boolean not null default false,  -- true only for manual reconciliation snapshots
  created_at timestamptz not null default now(),
  unique(account_id, snapshot_date)
);
```

**Reconciliation:** User can mark a snapshot as "authoritative" (reconciled to statement). Future balance calculations anchor from the latest authoritative snapshot + subsequent transactions.

---

## 3. Multi-Currency Design

### Principles
1. **Original amount + currency never rewritten** — `amount` + `currency` on transaction is immutable
2. **Conversion is a display concern** — Reporting currency is a user preference; conversion rate stored per-transaction
3. **No external FX API in v1** — User enters rate manually; future phase can add provider with audit trail
4. **Transfers preserve original currencies** — Each side keeps its account's currency; no cross-currency transfer in v1

### Transaction Storage
| Field | Purpose |
|-------|---------|
| `amount` | Amount in *account's currency* (for single-currency accounts) or *transaction currency* |
| `currency` | ISO-3 of `amount` |
| `original_amount` | If user entered in different currency (e.g., paid EUR with USD card) |
| `original_currency` | Currency of `original_amount` |
| `conversion_rate` | Rate used: `amount = original_amount × rate` |
| `conversion_date` | Date rate was captured |

### Reporting
- **Reporting currency** (user setting): All aggregates converted to this currency
- **Conversion rate for reporting**: Latest available rate on or before the report date (manual entry or transaction date)
- **Displayed as**: `€1,234.56 (≈ $1,340.22 @ 1.0857)` — original always visible

### Edge Cases
| Case | Handling |
|------|----------|
| No rate for currency/date | Show original only; flag "rate missing" in UI |
| Rate changes retroactively | Historical transactions keep original rate; only *new* conversions use new rate |
| Account currency differs from transaction | Allowed (multi-currency account); balance sums per-currency |
| Transfer between different-currency accounts | Not supported in v1; user creates two transactions manually |

---

## 4. Finance Calculations

### Exact Values (Authoritative)
| Value | Source |
|-------|--------|
| Account balance (original currency) | `starting_balance + sum(income) - sum(expense) + sum(transfers_in) - sum(transfers_out)` over all transactions for that account |
| Net worth (original currencies) | Sum of account balances per currency |
| Total income (period, original currencies) | Sum of `income` + `recurring_income` transactions |
| Total expenses (period, original currencies) | Sum of `expense` + `recurring_expense` (excludes `transfer`) |
| Net cash flow | Income - Expenses |

### Converted Estimates (Display Only)
| Value | Method |
|-------|--------|
| Account balance (reporting currency) | `balance_original × rate_on_report_date` |
| Net worth (reporting currency) | Sum of converted account balances |
| Monthly cash flow (reporting currency) | Each transaction converted at its `conversion_rate` or report-date rate |

**Always label**: "Converted amounts are estimates based on recorded rates."

### Recurring Transactions
- Generated transactions are **real rows** in `finance_transactions` with `transaction_type = 'recurring_income'|'recurring_expense'`
- Included in all totals by default
- `recurring_group_id` allows bulk edit/delete
- User can "skip" an instance (sets `status = 'skipped'` — new column)

---

## 5. Useful Views

| View | Key Metrics |
|------|-------------|
| **Money In vs Out** | Bar chart: income vs expense per month (reporting currency) |
| **Net Cash Flow** | Line: cumulative net per month |
| **Income by Source** | Pie: salary / freelance / business / rental / gifts / other |
| **Expenses by Category** | Pie + drill-down to merchant |
| **Recurring Costs** | Table: rule, amount, frequency, next date, annualized |
| **Account Balances** | Cards: each account, original + converted, last reconciled |
| **Currency Exposure** | Stacked bar: net worth by currency |
| **Personal vs Business** | Split: income/expense/net by classification |
| **Month-over-Month** | Comparison table with Δ and %Δ |

---

## 6. Safety & Compliance

| Rule | Enforcement |
|------|-------------|
| No investment advice | No "you should invest", no portfolio optimization |
| No tax advice | No tax calculations, no deduction suggestions |
| No debt advice | No "pay off high-interest first", no consolidation suggestions |
| No "spending is bad" language | Neutral: "You spent $X on dining" not "You overspent" |
| No bank connection | Manual entry only; CSV import future |
| No silent conversion | Every converted value shows original + rate |
| Exact balances preserved | Full-history sum always available; snapshot is cache |

---

## 7. Migration Strategy

| Phase | Action |
|-------|--------|
| 0 | Add new tables (`income_sources`, `merchants`, `recurring_rules`, `reporting_currency`, `account_balances_snapshot`) + extend `finance_transactions` columns |
| 1 | UI: Income Sources & Merchants CRUD |
| 2 | UI: Transaction type = Transfer (two-row creator) |
| 3 | UI: Recurring Rules + "Generate Now" |
| 4 | UI: Reporting Currency selector + conversion display |
| 5 | UI: Manual Reconciliation (authoritative snapshot) |
| 6 | Views: Currency Exposure, Personal/Business split, Recurring Costs |
| 7 | Adapter: Finance → Results System (`metric_entries` for Net Worth, Savings Rate, Cash Flow) |
| 8+ | Optional: CSV import, external FX rate provider (with audit), budget rollover |

**No data migration required** — existing transactions work as-is (treated as `transaction_type='regular'`, single currency).

---

## 8. Acceptance Criteria (Phase 1-3)

- [ ] Create transfer between two accounts → two linked rows, excluded from income/expense totals
- [ ] Set reporting currency to USD → all aggregates show `≈ $X` alongside original
- [ ] Create recurring monthly salary rule → "Generate Now" creates transaction, updates next date
- [ ] Account balance card shows original currency + converted estimate + "rate missing" badge if applicable
- [ ] All existing tests pass; no changes to `finance_accounts`/`categories`/`transactions`/`budgets` RLS
- [ ] Network audit: `/finance` still ≤ 5 REST requests (new tables only on demand)

---

## 9. Open Questions

1. **Subcategories**: Add `parent_category_id` to `finance_categories` for grouping (e.g., "Transport → Fuel", "Transport → Transit")?
2. **Tags on transactions**: Free-form tags for cross-category filtering (e.g., "#vacation", "#tax-deductible")?
3. **Reconciliation workflow**: Statement date + ending balance → mark transactions "cleared" → authoritative snapshot?
4. **Business expense tracking**: Link to `projects` + `clients` (future) for profit/loss per project?
5. **Multi-user / shared accounts**: Out of scope for v1 (single-user per account)