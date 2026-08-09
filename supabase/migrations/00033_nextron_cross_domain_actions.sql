-- NEXTRON Cross-Domain Approved Actions v1
-- Extends the proven action proposal framework to Goals, Habits, Projects, and multi-action setup plans.

BEGIN;

alter table public.nextron_context_preferences
  add column if not exists allow_goal_actions boolean not null default false,
  add column if not exists allow_habit_actions boolean not null default false,
  add column if not exists allow_project_actions boolean not null default false;

alter table public.nextron_context_preferences
  alter column permission_version set default 6;

alter table public.nextron_context_preferences
  drop constraint if exists nextron_context_preferences_permission_version_check;

alter table public.nextron_context_preferences
  add constraint nextron_context_preferences_permission_version_check
  check (permission_version in (1, 2, 3, 4, 5, 6));

-- Prompt 2 stopped creating default realms. Habits remain owner-scoped; realm linkage is optional.
alter table public.habits
  alter column realm_id drop not null;

drop policy if exists "habits_insert_own" on public.habits;
create policy "habits_insert_own" on public.habits
  for insert with check (
    auth.uid() = user_id
    and (realm_id is null or public.realm_belongs_to_user(realm_id))
  );

drop policy if exists "habits_update_own" on public.habits;
create policy "habits_update_own" on public.habits
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (realm_id is null or public.realm_belongs_to_user(realm_id))
  );

alter table public.nextron_action_proposals
  add column if not exists plan_kind text not null default 'single',
  add column if not exists source_kind text,
  add column if not exists source_hash text,
  add column if not exists idempotency_key text;

alter table public.nextron_action_proposals
  drop constraint if exists nextron_action_type_allowlist;

alter table public.nextron_action_proposals
  add constraint nextron_action_type_allowlist check (action_type in (
    'life_pulse.task.create',
    'life_pulse.task.update',
    'life_pulse.goal.create',
    'life_pulse.goal.update',
    'life_pulse.habit.create',
    'life_pulse.habit.update',
    'life_pulse.project.create',
    'life_pulse.project.update',
    'life_pulse.action_plan.execute',
    'life_pulse.reminder.create'
  ));

alter table public.nextron_action_proposals
  drop constraint if exists nextron_action_status_allowlist;

alter table public.nextron_action_proposals
  add constraint nextron_action_status_allowlist check (status in (
    'pending',
    'approved_execution_disabled',
    'completed',
    'partially_failed',
    'failed',
    'stale',
    'canceled',
    'expired',
    'invalidated'
  ));

alter table public.nextron_action_proposals
  drop constraint if exists nextron_action_plan_kind_check;

alter table public.nextron_action_proposals
  add constraint nextron_action_plan_kind_check check (plan_kind in ('single', 'setup', 'multi_action'));

alter table public.nextron_action_proposals
  drop constraint if exists nextron_action_source_hash_length;

alter table public.nextron_action_proposals
  add constraint nextron_action_source_hash_length check (source_hash is null or char_length(source_hash) <= 96);

alter table public.nextron_action_proposals
  drop constraint if exists nextron_action_idempotency_key_length;

alter table public.nextron_action_proposals
  add constraint nextron_action_idempotency_key_length check (idempotency_key is null or char_length(idempotency_key) <= 96);

