-- Life Pulse NEXTRON Task action executors
-- Enables approved, explicit Task create/update actions only. Other action namespaces remain non-executing.

BEGIN;

alter table public.nextron_context_preferences
  add column if not exists allow_task_actions boolean not null default false;

alter table public.nextron_context_preferences
  alter column permission_version set default 5;

alter table public.nextron_context_preferences
  drop constraint if exists nextron_context_preferences_permission_version_check;

alter table public.nextron_context_preferences
  add constraint nextron_context_preferences_permission_version_check
  check (permission_version in (1, 2, 3, 4, 5));

alter table public.nextron_action_proposals
  add column if not exists executed_at timestamptz,
  add column if not exists execution_result jsonb;

alter table public.nextron_action_proposals
  drop constraint if exists nextron_action_status_allowlist;

alter table public.nextron_action_proposals
  add constraint nextron_action_status_allowlist
  check (status in ('pending', 'approved_execution_disabled', 'completed', 'canceled', 'expired', 'invalidated'));

create or replace function public.nextron_execute_task_action(p_proposal_id uuid)
returns public.nextron_action_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.nextron_action_proposals;
  v_payload jsonb;
  v_task_id uuid;
  v_due_date date;
  v_before_due_date date;
  v_before_title text;
  v_before_status text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_row
  from public.nextron_action_proposals
  where id = p_proposal_id and user_id = v_user_id and status = 'pending'
  for update;

  if v_row.id is null then
    select * into v_row from public.nextron_action_proposals where id = p_proposal_id and user_id = v_user_id;
    if v_row.id is null then
      raise exception 'PROPOSAL_NOT_FOUND';
    end if;
    return v_row;
  end if;

  if v_row.expires_at <= now() then
    update public.nextron_action_proposals
    set status = 'expired', finalized_at = now(), final_reason = 'EXPIRED_ACTION'
    where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  if v_row.action_type not in ('life_pulse.task.create', 'life_pulse.task.update') then
    update public.nextron_action_proposals
    set status = 'approved_execution_disabled', approved_at = now(), finalized_at = now(), final_reason = 'EXECUTION_DISABLED'
    where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  if not exists (
    select 1 from public.nextron_context_preferences p
    where p.user_id = v_user_id and p.allow_task_actions is true
  ) then
    raise exception 'TASK_ACTIONS_NOT_ALLOWED';
  end if;

  v_payload := v_row.validated_payload;

  if v_row.action_type = 'life_pulse.task.create' then
    if jsonb_typeof(v_payload -> 'title') <> 'string'
      or jsonb_typeof(v_payload -> 'dueDate') not in ('string', 'null')
      or jsonb_typeof(v_payload -> 'priority') <> 'string'
      or (v_payload ->> 'priority') not in ('low', 'medium', 'high') then
      raise exception 'INVALID_TASK_PAYLOAD';
    end if;

    v_due_date := case when v_payload ->> 'dueDate' is null then null else (v_payload ->> 'dueDate')::date end;

    insert into public.tasks (user_id, realm_id, project_id, title, priority, due_date, status)
    values (v_user_id, null, null, left(v_payload ->> 'title', 200), v_payload ->> 'priority', v_due_date, 'todo')
    returning id into v_task_id;

    update public.nextron_action_proposals
    set status = 'completed', approved_at = now(), executed_at = now(), finalized_at = now(), final_reason = 'TASK_CREATED', execution_result = jsonb_build_object('taskId', v_task_id, 'mutation', 'created')
    where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  if jsonb_typeof(v_payload -> 'taskId') <> 'string'
    or jsonb_typeof(v_payload -> 'beforeTitle') <> 'string'
    or jsonb_typeof(v_payload -> 'beforeStatus') <> 'string'
    or jsonb_typeof(v_payload -> 'beforeDueDate') not in ('string', 'null')
    or jsonb_typeof(v_payload -> 'dueDate') not in ('string', 'null') then
    raise exception 'INVALID_TASK_PAYLOAD';
  end if;

  v_task_id := (v_payload ->> 'taskId')::uuid;
  v_due_date := case when v_payload ->> 'dueDate' is null then null else (v_payload ->> 'dueDate')::date end;
  v_before_due_date := case when v_payload ->> 'beforeDueDate' is null then null else (v_payload ->> 'beforeDueDate')::date end;
  v_before_title := v_payload ->> 'beforeTitle';
  v_before_status := v_payload ->> 'beforeStatus';

  update public.tasks
  set due_date = v_due_date
  where id = v_task_id
    and user_id = v_user_id
    and title = v_before_title
    and status = v_before_status
    and due_date is not distinct from v_before_due_date
  returning id into v_task_id;

  if v_task_id is null then
    raise exception 'TASK_PRECONDITION_FAILED';
  end if;

  update public.nextron_action_proposals
  set status = 'completed', approved_at = now(), executed_at = now(), finalized_at = now(), final_reason = 'TASK_UPDATED', execution_result = jsonb_build_object('taskId', v_task_id, 'mutation', 'updated')
  where id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.nextron_execute_task_action(uuid) from public, anon;
grant execute on function public.nextron_execute_task_action(uuid) to authenticated;

COMMIT;

comment on column public.nextron_context_preferences.allow_task_actions is
  'Allows NEXTRON to execute explicitly approved Task create/update actions. Defaults false and does not bypass per-action approval.';

comment on function public.nextron_execute_task_action(uuid) is
  'Executes only explicitly approved owner-scoped NEXTRON Task create/update proposals after permission, expiry, payload, and resource revalidation.';
