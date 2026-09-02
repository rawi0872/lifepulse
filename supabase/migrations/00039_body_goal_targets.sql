-- Body Goal Targets — extends goals with quantitative Body tracking
-- No new table; reuses existing goals + realm association (Body realm)
-- All columns nullable for non-Body goals; RLS inherited from goals

alter table public.goals add column if not exists goal_type text
  check (goal_type in ('general','weight_target','steps_average','exercise_frequency','sleep_duration','weight_trend'));

alter table public.goals add column if not exists target_metric text
  check (target_metric in ('steps','active_minutes','exercise_minutes','sleep_duration','resting_heart_rate','weight', 'exercise_sessions_per_week'));

alter table public.goals add column if not exists target_value numeric
  check (target_value > 0);

alter table public.goals add column if not exists target_unit text;

alter table public.goals add column if not exists baseline_value numeric;

comment on column public.goals.goal_type is 'Body V1 kind: general, weight_target, steps_average, exercise_frequency, sleep_duration';
comment on column public.goals.target_metric is 'Metric key for quantitative Body goals';
comment on column public.goals.target_value is 'Target numeric value (steps/day, kg, hours, sessions/week)';
comment on column public.goals.baseline_value is 'Baseline at goal creation for progress direction';
