-- Finance Budget Currency — additive schema extension
-- finance_budgets historically lacked a persisted currency; this adds an
-- explicit nullable currency column with no destructive backfill.
-- Existing rows remain currency = NULL (truth preserved) until user sets it.

alter table public.finance_budgets
  add column if not exists currency text;

do $$ begin
  alter table public.finance_budgets
    drop constraint if exists finance_budgets_currency_check;
  alter table public.finance_budgets
    add constraint finance_budgets_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$');
exception when duplicate_object then null; end $$;

comment on column public.finance_budgets.currency is
  'Explicit budget currency (ISO 4217). NULL = legacy row whose currency was never recorded; must not be compared to transactions until set by user.';