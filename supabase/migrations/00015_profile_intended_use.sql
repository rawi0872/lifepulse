alter table public.profiles
  add column if not exists intended_use text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_intended_use_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_intended_use_check
      check (
        intended_use is null
        or intended_use in ('personal', 'business', 'team', 'mixed')
      );
  end if;
end;
$$;
