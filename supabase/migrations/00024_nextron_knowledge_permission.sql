-- Life Pulse NEXTRON Knowledge permission
-- Adds explicit opt-in access to existing Knowledge notes. Existing saved rows remain valid.

BEGIN;

alter table public.nextron_context_preferences
  add column if not exists allow_knowledge boolean not null default false;

alter table public.nextron_context_preferences
  alter column permission_version set default 2;

alter table public.nextron_context_preferences
  drop constraint if exists nextron_context_preferences_permission_version_check;

alter table public.nextron_context_preferences
  add constraint nextron_context_preferences_permission_version_check
  check (permission_version in (1, 2));

COMMIT;

comment on column public.nextron_context_preferences.allow_knowledge is
  'Allows bounded read-only NEXTRON retrieval from existing Knowledge notes when true. Defaults false.';
