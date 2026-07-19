-- Life Pulse Results RLS Role Hardening (Phase 1.1)
-- Narrows table privileges and policy roles to authenticated users only
-- Version: 0019
-- Depends on: 0018_results_foundation.sql

BEGIN;

-- ============================================
-- REVOKE ALL FROM ANON AND PUBLIC
-- ============================================
revoke all on public.metric_definitions from anon;
revoke all on public.metric_definitions from public;
revoke all on public.metric_entries from anon;
revoke all on public.metric_entries from public;

-- ============================================
-- GRANT CRUD TO AUTHENTICATED ONLY
-- ============================================
grant select, insert, update, delete on public.metric_definitions to authenticated;
grant select, insert, update, delete on public.metric_entries to authenticated;

-- ============================================
-- REVOKE FUNCTION EXECUTE FROM ANON AND PUBLIC
-- ============================================
revoke execute on function public.metric_definition_is_archived(uuid) from anon;
revoke execute on function public.metric_definition_is_archived(uuid) from public;

-- ============================================
-- GRANT FUNCTION EXECUTE TO AUTHENTICATED
-- ============================================
grant execute on function public.metric_definition_is_archived(uuid) to authenticated;

-- ============================================
-- ALTER POLICIES TO TARGET AUTHENTICATED ROLE
-- ============================================

-- metric_definitions policies
alter policy metric_definitions_select_own on public.metric_definitions to authenticated;
alter policy metric_definitions_insert_own on public.metric_definitions to authenticated;
alter policy metric_definitions_update_own on public.metric_definitions to authenticated;
alter policy metric_definitions_delete_own on public.metric_definitions to authenticated;

-- metric_entries policies
alter policy metric_entries_select_own on public.metric_entries to authenticated;
alter policy metric_entries_insert_own on public.metric_entries to authenticated;
alter policy metric_entries_update_own on public.metric_entries to authenticated;
alter policy metric_entries_delete_own on public.metric_entries to authenticated;

COMMIT;

-- ============================================
-- COMMENTS
-- ============================================
comment on policy metric_definitions_select_own on public.metric_definitions is
  'Owner-scoped SELECT restricted to authenticated role. USING: auth.uid() = user_id.';

comment on policy metric_definitions_insert_own on public.metric_definitions is
  'Owner-scoped INSERT restricted to authenticated role. WITH CHECK: auth.uid() = user_id.';

comment on policy metric_definitions_update_own on public.metric_definitions is
  'Owner-scoped UPDATE restricted to authenticated role. USING/WITH CHECK: auth.uid() = user_id.';

comment on policy metric_definitions_delete_own on public.metric_definitions is
  'Owner-scoped DELETE restricted to authenticated role. USING: auth.uid() = user_id.';

comment on policy metric_entries_select_own on public.metric_entries is
  'Owner-scoped SELECT restricted to authenticated role. USING: auth.uid() = user_id.';

comment on policy metric_entries_insert_own on public.metric_entries is
  'Owner-scoped INSERT restricted to authenticated role. WITH CHECK: auth.uid() = user_id AND not archived.';

comment on policy metric_entries_update_own on public.metric_entries is
  'Owner-scoped UPDATE restricted to authenticated role. USING/WITH CHECK: auth.uid() = user_id AND not archived.';

comment on policy metric_entries_delete_own on public.metric_entries is
  'Owner-scoped DELETE restricted to authenticated role. USING: auth.uid() = user_id.';