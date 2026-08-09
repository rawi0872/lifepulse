-- NEXTRON Conversational Onboarding v1
-- Stores owner-scoped onboarding state and Life Setup Drafts only.
-- Drafts are proposals; they do not create Goals, Habits, Tasks, Projects, or Calendar events.

BEGIN;

create table if not exists public.nextron_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  conversation_id uuid references public.nextron_conversations(id) on delete set null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'draft_ready', 'completed', 'skipped')),
  understanding jsonb not null default '{}'::jsonb,
  setup_draft jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  skipped_at timestamptz,
  constraint nextron_onboarding_understanding_object check (jsonb_typeof(understanding) = 'object'),
  constraint nextron_onboarding_setup_draft_object check (setup_draft is null or jsonb_typeof(setup_draft) = 'object'),
  constraint nextron_onboarding_last_error_length check (last_error is null or char_length(last_error) <= 240)
);

alter table public.nextron_onboarding enable row level security;

drop policy if exists nextron_onboarding_select_own on public.nextron_onboarding;
create policy nextron_onboarding_select_own on public.nextron_onboarding
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists nextron_onboarding_insert_own on public.nextron_onboarding;
create policy nextron_onboarding_insert_own on public.nextron_onboarding
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists nextron_onboarding_update_own on public.nextron_onboarding;
create policy nextron_onboarding_update_own on public.nextron_onboarding
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists nextron_onboarding_delete_none_v1 on public.nextron_onboarding;
create policy nextron_onboarding_delete_none_v1 on public.nextron_onboarding
  for delete to authenticated using (false);

drop trigger if exists on_nextron_onboarding_updated on public.nextron_onboarding;
create trigger on_nextron_onboarding_updated
  before update on public.nextron_onboarding
  for each row execute function public.handle_updated_at();

create index if not exists idx_nextron_onboarding_user_status
  on public.nextron_onboarding(user_id, status);

revoke all privileges on table public.nextron_onboarding from anon;
revoke all privileges on table public.nextron_onboarding from public;
revoke all privileges on table public.nextron_onboarding from authenticated;
grant select, insert, update on table public.nextron_onboarding to authenticated;

COMMIT;

comment on table public.nextron_onboarding is
  'Owner-scoped NEXTRON onboarding state and Life Setup Drafts. Drafts are not domain writes and are not Memory.';
