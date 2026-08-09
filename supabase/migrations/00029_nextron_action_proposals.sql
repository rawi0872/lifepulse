-- Life Pulse NEXTRON Action Proposal Framework v1
-- Stores validated, owner-scoped action proposals only. Prompt 7 records approval state but never executes writes.

BEGIN;

create table if not exists public.nextron_action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.nextron_conversations(id) on delete set null,
  action_type text not null,
  validated_payload jsonb not null,
  preview_payload jsonb not null,
  risk_level text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  canceled_at timestamptz,
  finalized_at timestamptz,
  final_reason text,
  constraint nextron_action_type_allowlist check (action_type in ('life_pulse.task.create', 'life_pulse.task.update', 'life_pulse.project.update', 'life_pulse.reminder.create')),
  constraint nextron_action_risk_allowlist check (risk_level in ('low', 'sensitive', 'external')),
  constraint nextron_action_status_allowlist check (status in ('pending', 'approved_execution_disabled', 'canceled', 'expired', 'invalidated')),
  constraint nextron_action_payload_object check (jsonb_typeof(validated_payload) = 'object'),
  constraint nextron_action_preview_object check (jsonb_typeof(preview_payload) = 'object'),
  constraint nextron_action_expiry_after_created check (expires_at > created_at),
  constraint nextron_action_finalized_reason_length check (final_reason is null or char_length(final_reason) <= 160)
);

alter table public.nextron_action_proposals enable row level security;

drop policy if exists nextron_action_proposals_select_own on public.nextron_action_proposals;
create policy nextron_action_proposals_select_own on public.nextron_action_proposals
  for select to authenticated using (auth.uid() = user_id);

revoke all privileges on table public.nextron_action_proposals from anon;
revoke all privileges on table public.nextron_action_proposals from public;
revoke all privileges on table public.nextron_action_proposals from authenticated;
grant select on table public.nextron_action_proposals to authenticated;

create index if not exists idx_nextron_action_proposals_user_status_created
  on public.nextron_action_proposals(user_id, status, created_at desc);

create index if not exists idx_nextron_action_proposals_conversation_pending
  on public.nextron_action_proposals(conversation_id, status)
  where status = 'pending';

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
  if p_action_type not in ('life_pulse.task.create', 'life_pulse.task.update', 'life_pulse.project.update', 'life_pulse.reminder.create') then
    raise exception 'UNSUPPORTED_ACTION';
  end if;
  if p_risk_level not in ('low', 'sensitive', 'external') then
    raise exception 'INVALID_RISK';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 minutes' then
    raise exception 'INVALID_EXPIRY';
  end if;

  insert into public.nextron_action_proposals (user_id, conversation_id, action_type, validated_payload, preview_payload, risk_level, expires_at)
  values (v_user_id, p_conversation_id, p_action_type, p_validated_payload, p_preview_payload, p_risk_level, p_expires_at)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.nextron_approve_action_proposal(p_proposal_id uuid)
returns public.nextron_action_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.nextron_action_proposals;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.nextron_action_proposals
  set status = case when expires_at <= now() then 'expired' else 'approved_execution_disabled' end,
      approved_at = case when expires_at <= now() then approved_at else now() end,
      finalized_at = now(),
      final_reason = case when expires_at <= now() then 'EXPIRED_ACTION' else 'EXECUTION_DISABLED' end
  where id = p_proposal_id and user_id = v_user_id and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.nextron_action_proposals where id = p_proposal_id and user_id = v_user_id;
    if v_row.id is null then
      raise exception 'PROPOSAL_NOT_FOUND';
    end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.nextron_cancel_action_proposal(p_proposal_id uuid)
returns public.nextron_action_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.nextron_action_proposals;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.nextron_action_proposals
  set status = 'canceled', canceled_at = now(), finalized_at = now(), final_reason = 'USER_CANCELED'
  where id = p_proposal_id and user_id = v_user_id and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.nextron_action_proposals where id = p_proposal_id and user_id = v_user_id;
    if v_row.id is null then
      raise exception 'PROPOSAL_NOT_FOUND';
    end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.nextron_invalidate_conversation_action_proposals(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.nextron_action_proposals
  set status = 'invalidated', finalized_at = now(), final_reason = 'CONVERSATION_DELETED'
  where conversation_id = p_conversation_id and user_id = v_user_id and status = 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.nextron_create_action_proposal(uuid, text, jsonb, jsonb, text, timestamptz) from public, anon;
revoke all on function public.nextron_approve_action_proposal(uuid) from public, anon;
revoke all on function public.nextron_cancel_action_proposal(uuid) from public, anon;
revoke all on function public.nextron_invalidate_conversation_action_proposals(uuid) from public, anon;
grant execute on function public.nextron_create_action_proposal(uuid, text, jsonb, jsonb, text, timestamptz) to authenticated;
grant execute on function public.nextron_approve_action_proposal(uuid) to authenticated;
grant execute on function public.nextron_cancel_action_proposal(uuid) to authenticated;
grant execute on function public.nextron_invalidate_conversation_action_proposals(uuid) to authenticated;

COMMIT;

comment on table public.nextron_action_proposals is
  'Owner-scoped NEXTRON action proposals. Prompt 7 stores approval lifecycle only; no action execution or raw hidden prompts are stored.';
