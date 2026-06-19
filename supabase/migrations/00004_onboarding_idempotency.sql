-- Prevent duplicate realms per user
-- Uses DO block for idempotent constraint addition (valid PostgreSQL)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'realms_user_name_unique'
  ) then
    alter table public.realms
      add constraint realms_user_name_unique unique (user_id, name);
  end if;
end;
$$;
