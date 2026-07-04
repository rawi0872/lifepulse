-- Life Pulse Body Profile Foundation
-- Adds stable, user-owned body context for wellness trends.

create table if not exists public.body_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  height_cm numeric(5,2) check (height_cm is null or height_cm > 0),
  target_weight_kg numeric(6,2) check (target_weight_kg is null or target_weight_kg > 0),
  activity_level text check (
    activity_level is null
    or activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),
  body_goal text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.body_profiles enable row level security;

drop policy if exists "body_profiles_select_own" on public.body_profiles;
create policy "body_profiles_select_own" on public.body_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "body_profiles_insert_own" on public.body_profiles;
create policy "body_profiles_insert_own" on public.body_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "body_profiles_update_own" on public.body_profiles;
create policy "body_profiles_update_own" on public.body_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_profiles_delete_own" on public.body_profiles;
create policy "body_profiles_delete_own" on public.body_profiles
  for delete using (auth.uid() = user_id);

create index if not exists idx_body_profiles_user_id on public.body_profiles(user_id);

drop trigger if exists on_body_profiles_updated on public.body_profiles;
create trigger on_body_profiles_updated
  before update on public.body_profiles
  for each row execute function public.handle_updated_at();
