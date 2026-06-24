-- Life Pulse Body Pulse Pro Migration
-- Adds manual workout, nutrition, measurement, and health note tracking tables

-- 1. WORKOUTS
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null default current_date,
  title text not null,
  type text,
  duration_minutes integer check (duration_minutes >= 0),
  intensity integer check (intensity >= 1 and intensity <= 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. WORKOUT EXERCISES
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_name text not null,
  sets integer check (sets >= 0),
  reps integer check (reps >= 0),
  weight_kg numeric(6,2) check (weight_kg >= 0),
  distance_km numeric(6,2) check (distance_km >= 0),
  duration_minutes integer check (duration_minutes >= 0),
  notes text,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

-- 3. NUTRITION LOGS
create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  meal_name text,
  calories integer check (calories >= 0),
  protein_g numeric(6,2) check (protein_g >= 0),
  carbs_g numeric(6,2) check (carbs_g >= 0),
  fat_g numeric(6,2) check (fat_g >= 0),
  water_ml integer check (water_ml >= 0),
  notes text,
  created_at timestamptz not null default now()
);

-- 4. BODY MEASUREMENTS
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_date date not null default current_date,
  weight_kg numeric(6,2) check (weight_kg > 0),
  body_fat_percent numeric(4,1) check (body_fat_percent >= 0 and body_fat_percent <= 100),
  waist_cm numeric(5,1) check (waist_cm > 0),
  chest_cm numeric(5,1) check (chest_cm > 0),
  arms_cm numeric(5,1) check (arms_cm > 0),
  legs_cm numeric(5,1) check (legs_cm > 0),
  notes text,
  created_at timestamptz not null default now()
);

-- 5. HEALTH NOTES
create table if not exists public.health_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null default current_date,
  category text,
  severity integer check (severity >= 1 and severity <= 5),
  title text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- 6. ROW LEVEL SECURITY
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.health_notes enable row level security;

-- 7. POLICIES: WORKOUTS
drop policy if exists "workouts_select_own" on public.workouts;
create policy "workouts_select_own" on public.workouts
  for select using (auth.uid() = user_id);

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own" on public.workouts
  for insert with check (auth.uid() = user_id);

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own" on public.workouts
  for delete using (auth.uid() = user_id);

-- 8. POLICIES: WORKOUT EXERCISES
drop policy if exists "workout_exercises_select_own" on public.workout_exercises;
create policy "workout_exercises_select_own" on public.workout_exercises
  for select using (auth.uid() = user_id);

drop policy if exists "workout_exercises_insert_own" on public.workout_exercises;
create policy "workout_exercises_insert_own" on public.workout_exercises
  for insert with check (auth.uid() = user_id);

drop policy if exists "workout_exercises_update_own" on public.workout_exercises;
create policy "workout_exercises_update_own" on public.workout_exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workout_exercises_delete_own" on public.workout_exercises;
create policy "workout_exercises_delete_own" on public.workout_exercises
  for delete using (auth.uid() = user_id);

-- 9. POLICIES: NUTRITION LOGS
drop policy if exists "nutrition_logs_select_own" on public.nutrition_logs;
create policy "nutrition_logs_select_own" on public.nutrition_logs
  for select using (auth.uid() = user_id);

drop policy if exists "nutrition_logs_insert_own" on public.nutrition_logs;
create policy "nutrition_logs_insert_own" on public.nutrition_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "nutrition_logs_update_own" on public.nutrition_logs;
create policy "nutrition_logs_update_own" on public.nutrition_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nutrition_logs_delete_own" on public.nutrition_logs;
create policy "nutrition_logs_delete_own" on public.nutrition_logs
  for delete using (auth.uid() = user_id);

-- 10. POLICIES: BODY MEASUREMENTS
drop policy if exists "body_measurements_select_own" on public.body_measurements;
create policy "body_measurements_select_own" on public.body_measurements
  for select using (auth.uid() = user_id);

drop policy if exists "body_measurements_insert_own" on public.body_measurements;
create policy "body_measurements_insert_own" on public.body_measurements
  for insert with check (auth.uid() = user_id);

drop policy if exists "body_measurements_update_own" on public.body_measurements;
create policy "body_measurements_update_own" on public.body_measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_measurements_delete_own" on public.body_measurements;
create policy "body_measurements_delete_own" on public.body_measurements
  for delete using (auth.uid() = user_id);

-- 11. POLICIES: HEALTH NOTES
drop policy if exists "health_notes_select_own" on public.health_notes;
create policy "health_notes_select_own" on public.health_notes
  for select using (auth.uid() = user_id);

drop policy if exists "health_notes_insert_own" on public.health_notes;
create policy "health_notes_insert_own" on public.health_notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "health_notes_update_own" on public.health_notes;
create policy "health_notes_update_own" on public.health_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "health_notes_delete_own" on public.health_notes;
create policy "health_notes_delete_own" on public.health_notes
  for delete using (auth.uid() = user_id);

-- 12. INDEXES
create index if not exists idx_workouts_user_date on public.workouts(user_id, workout_date);
create index if not exists idx_workout_exercises_workout on public.workout_exercises(workout_id);
create index if not exists idx_nutrition_logs_user_date on public.nutrition_logs(user_id, log_date);
create index if not exists idx_body_measurements_user_date on public.body_measurements(user_id, measurement_date);
create index if not exists idx_health_notes_user_date on public.health_notes(user_id, note_date);

-- 13. UPDATED_AT TRIGGER FOR WORKOUTS
drop trigger if exists on_workouts_updated on public.workouts;
create trigger on_workouts_updated
  before update on public.workouts
  for each row execute function public.handle_updated_at();