create unique index if not exists idx_nextron_action_proposals_user_idempotency
  on public.nextron_action_proposals(user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.nextron_create_action_proposal(
  p_conversation_id uuid,
  p_action_type text,
  p_validated_payload jsonb,
  p_preview_payload jsonb,
  p_risk_level text,
  p_expires_at timestamptz
)
returns public.nextron_action_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.nextron_action_proposals;
  v_plan_kind text := coalesce(p_validated_payload ->> 'planKind', 'single');
  v_source_kind text := nullif(p_validated_payload ->> 'sourceKind', '');
  v_source_hash text := nullif(p_validated_payload ->> 'sourceHash', '');
  v_idempotency_key text := nullif(p_validated_payload ->> 'idempotencyKey', '');
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_conversation_id is not null and not exists (
    select 1 from public.nextron_conversations c
    where c.id = p_conversation_id and c.user_id = v_user_id and c.deleted_at is null
  ) then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;
  if p_action_type not in (
    'life_pulse.task.create', 'life_pulse.task.update',
    'life_pulse.goal.create', 'life_pulse.goal.update',
    'life_pulse.habit.create', 'life_pulse.habit.update',
    'life_pulse.project.create', 'life_pulse.project.update',
    'life_pulse.action_plan.execute', 'life_pulse.reminder.create'
  ) then
    raise exception 'UNSUPPORTED_ACTION';
  end if;
  if p_risk_level not in ('low', 'sensitive', 'external') then
    raise exception 'INVALID_RISK';
  end if;
  if v_plan_kind not in ('single', 'setup', 'multi_action') then
    raise exception 'INVALID_PLAN_KIND';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 minutes' then
    raise exception 'INVALID_EXPIRY';
  end if;

  insert into public.nextron_action_proposals (
    user_id, conversation_id, action_type, validated_payload, preview_payload, risk_level,
    expires_at, plan_kind, source_kind, source_hash, idempotency_key
  )
  values (
    v_user_id, p_conversation_id, p_action_type, p_validated_payload, p_preview_payload, p_risk_level,
    p_expires_at, v_plan_kind, v_source_kind, v_source_hash, v_idempotency_key
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null
  do update set preview_payload = public.nextron_action_proposals.preview_payload
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.nextron_required_action_permission(p_action_type text)
returns text
language sql
stable
as $$
  select case
    when p_action_type like 'life_pulse.task.%' then 'task'
    when p_action_type like 'life_pulse.goal.%' then 'goal'
    when p_action_type like 'life_pulse.habit.%' then 'habit'
    when p_action_type like 'life_pulse.project.%' then 'project'
    else 'unsupported'
  end;
$$;

create or replace function public.nextron_action_permission_allowed(p_user_id uuid, p_action_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.nextron_required_action_permission(p_action_type)
    when 'task' then exists (select 1 from public.nextron_context_preferences p where p.user_id = p_user_id and p.allow_task_actions is true)
    when 'goal' then exists (select 1 from public.nextron_context_preferences p where p.user_id = p_user_id and p.allow_goal_actions is true)
    when 'habit' then exists (select 1 from public.nextron_context_preferences p where p.user_id = p_user_id and p.allow_habit_actions is true)
    when 'project' then exists (select 1 from public.nextron_context_preferences p where p.user_id = p_user_id and p.allow_project_actions is true)
    else false
  end;
$$;

create or replace function public.nextron_execute_single_domain_action(
  p_user_id uuid,
  p_action_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_due_date date;
  v_target_date date;
  v_deadline date;
  v_before_due_date date;
  v_before_target_date date;
  v_before_deadline date;
  v_before_title text;
  v_before_status text;
  v_before_priority text;
  v_before_frequency text;
  v_before_times integer;
  v_title text;
begin
  if not public.nextron_action_permission_allowed(p_user_id, p_action_type) then
    return jsonb_build_object('ok', false, 'reason', 'PERMISSION_DENIED');
  end if;

  if p_action_type = 'life_pulse.task.create' then
    v_title := left(p_payload ->> 'title', 200);
    v_due_date := case when p_payload ->> 'dueDate' is null then null else (p_payload ->> 'dueDate')::date end;
    if v_title is null or length(trim(v_title)) = 0 or (p_payload ->> 'priority') not in ('low', 'medium', 'high') then
      return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
    end if;
    select id into v_id from public.tasks where user_id = p_user_id and lower(title) = lower(v_title) order by created_at desc limit 1;
    if v_id is null then
      insert into public.tasks (user_id, realm_id, project_id, title, priority, due_date, status)
      values (p_user_id, null, null, v_title, p_payload ->> 'priority', v_due_date, 'todo') returning id into v_id;
      return jsonb_build_object('ok', true, 'mutation', 'created', 'domain', 'task', 'id', v_id);
    end if;
    return jsonb_build_object('ok', true, 'mutation', 'existing', 'domain', 'task', 'id', v_id);
  end if;

  if p_action_type = 'life_pulse.goal.create' then
    v_title := left(p_payload ->> 'title', 160);
    v_target_date := case when p_payload ->> 'targetDate' is null then null else (p_payload ->> 'targetDate')::date end;
    if v_title is null or length(trim(v_title)) = 0 or (p_payload ->> 'priority') not in ('low', 'medium', 'high') then
      return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
    end if;
    select id into v_id from public.goals where user_id = p_user_id and lower(title) = lower(v_title) and status <> 'archived' order by created_at desc limit 1;
    if v_id is null then
      insert into public.goals (user_id, realm_id, title, description, why, priority, target_date, status)
      values (p_user_id, null, v_title, nullif(left(coalesce(p_payload ->> 'description', ''), 500), ''), nullif(left(coalesce(p_payload ->> 'why', ''), 300), ''), p_payload ->> 'priority', v_target_date, 'active') returning id into v_id;
      return jsonb_build_object('ok', true, 'mutation', 'created', 'domain', 'goal', 'id', v_id);
    end if;
    return jsonb_build_object('ok', true, 'mutation', 'existing', 'domain', 'goal', 'id', v_id);
  end if;

  if p_action_type = 'life_pulse.habit.create' then
    v_title := left(p_payload ->> 'title', 160);
    if v_title is null or length(trim(v_title)) = 0 or (p_payload ->> 'frequency') not in ('daily', 'weekdays', 'weekends', 'weekly', 'times_per_week') then
      return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
    end if;
    select id into v_id from public.habits where user_id = p_user_id and lower(title) = lower(v_title) order by created_at desc limit 1;
    if v_id is null then
      insert into public.habits (user_id, realm_id, title, description, frequency, times_per_week, days_of_week)
      values (p_user_id, null, v_title, nullif(left(coalesce(p_payload ->> 'description', ''), 500), ''), p_payload ->> 'frequency', nullif(p_payload ->> 'timesPerWeek', '')::integer, null)
      returning id into v_id;
      return jsonb_build_object('ok', true, 'mutation', 'created', 'domain', 'habit', 'id', v_id);
    end if;
    return jsonb_build_object('ok', true, 'mutation', 'existing', 'domain', 'habit', 'id', v_id);
  end if;

  if p_action_type = 'life_pulse.project.create' then
    v_title := left(p_payload ->> 'title', 160);
    v_deadline := case when p_payload ->> 'deadline' is null then null else (p_payload ->> 'deadline')::date end;
    if v_title is null or length(trim(v_title)) = 0 then
      return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
    end if;
    select id into v_id from public.projects where user_id = p_user_id and lower(title) = lower(v_title) and status <> 'completed' order by created_at desc limit 1;
    if v_id is null then
      insert into public.projects (user_id, realm_id, title, description, status, deadline, progress)
      values (p_user_id, null, v_title, nullif(left(coalesce(p_payload ->> 'description', ''), 500), ''), 'active', v_deadline, 0) returning id into v_id;
      return jsonb_build_object('ok', true, 'mutation', 'created', 'domain', 'project', 'id', v_id);
    end if;
    return jsonb_build_object('ok', true, 'mutation', 'existing', 'domain', 'project', 'id', v_id);
  end if;

  if p_action_type = 'life_pulse.task.update' then
    v_id := (p_payload ->> 'taskId')::uuid;
    v_due_date := case when p_payload ->> 'dueDate' is null then null else (p_payload ->> 'dueDate')::date end;
    v_before_due_date := case when p_payload ->> 'beforeDueDate' is null then null else (p_payload ->> 'beforeDueDate')::date end;
    update public.tasks set due_date = v_due_date
    where id = v_id and user_id = p_user_id and title = p_payload ->> 'beforeTitle' and status = p_payload ->> 'beforeStatus' and due_date is not distinct from v_before_due_date
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'reason', 'STALE'); end if;
    return jsonb_build_object('ok', true, 'mutation', 'updated', 'domain', 'task', 'id', v_id);
  end if;

  if p_action_type = 'life_pulse.goal.update' then
    v_id := (p_payload ->> 'goalId')::uuid;
    v_before_target_date := case when p_payload ->> 'beforeTargetDate' is null then null else (p_payload ->> 'beforeTargetDate')::date end;
    v_target_date := case when p_payload ->> 'targetDate' is null then null else (p_payload ->> 'targetDate')::date end;
    update public.goals set priority = coalesce(nullif(p_payload ->> 'priority', ''), priority), target_date = v_target_date
    where id = v_id and user_id = p_user_id and title = p_payload ->> 'beforeTitle' and status = p_payload ->> 'beforeStatus' and priority = p_payload ->> 'beforePriority' and target_date is not distinct from v_before_target_date
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'reason', 'STALE'); end if;
    return jsonb_build_object('ok', true, 'mutation', 'updated', 'domain', 'goal', 'id', v_id);
  end if;

  if p_action_type = 'life_pulse.habit.update' then
    v_id := (p_payload ->> 'habitId')::uuid;
    v_before_times := nullif(p_payload ->> 'beforeTimesPerWeek', '')::integer;
    update public.habits set frequency = p_payload ->> 'frequency', times_per_week = nullif(p_payload ->> 'timesPerWeek', '')::integer
    where id = v_id and user_id = p_user_id and title = p_payload ->> 'beforeTitle' and frequency = p_payload ->> 'beforeFrequency' and times_per_week is not distinct from v_before_times
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'reason', 'STALE'); end if;
    return jsonb_build_object('ok', true, 'mutation', 'updated', 'domain', 'habit', 'id', v_id);
  end if;

  if p_action_type = 'life_pulse.project.update' then
    v_id := (p_payload ->> 'projectId')::uuid;
    v_before_deadline := case when p_payload ->> 'beforeDeadline' is null then null else (p_payload ->> 'beforeDeadline')::date end;
    v_deadline := case when p_payload ->> 'deadline' is null then null else (p_payload ->> 'deadline')::date end;
    update public.projects set status = coalesce(nullif(p_payload ->> 'status', ''), status), deadline = v_deadline
    where id = v_id and user_id = p_user_id and title = p_payload ->> 'beforeTitle' and status = p_payload ->> 'beforeStatus' and deadline is not distinct from v_before_deadline
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'reason', 'STALE'); end if;
    return jsonb_build_object('ok', true, 'mutation', 'updated', 'domain', 'project', 'id', v_id);
  end if;

  return jsonb_build_object('ok', false, 'reason', 'UNSUPPORTED_ACTION');
