-- Product-Ready V1 beta learning loop
-- First-party, consented, bounded product events. No raw private content.

alter table public.profiles
  add column if not exists allow_product_improvement_events boolean not null default false;

create table if not exists public.product_learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'onboarding_started',
    'onboarding_completed',
    'today_opened',
    'nextron_ask_succeeded',
    'nextron_ask_failed',
    'task_completed',
    'habit_completed',
    'goal_created',
    'project_created',
    'weekly_review_completed',
    'journal_entry_created',
    'feedback_submitted'
  )),
  surface text not null check (surface in ('onboarding', 'today', 'nextron', 'tasks', 'habits', 'goals', 'projects', 'weekly_review', 'journal', 'settings', 'feedback')),
  occurred_at timestamptz not null default now(),
  release_version text,
  status text check (status is null or status in ('success', 'failed')),
  reason text check (reason is null or reason in ('timeout', 'auth_required', 'invalid_request', 'api_error', 'network_error', 'render_error', 'unknown')),
  viewport text check (viewport is null or viewport in ('mobile', 'tablet', 'desktop', 'unknown'))
);

create index if not exists idx_product_learning_events_user_time
  on public.product_learning_events(user_id, occurred_at desc);

create index if not exists idx_product_learning_events_type_time
  on public.product_learning_events(event_type, occurred_at desc);

alter table public.product_learning_events enable row level security;

drop policy if exists "Users can insert their own product learning events" on public.product_learning_events;
create policy "Users can insert their own product learning events"
  on public.product_learning_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own product learning events" on public.product_learning_events;
create policy "Users can view their own product learning events"
  on public.product_learning_events
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Feedback is user-owned beta data. Keep explicit submitted text only while the user exists.
delete from public.beta_feedback where user_id is null;

alter table public.beta_feedback
  alter column user_id set not null;

alter table public.beta_feedback
  drop constraint if exists beta_feedback_user_id_fkey;

alter table public.beta_feedback
  add constraint beta_feedback_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
