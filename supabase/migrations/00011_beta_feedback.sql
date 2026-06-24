-- Beta Feedback System
-- Collects structured feedback from private beta testers

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  page_path text,
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  category text check (category is null or category in ('bug', 'confusing', 'idea', 'praise', 'other')),
  message text not null,
  browser_info text,
  created_at timestamptz not null default now()
);

-- RLS: users can insert their own feedback
alter table public.beta_feedback enable row level security;

create policy "Users can insert their own feedback"
  on public.beta_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can read only their own feedback (for history)
create policy "Users can view their own feedback"
  on public.beta_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No update policy (feedback is immutable once submitted)
-- No delete policy (users should not be able to delete feedback)
