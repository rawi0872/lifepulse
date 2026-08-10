-- NEXTRON Life Map Relationship Actions v1
-- Adds approved explicit Goal relationship mutations over canonical goal_links.

BEGIN;

alter table public.nextron_action_proposals
  drop constraint if exists nextron_action_type_allowlist;

alter table public.nextron_action_proposals
  add constraint nextron_action_type_allowlist check (action_type in (
    'life_pulse.task.create',
    'life_pulse.task.update',
    'life_pulse.goal.create',
    'life_pulse.goal.update',
    'life_pulse.goal.link',
    'life_pulse.goal.unlink',
    'life_pulse.habit.create',
    'life_pulse.habit.update',
    'life_pulse.project.create',
    'life_pulse.project.update',
    'life_pulse.action_plan.execute',
    'life_pulse.reminder.create'
  ));

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
    'life_pulse.goal.create', 'life_pulse.goal.update', 'life_pulse.goal.link', 'life_pulse.goal.unlink',
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

create or replace function public.nextron_relationship_target_permission_allowed(p_user_id uuid, p_linked_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_linked_type
    when 'project' then exists (select 1 from public.nextron_context_preferences p where p.user_id = p_user_id and p.allow_project_actions is true)
    when 'task' then exists (select 1 from public.nextron_context_preferences p where p.user_id = p_user_id and p.allow_task_actions is true)
    when 'habit' then exists (select 1 from public.nextron_context_preferences p where p.user_id = p_user_id and p.allow_habit_actions is true)
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
  v_before_status text;
  v_title text;
  v_linked_type text;
  v_goal_id uuid;
  v_linked_id uuid;
begin
  if not public.nextron_action_permission_allowed(p_user_id, p_action_type) then
    return jsonb_build_object('ok', false, 'reason', 'PERMISSION_DENIED');
  end if;

  if p_action_type in ('life_pulse.goal.link', 'life_pulse.goal.unlink') then
    v_goal_id := (p_payload ->> 'goalId')::uuid;
    v_linked_id := (p_payload ->> 'linkedId')::uuid;
    v_linked_type := p_payload ->> 'linkedType';
    if v_linked_type not in ('project', 'task', 'habit') then
      return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD');
    end if;
    if not public.nextron_relationship_target_permission_allowed(p_user_id, v_linked_type) then
      return jsonb_build_object('ok', false, 'reason', 'PERMISSION_DENIED');
    end if;
    if not exists (select 1 from public.goals where id = v_goal_id and user_id = p_user_id and title = p_payload ->> 'goalTitle' and status = p_payload ->> 'goalStatus') then
      return jsonb_build_object('ok', false, 'reason', 'STALE');
    end if;
    if v_linked_type = 'project' and not exists (select 1 from public.projects where id = v_linked_id and user_id = p_user_id and title = p_payload ->> 'linkedTitle' and status = p_payload ->> 'linkedStatus') then
      return jsonb_build_object('ok', false, 'reason', 'STALE');
    end if;
    if v_linked_type = 'task' and not exists (select 1 from public.tasks where id = v_linked_id and user_id = p_user_id and title = p_payload ->> 'linkedTitle' and status = p_payload ->> 'linkedStatus') then
      return jsonb_build_object('ok', false, 'reason', 'STALE');
    end if;
    if v_linked_type = 'habit' and not exists (select 1 from public.habits where id = v_linked_id and user_id = p_user_id and title = p_payload ->> 'linkedTitle' and frequency = p_payload ->> 'linkedStatus') then
      return jsonb_build_object('ok', false, 'reason', 'STALE');
    end if;

    if p_action_type = 'life_pulse.goal.link' then
      insert into public.goal_links (user_id, goal_id, linked_type, linked_id)
      values (p_user_id, v_goal_id, v_linked_type, v_linked_id)
      on conflict (user_id, goal_id, linked_type, linked_id) do nothing
      returning id into v_id;
      return jsonb_build_object('ok', true, 'mutation', case when v_id is null then 'existing' else 'linked' end, 'domain', 'goal_link', 'linkedType', v_linked_type);
    end if;

    delete from public.goal_links
    where user_id = p_user_id and goal_id = v_goal_id and linked_type = v_linked_type and linked_id = v_linked_id
    returning id into v_id;
    return jsonb_build_object('ok', true, 'mutation', case when v_id is null then 'absent' else 'unlinked' end, 'domain', 'goal_link', 'linkedType', v_linked_type);
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
    if v_title is null or length(trim(v_title)) = 0 then return jsonb_build_object('ok', false, 'reason', 'INVALID_PAYLOAD'); end if;
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
    if p_payload ? 'projectId' then
      if not exists (select 1 from public.projects where id = (p_payload ->> 'projectId')::uuid and user_id = p_user_id and title = p_payload ->> 'projectTitle' and status = p_payload ->> 'projectStatus') then
        return jsonb_build_object('ok', false, 'reason', 'STALE');
      end if;
      update public.tasks set project_id = (p_payload ->> 'projectId')::uuid
      where id = v_id and user_id = p_user_id and title = p_payload ->> 'beforeTitle' and status = p_payload ->> 'beforeStatus' and due_date is not distinct from v_before_due_date
      returning id into v_id;
    else
      update public.tasks set due_date = v_due_date
      where id = v_id and user_id = p_user_id and title = p_payload ->> 'beforeTitle' and status = p_payload ->> 'beforeStatus' and due_date is not distinct from v_before_due_date
      returning id into v_id;
    end if;
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
    update public.habits set frequency = p_payload ->> 'frequency', times_per_week = nullif(p_payload ->> 'timesPerWeek', '')::integer
    where id = v_id and user_id = p_user_id and title = p_payload ->> 'beforeTitle' and frequency = p_payload ->> 'beforeFrequency' and times_per_week is not distinct from nullif(p_payload ->> 'beforeTimesPerWeek', '')::integer
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

revoke all on function public.nextron_relationship_target_permission_allowed(uuid, text) from public, anon;
revoke all on function public.nextron_execute_single_domain_action(uuid, text, jsonb) from public, anon;
grant execute on function public.nextron_relationship_target_permission_allowed(uuid, text) to authenticated;

COMMIT;

comment on function public.nextron_relationship_target_permission_allowed(uuid, text) is
  'Checks the second write permission required for explicit NEXTRON goal_links relationship actions.';

comment on function public.nextron_execute_single_domain_action(uuid, text, jsonb) is
  'Executes approved NEXTRON single-domain and explicit Life Map relationship actions with owner, permission, stale-state, and idempotency checks.';
