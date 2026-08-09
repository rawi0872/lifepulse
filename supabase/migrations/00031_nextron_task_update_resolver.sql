-- Life Pulse NEXTRON Task update resolver
-- Provides an owner-scoped exact-title lookup for preparing Task update proposals.

BEGIN;

create or replace function public.nextron_resolve_task_update_target(p_title text)
returns table(id uuid, title text, due_date date, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_title is null or char_length(trim(p_title)) = 0 or char_length(p_title) > 200 then
    raise exception 'INVALID_TITLE';
  end if;

  return query
  select t.id, t.title, t.due_date, t.status
  from public.tasks t
  where t.user_id = v_user_id and t.title = p_title
  order by t.created_at desc
  limit 2;
end;
$$;

revoke all on function public.nextron_resolve_task_update_target(text) from public, anon;
grant execute on function public.nextron_resolve_task_update_target(text) to authenticated;

COMMIT;

comment on function public.nextron_resolve_task_update_target(text) is
  'Owner-scoped exact-title resolver used only to prepare NEXTRON Task update proposals before explicit approval.';
