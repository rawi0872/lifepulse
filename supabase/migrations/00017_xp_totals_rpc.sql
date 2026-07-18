-- Life Pulse exact XP totals RPC
-- Returns exact totals for the authenticated user without transferring every XP row.

create or replace function public.get_xp_totals(p_today_start timestamptz)
returns table(total_xp integer, today_xp integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(amount), 0)::integer as total_xp,
    coalesce(sum(amount) filter (where created_at >= p_today_start), 0)::integer as today_xp
  from public.xp_events
  where user_id = auth.uid();
$$;

grant execute on function public.get_xp_totals(timestamptz) to authenticated;