end;
$$;

create or replace function public.nextron_execute_action(p_proposal_id uuid)
returns public.nextron_action_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.nextron_action_proposals;
  v_payload jsonb;
  v_actions jsonb;
  v_action jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_success integer := 0;
  v_failed integer := 0;
  v_stale integer := 0;
  v_status text;
  v_reason text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_row from public.nextron_action_proposals
  where id = p_proposal_id and user_id = v_user_id and status = 'pending'
  for update;

  if v_row.id is null then
    select * into v_row from public.nextron_action_proposals where id = p_proposal_id and user_id = v_user_id;
    if v_row.id is null then raise exception 'PROPOSAL_NOT_FOUND'; end if;
    return v_row;
  end if;

  if v_row.expires_at <= now() then
    update public.nextron_action_proposals set status = 'expired', finalized_at = now(), final_reason = 'EXPIRED_ACTION'
    where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  if v_row.action_type = 'life_pulse.reminder.create' then
    update public.nextron_action_proposals set status = 'approved_execution_disabled', approved_at = now(), finalized_at = now(), final_reason = 'EXECUTION_DISABLED'
    where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  v_payload := v_row.validated_payload;
  v_actions := case when v_row.action_type = 'life_pulse.action_plan.execute' then v_payload -> 'actions' else jsonb_build_array(jsonb_build_object('actionType', v_row.action_type, 'payload', v_payload)) end;

  if jsonb_typeof(v_actions) <> 'array' or jsonb_array_length(v_actions) = 0 or jsonb_array_length(v_actions) > 20 then
    update public.nextron_action_proposals set status = 'failed', approved_at = now(), executed_at = now(), finalized_at = now(), final_reason = 'INVALID_PLAN', execution_result = jsonb_build_object('results', v_results)
    where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  for v_action in select * from jsonb_array_elements(v_actions) loop
    v_result := public.nextron_execute_single_domain_action(v_user_id, v_action ->> 'actionType', coalesce(v_action -> 'payload', '{}'::jsonb));
    v_results := v_results || jsonb_build_array(jsonb_build_object('actionType', v_action ->> 'actionType', 'result', v_result));
    if coalesce((v_result ->> 'ok')::boolean, false) then
      v_success := v_success + 1;
    elsif v_result ->> 'reason' = 'STALE' then
      v_stale := v_stale + 1;
      v_failed := v_failed + 1;
    else
      v_failed := v_failed + 1;
    end if;
  end loop;

  if v_success > 0 and v_failed = 0 then
    v_status := 'completed'; v_reason := 'PLAN_COMPLETED';
  elsif v_success > 0 and v_failed > 0 then
    v_status := 'partially_failed'; v_reason := 'PLAN_PARTIALLY_FAILED';
  elsif v_stale > 0 then
    v_status := 'stale'; v_reason := 'STALE_ACTION';
  else
    v_status := 'failed'; v_reason := 'PLAN_FAILED';
  end if;

  update public.nextron_action_proposals
  set status = v_status, approved_at = now(), executed_at = now(), finalized_at = now(), final_reason = v_reason,
      execution_result = jsonb_build_object('succeeded', v_success, 'failed', v_failed, 'results', v_results)
  where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.nextron_execute_task_action(p_proposal_id uuid)
