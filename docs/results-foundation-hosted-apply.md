# Results Foundation — Hosted Migration Apply Guide

## Migration Files
**supabase/migrations/00018_results_foundation.sql** (must apply first)
**supabase/migrations/00019_results_rls_role_hardening.sql** (must apply second)

## Tables Created
1. `public.metric_definitions`
2. `public.metric_entries`

## Ownership Model
- `metric_definitions.user_id` → `auth.users(id)` ON DELETE CASCADE
- `metric_entries.user_id` → `auth.users(id)` ON DELETE CASCADE
- `metric_entries.metric_definition_id` → `metric_definitions(id)` ON DELETE CASCADE
- **Composite FK**: `metric_entries(metric_definition_id, user_id)` → `metric_definitions(id, user_id)` ON DELETE CASCADE
  - This blocks any INSERT into `metric_entries` where the definition belongs to another user

## Archived Metric Enforcement
**Database-level protection** for archived definitions:
- Function `public.metric_definition_is_archived(definition_id uuid)` returns boolean
- INSERT policy on `metric_entries` requires `NOT metric_definition_is_archived(definition_id)`
- UPDATE policy on `metric_entries` requires `NOT metric_definition_is_archived(metric_definition_id)`
- Application should also enforce but database is the source of truth

**Archived behavior:**
- SELECT existing entries: allowed to owner
- INSERT new entry: denied while archived
- UPDATE existing entry: denied while archived
- DELETE existing entry: allowed to owner
- Unarchive definition: allowed to owner

## Migration Apply Order
1. Apply `supabase/migrations/00018_results_foundation.sql` in Supabase SQL Editor
2. Wait for completion
3. Apply `supabase/migrations/00019_results_rls_role_hardening.sql` in Supabase SQL Editor
4. Wait for completion
5. Verify schema (see Hosted Verification Queries below)
6. **Only then** deploy application code

**Important:** 00018 must be applied before 00019. 00019 narrows Results access to authenticated users only:
- `anon` and `PUBLIC` table privileges are revoked on both tables
- `authenticated` receives SELECT, INSERT, UPDATE, DELETE on both tables
- All eight Results policies target `authenticated` role
- Function `public.metric_definition_is_archived(uuid)` EXECUTE is revoked from `anon` and `PUBLIC`, granted to `authenticated`

## Hosted Verification Queries

### 1. Schema Existence
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('metric_definitions','metric_entries');
```

### 2. Composite FK Exists
```sql
SELECT conname, contype, confrelid::regclass
FROM pg_constraint
WHERE conrelid = 'public.metric_entries'::regclass
  AND contype = 'f';
```

### 3. RLS Enabled
```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('metric_definitions','metric_entries');
```

### 4. Policies Exist
```sql
SELECT polname, polcmd, polpermissive
FROM pg_policy
WHERE polrelid IN ('metric_definitions'::regclass, 'metric_entries'::regclass)
ORDER BY polrelid, polcmd;
```

### 5. Composite FK Blocks Cross-User Insert
```sql
-- As test_user_1 (needs two test users)
INSERT INTO metric_entries (user_id, metric_definition_id, value, recorded_at)
VALUES ('test_user_1_uuid', 'test_user_2_definition_uuid', 10, now());
-- Should fail with FK violation
```

### 6. Archived Definition Blocks New Entries
```sql
-- Archive a definition
UPDATE metric_definitions SET archived = true WHERE id = 'some_def_uuid';

-- Try to insert entry
INSERT INTO metric_entries (user_id, metric_definition_id, value, recorded_at)
VALUES (auth.uid(), 'some_def_uuid', 10, now());
-- Should fail with policy violation
```

### 7. Archived Definition Allows Read/Delete of Existing Entries
```sql
-- As owner of archived definition
SELECT * FROM metric_entries WHERE metric_definition_id = 'archived_def_uuid';
-- Should succeed

DELETE FROM metric_entries WHERE id = 'some_entry_id';
-- Should succeed
```

### 8. No Anonymous/Public Access (Policies)
```sql
SELECT polname FROM pg_policy
WHERE polrelid IN ('metric_definitions'::regclass, 'metric_entries'::regclass)
  AND (polroles @> '{anon}'::oid[] OR polroles @> '{public}'::oid[]);
-- Should return 0 rows
```

### 9. Composite FK Blocks Cross-User
```sql
-- User A tries to use User B's definition
INSERT INTO metric_entries (user_id, metric_definition_id, value, recorded_at)
VALUES ('user_a_uuid', 'user_b_definition_uuid', 42, now());
-- Should fail: composite FK requires definition.user_id = entries.user_id
```

### 10. Table Privileges (00019 Hardening)
```sql
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('metric_definitions','metric_entries')
ORDER BY table_name, grantee;
```
Expected:
- `authenticated` has SELECT, INSERT, UPDATE, DELETE on both tables
- `anon` has no privileges on either table
- `PUBLIC` has no privileges on either table

### 11. Function EXECUTE Privileges (00019 Hardening)
```sql
SELECT
  routine_schema,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'metric_definition_is_archived'
ORDER BY grantee;
```
Expected:
- `authenticated` has EXECUTE
- `anon` has no EXECUTE
- `PUBLIC` has no EXECUTE

### 12. Policy Roles (00019 Hardening)
```sql
SELECT polname, polcmd, polroles
FROM pg_policy
WHERE polrelid IN ('metric_definitions'::regclass, 'metric_entries'::regclass)
ORDER BY polrelid, polcmd;
```
Expected: All eight policies show `polroles` containing only `authenticated` (no `anon`, no `public`)

## RLS Verification Procedure (Two Test Users)

1. Create two test users in Supabase Auth (e.g., `test1@lifepulse.local`, `test2@lifepulse.local`)
2. Sign in as test1, create a metric definition via SQL or app
3. Sign in as test2, attempt to:
   - SELECT test1's definition → should return 0 rows
   - INSERT entry under test1's definition → should fail (FK + RLS)
4. Sign in as test1, verify:
   - Own definition visible
   - Can insert/update/delete own entries
   - Cannot see test2's definitions

## Rollback Guidance
If critical issue after deploy:
1. **Code rollback**: `git revert <commit>` → redeploy (feature flag `NEXT_PUBLIC_RESULTS_SYSTEM=false` disables UI)
2. **Schema rollback** (only if absolutely necessary, no user data yet):
   ```sql
   DROP TABLE IF EXISTS public.metric_entries CASCADE;
   DROP TABLE IF EXISTS public.metric_definitions CASCADE;
   DROP FUNCTION IF EXISTS public.metric_definition_is_archived(uuid);
   ```
   - No data migration needed (Phase 1 is greenfield)

## Known Phase 1 Limitations
- No domain adapters (Body, Mind, Finance, Passions, Goals remain separate)
- No templates in database (static TS config only)
- No `metric_targets` table (baseline/target on definition)
- No `result_milestones` table
- No Weekly Review / Insights / Coach integration
- No charts, sparklines, or sparkline components
- No UI components (`/results` page not built)
- Rating scale fixed 1–10 (custom scales Phase 3+)
- No currency conversion (single currency per metric)
- No derived metrics (BMI, etc.)
- No device sync (`source='device'` reserved)
- No sub-metrics (1RM, 5RM, volume as separate definitions)

## Confirmation
- [ ] No existing records migrated (greenfield tables)
- [ ] No application code deployed yet
- [ ] Migration applied only to hosted Supabase
- [ ] Verification queries all pass
- [ ] RLS verified with two test users

**Do not deploy application code until all verification queries pass.**