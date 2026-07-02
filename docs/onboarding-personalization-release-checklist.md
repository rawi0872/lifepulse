# Onboarding Personalization Release Checklist

## 1. Release Summary

This release adds the v1 onboarding personalization slice for Life Pulse.

Feature additions:

- Nullable `profiles.intended_use` column.
- Allowed stored values: `personal`, `business`, `team`, `mixed`, or `null`.
- Onboarding question: "What are you using Life Pulse for?"
- Safe copy-level personalization on `/today`.
- Settings control for changing the user's starting mode.
- Production smoke test update to select "Personal life" during onboarding.

This release does not add:

- Workspace tables.
- Team permissions.
- CRM.
- Business finance.
- AI behavior.
- AI memory.
- Hardware integration.
- Context labels.
- Module hiding.
- Auth redirect changes.

## 2. Required Deployment Order

Deploy in this order only:

1. Apply Supabase migration: `supabase/migrations/00015_profile_intended_use.sql`.
2. Verify the database column and check constraint exist.
3. Deploy the app code.
4. Run the production smoke test after deployment.

Important warning:

- Do not deploy app code before the migration.
- If app code deploys first, `/today`, `/settings`, and onboarding writes may fail because `profiles.intended_use` will not exist yet.

## 3. Pre-Deployment Checks

Before applying the migration or deploying the app:

- Confirm the implementation audit passed.
- Confirm `npm run lint` has no errors.
- Confirm `npm run build` passes.
- Confirm the deployed environment points to the intended Supabase project.
- Confirm access to Supabase SQL editor or migration tooling.
- Confirm the production smoke test credentials are available in `.env.test.local` if the smoke test will be run.
- Confirm it is acceptable for the smoke test to mutate the beta test account before running it.
- Confirm no unrelated release work is being bundled unintentionally.

## 4. Supabase Migration Verification

Apply:

```sql
-- supabase/migrations/00015_profile_intended_use.sql
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
```

Verify column exists:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'intended_use';
```

Expected result:

- `column_name`: `intended_use`.
- `data_type`: `text`.
- `is_nullable`: `YES`.
- `column_default`: `null`.

Verify check constraint exists on `public.profiles`:

```sql
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_intended_use_check';
```

Expected constraint allows:

- `personal`.
- `business`.
- `team`.
- `mixed`.
- `null`.

Verify existing rows remain valid:

```sql
select count(*) as invalid_profile_count
from public.profiles
where intended_use is not null
  and intended_use not in ('personal', 'business', 'team', 'mixed');
```

Expected result:

- `invalid_profile_count = 0`.

Verify invalid values fail:

```sql
begin;

update public.profiles
set intended_use = 'invalid-test-value'
where user_id = auth.uid();

rollback;
```

Expected result:

- The update should fail due to `profiles_intended_use_check`.
- If testing outside an authenticated SQL context, use a known safe test profile and keep the transaction rolled back.

Verify RLS policies were not changed:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;
```

Expected policies should remain the existing own-profile policies:

- Select own profile.
- Insert own profile.
- Update own profile.

No broad read, write, service-style, team, or cross-user policies should be added for this release.

## 5. App Deployment Checks

After migration verification:

- Deploy the app code.
- Confirm deployment uses the commit containing the onboarding personalization changes.
- Confirm environment variables are unchanged unless intentionally updated.
- Confirm no auth redirect settings changed in Supabase or Vercel.
- Confirm the deployed app can load public pages before logged-in QA begins.

## 6. Post-Deployment Smoke Testing

Run the production smoke test only after both migration and app deployment are complete.

Command:

```bash
npm run test:prod
```

Smoke test notes:

- The smoke test has been updated to select "Personal life" during onboarding.
- It targets the configured production URL in `scripts/prod-smoke-test.mjs`.
- It uses credentials from `.env.test.local`.
- It may mutate the beta test account by completing onboarding or changing app data.
- Confirm that account mutation is acceptable before running.

