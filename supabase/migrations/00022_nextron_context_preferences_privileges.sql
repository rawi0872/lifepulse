-- Life Pulse NEXTRON Context Preferences Privilege Hardening
-- Normalizes application-role table privileges after 00021.

BEGIN;

revoke all privileges on table public.nextron_context_preferences from anon;
revoke all privileges on table public.nextron_context_preferences from public;
revoke all privileges on table public.nextron_context_preferences from authenticated;

grant select, insert, update, delete on table public.nextron_context_preferences to authenticated;

COMMIT;
