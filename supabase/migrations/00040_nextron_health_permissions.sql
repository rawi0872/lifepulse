-- NEXTRON health permission — explicit, separate from storage consent
-- Storage: allowed_metrics; NEXTRON: nextron_allowed_metrics (subset)
alter table public.health_preferences add column if not exists nextron_allowed_metrics text[] not null default '{}'
  check (nextron_allowed_metrics <@ array['sleep_duration','steps','active_minutes','exercise_minutes','resting_heart_rate','weight']::text[]);

comment on column public.health_preferences.nextron_allowed_metrics is 'Metrics NEXTRON may use in evidence (requires also in allowed_metrics)';

create or replace function public.is_nextron_health_metric_allowed(metric text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  allowed text[];
  nextron text[];
begin
  select hp.allowed_metrics, hp.nextron_allowed_metrics into allowed, nextron
  from public.health_preferences hp where hp.user_id = auth.uid();
  if allowed is null or nextron is null then return false; end if;
  return metric = any(allowed) and metric = any(nextron);
end;
$$;

revoke all on function public.is_nextron_health_metric_allowed(text) from public;
grant execute on function public.is_nextron_health_metric_allowed(text) to authenticated;