If smoke test fails during onboarding:

- Confirm migration exists in production.
- Confirm the intended-use step is visible.
- Confirm the smoke test can click "Personal life".
- Confirm onboarding still reaches realm selection.
- Confirm profile update can write `intended_use` and `onboarding_completed`.

## 7. Manual QA: New User Onboarding

Run this with a new test account or a reset test account.

New user checks:

- Signup works.
- User reaches `/onboarding`.
- The intended-use question appears: "What are you using Life Pulse for?"
- The user cannot continue from the setup step without selecting an option.
- Each option can be selected:
  - Personal life.
  - Business / entrepreneurship.
  - Team / organization.
  - Mixed use.
- Team option includes early-access/shared-permissions caveat.
- Selecting Personal life allows onboarding to continue.
- Realm selection still appears after intended-use selection.
- Realm selection still requires at least one selected realm.
- Daily Loop step still appears.
- Final summary step still appears.
- Clicking "Enter my dashboard" completes onboarding.
- User redirects to `/today`.
- `profiles.onboarding_completed` is set to `true`.
- `profiles.intended_use` stores the selected value.
- Starter realms are created as before.
- Starter habits/tasks are created as before for new users with no existing habits/tasks.

Database verification for selected value:

```sql
select user_id, onboarding_completed, intended_use
from public.profiles
where user_id = '<test-user-id>';
```

Expected result:

- `onboarding_completed = true`.
- `intended_use` equals the selected value.

## 8. Manual QA: Existing User Null Safety

Run this with an existing account where `profiles.intended_use` is `null`.

Existing-user checks:

- User can log in.
- User can open `/today`.
- User can open `/settings`.
- `/today` falls back to personal-oriented display copy.
- `/settings` shows the Life Pulse setup card.
- No crash occurs when `intended_use` is `null`.
- No automatic database backfill happens just from visiting `/today` or `/settings`.
- Existing habits, tasks, realms, journal, finance, body, mind, goals, projects, and other user data still load normally.

Verify no automatic backfill:

```sql
select intended_use
from public.profiles
where user_id = '<existing-test-user-id>';
```

Expected result after only visiting `/today` or `/settings`:

- `intended_use` remains `null` until the user explicitly saves a Settings value.

## 9. Manual QA: Settings Control

Settings checks:

- `/settings` shows a "Life Pulse setup" card.
- Starting mode dropdown shows:
  - Personal life.
  - Business / entrepreneurship.
  - Team / organization.
  - Mixed use.
- User can change starting mode.
- Save succeeds and shows success feedback.
- Save failure shows error feedback if database update fails.
- Changing starting mode does not trigger re-onboarding.
- Changing starting mode does not change `profiles.onboarding_completed`.
- Changing starting mode does not create workspaces.
- Changing starting mode does not delete data.
- Changing starting mode does not create modules.
- Changing starting mode does not create permissions.
- Changing starting mode does not create CRM, business finance, client, team, AI, or hardware data.
- `/today` copy updates after the saved value is loaded.

Database verification after Settings save:

```sql
select intended_use, onboarding_completed
from public.profiles
where user_id = '<test-user-id>';
```

Expected result:

- `intended_use` equals the saved dropdown value.
- `onboarding_completed` remains unchanged.

## 10. Manual QA: Today Copy Personalization

Today checks by `intended_use`:

Personal:

- Header shows personal-oriented copy.
- Focus prompt is personal-oriented.
- Empty-state copy is personal-oriented.

Business:

- Header shows business-oriented copy.
- Focus prompt asks about business outcome.
- Copy does not imply CRM exists.
- Copy does not imply business finance exists.
- Copy does not imply client portals exist.

Team:

- Header shows team setup / early-access copy.
- Focus prompt refers to team or project outcome.
- Copy does not imply shared permissions exist.
- Copy does not imply members, roles, or team collaboration are active.

Mixed:

- Header shows mixed/context-aware copy.
- Focus prompt refers to life and work.
- Copy does not imply real workspace separation exists yet.
- Copy does not imply cross-workspace data labels exist yet.

General Today safety checks:

- No dashboard data visibility changed.
- No permissions changed.
- No modules are hidden.
- Existing tasks, habits, project tasks, finance overview, Body Pulse, Mind Pulse, goals, passions, journal, XP, and suggested actions still behave as before.

## 11. Manual QA: Auth Redirects

Auth checks:

- Logged-out protected routes redirect to `/login`.
- Logged-in not-onboarded users redirect to `/onboarding`.
- Logged-in onboarded users redirect away from `/onboarding` to `/today`.
- Signup still redirects to `/onboarding` when a session is available.
- Login still redirects to `/today` or `/onboarding` based on `profiles.onboarding_completed`.
- Root route redirect behavior remains unchanged.

Protected routes to spot-check while logged out:

- `/today`.
- `/settings`.
- `/habits`.
- `/tasks`.
- `/projects`.
- `/journal`.

## 12. Rollback Considerations

If migration succeeds but app deployment fails:

- Leave the nullable `profiles.intended_use` column in place.
- The extra nullable column is safe for old app code to ignore.
- Roll back the app deployment if needed.

If app code needs rollback after deployment:

- Roll back the app code.
- Do not drop `profiles.intended_use` unless absolutely necessary.
- Old app code should continue working because it does not depend on or write the extra column.

If migration fails:

- Do not deploy app code.
- Fix migration failure first.
- Re-run migration verification before deploying the app.

If app code was deployed before migration:

- Apply the migration immediately if safe.
- If migration cannot be applied immediately, roll back the app deployment.
- Expect `/today`, `/settings`, and onboarding writes to fail until the schema exists.

If invalid values appear in `profiles.intended_use`:

- Investigate whether future code bypassed the shared helper.
- Correct invalid values before enforcing any future stricter logic.
- Keep the check constraint in place.

## 13. Known Risks

Main risks:

- App code deployed before migration.
- Production smoke test mutates the beta test account.
- Existing users have `intended_use = null`.
- Team/business copy may be interpreted as promising features that do not exist yet.
- Future developers may expand this into workspaces, AI, CRM, or team permissions too early.
- Future code may bypass `src/lib/intendedUse.ts` and attempt invalid values.
- Manual SQL changes could accidentally set invalid values if constraints are removed.

Mitigations:

- Follow migration-first deployment order.
- Confirm smoke-test account mutation is acceptable.
- Keep null fallback behavior in app code.
- Keep copy clear that team collaboration is early-access.
- Keep business copy focused on projects, tasks, meetings, and founder focus.
- Do not add workspace, AI, CRM, team permission, or context-label features in this release.
- Reuse `INTENDED_USE_OPTIONS`, `INTENDED_USE_VALUES`, and `resolveIntendedUse` in future code.

## 14. Release Acceptance Criteria

This release is acceptable when:

- Migration is applied successfully.
- Column exists, is nullable, and has no default.
- Check constraint exists on `public.profiles`.
- Invalid values fail.
- RLS policies are unchanged.
- App deploy succeeds.
- `npm run test:prod` passes after deployment, or any failures are understood and unrelated.
- New-user onboarding completes and saves `intended_use`.
- Existing null users can load `/today` and `/settings`.
- Settings can update starting mode.
- Today copy changes by intended use only.
- No auth redirects are broken.
- No workspace, team, CRM, AI, hardware, or context-label behavior was introduced.

## 15. Final Release Recommendation

This release should be treated as a schema-first deployment.

Apply and verify the Supabase migration before deploying the app. The app code expects `profiles.intended_use` to exist when loading `/today`, loading `/settings`, and completing onboarding.

After deployment, run the production smoke test and complete manual QA for one new user, one existing null user, Settings updates, Today copy variants, and auth redirects.

Do not expand this release into workspace architecture, module configuration, AI behavior, CRM, or team collaboration. Those remain future planning and implementation work.