returns public.nextron_action_proposals
language sql
security definer
set search_path = public
as $$
  select * from public.nextron_execute_action(p_proposal_id);
$$;

revoke all on function public.nextron_execute_action(uuid) from public, anon;
revoke all on function public.nextron_execute_single_domain_action(uuid, text, jsonb) from public, anon;
revoke all on function public.nextron_action_permission_allowed(uuid, text) from public, anon;
revoke all on function public.nextron_required_action_permission(text) from public, anon;
grant execute on function public.nextron_execute_action(uuid) to authenticated;
grant execute on function public.nextron_action_permission_allowed(uuid, text) to authenticated;

COMMIT;

comment on function public.nextron_execute_action(uuid) is
  'Executes owner-scoped NEXTRON action proposals for supported Goals, Habits, Projects, Tasks, and bounded plans after permission, approval, expiry, idempotency, and stale-state checks.';

comment on column public.nextron_context_preferences.allow_goal_actions is
  'Allows NEXTRON to execute explicitly approved Goal create/update actions. Defaults false and does not bypass per-action approval.';

comment on column public.nextron_context_preferences.allow_habit_actions is
  'Allows NEXTRON to execute explicitly approved Habit create/update actions. Defaults false and does not bypass per-action approval.';

comment on column public.nextron_context_preferences.allow_project_actions is
  'Allows NEXTRON to execute explicitly approved Project create/update actions. Defaults false and does not bypass per-action approval.';
