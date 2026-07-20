-- Life Pulse Results Authenticated Privilege Minimization
-- Records manual hosted least-privilege correction for authenticated role
-- Version: 0020
-- Depends on: 0019_results_rls_role_hardening.sql

BEGIN;

-- ============================================
-- REVOKE ALL FROM AUTHENTICATED
-- ============================================
revoke all on table public.metric_definitions from authenticated;
revoke all on table public.metric_entries from authenticated;

-- ============================================
-- GRANT CRUD ONLY TO AUTHENTICATED
-- ============================================
grant select, insert, update, delete
on table public.metric_definitions
to authenticated;

grant select, insert, update, delete
on table public.metric_entries
to authenticated;

COMMIT;

-- ============================================
-- COMMENTS
-- ============================================
comment on table public.metric_definitions is
  'User-defined measurable metrics. Baseline and optional target live on the definition row. ' ||
  'authenticated: SELECT, INSERT, UPDATE, DELETE only. ' ||
  'TRUNCATE, TRIGGER, REFERENCES intentionally revoked.';

comment on table public.metric_entries is
  'Recorded measurements. Immutable after insert (no updated_at). Composite FK enforces same-user ownership. ' ||
  'authenticated: SELECT, INSERT, UPDATE, DELETE only. ' ||
  'TRUNCATE, TRIGGER, REFERENCES intentionally revoked.';