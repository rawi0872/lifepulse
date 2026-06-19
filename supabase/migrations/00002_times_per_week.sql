-- Add times_per_week support
alter table public.habits add column if not exists times_per_week integer;

-- Update frequency check constraint to include times_per_week
alter table public.habits drop constraint if exists habits_frequency_check;
alter table public.habits add constraint habits_frequency_check
  check (frequency in ('daily', 'weekdays', 'weekends', 'weekly', 'times_per_week'));
