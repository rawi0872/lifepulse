# Production Onboarding QA Account Strategy

## Purpose

Life Pulse needs a safe, repeatable way to test production onboarding flows without mutating the main beta smoke-test account.

This strategy supports QA for:

- New-user onboarding.
- Intended-use selection.
- Onboarding completion.
- Settings starting-mode updates.
- Existing-user `intended_use = null` safety.
- Future onboarding changes.

The immediate goal is not to automate everything. The immediate goal is to make production onboarding QA safe, explicit, and resettable.

## Why Not Use The Main Smoke-Test Account

The broad production smoke test uses:

- `LIFE_PULSE_TEST_EMAIL`.
- `LIFE_PULSE_TEST_PASSWORD`.

That account should not be used for onboarding QA because:

- It is already onboarded, so it cannot naturally test first-run onboarding.
- Resetting it would break the broad production smoke test baseline.
- The broad smoke test mutates app data across many modules.
- Onboarding tests need a clean not-onboarded state.
- Settings mode changes would alter a shared beta QA account.

Rule:

- Do not run focused onboarding QA against `LIFE_PULSE_TEST_EMAIL` unless the test owner explicitly allows it with `LIFE_PULSE_ONBOARDING_ALLOW_MAIN_ACCOUNT=true` and accepts the mutation risk.

## Recommended Near-Term Strategy

Use a dedicated production onboarding QA account.

Recommended account type:

- A real Supabase Auth user created specifically for onboarding QA.
- Not used by the broad smoke test.
- Reset manually in Supabase SQL Editor before each onboarding QA run.
- Used only with `scripts/onboarding-personalization-prod-test.mjs`.

Recommended naming:

- Email should clearly identify its purpose, such as `lifepulse-onboarding-qa@example.com`.
- Do not use a real customer email.
- Do not use the main beta smoke-test account.

Why this is the best near-term option:

- It avoids disposable user buildup.
- It avoids service-role automation for now.
- It works even if production signup requires email confirmation.
- It keeps destructive reset steps manual and visible.
- It supports repeatable onboarding QA with one known account.

## Required Environment Variables

Use these variables in `.env.test.local` or the local shell.

Required for the focused onboarding QA script:

```env
LIFE_PULSE_ONBOARDING_TEST_EMAIL=lifepulse-onboarding-qa@example.com
LIFE_PULSE_ONBOARDING_TEST_PASSWORD=replace_with_test_password
```

Optional:

```env
LIFE_PULSE_PROD_BASE_URL=https://lifepulse-sand.vercel.app
LIFE_PULSE_TEST_HEADLESS=true
LIFE_PULSE_ONBOARDING_TEST_SETTINGS_UPDATE=true
```

Do not commit real values.

The focused script intentionally refuses to use `LIFE_PULSE_TEST_EMAIL` by default.

## How To Create The Dedicated Onboarding QA Account

Recommended manual setup:

1. In Supabase Dashboard, open the target production project.
2. Go to Authentication.
3. Create a user for onboarding QA, or sign up through the production UI once and confirm the account if email confirmation is required.
4. Set a known password for the QA owner.
5. Confirm a row exists in `public.profiles` for the user.
6. Add the account credentials to local `.env.test.local` using `LIFE_PULSE_ONBOARDING_TEST_EMAIL` and `LIFE_PULSE_ONBOARDING_TEST_PASSWORD`.
7. Reset the account to not-onboarded state using the manual SQL process below.

Do not create this account with a service-role key in frontend code.

## Manual Reset Overview

Before each focused onboarding QA run, reset the dedicated account to behave like a fresh not-onboarded user.

Conceptual reset:

- Set `profiles.onboarding_completed = false`.
- Set `profiles.intended_use = null`.
- Remove app data owned by that QA user if it was created by previous onboarding or QA runs.
- Keep the Auth user itself.
- Never affect real users.
- Never affect the main beta smoke-test account.

This reset should be performed in Supabase SQL Editor by an authorized admin.

## Manual Reset Safety Checklist

Before running reset SQL:

- Confirm you are in the correct Supabase project.
- Confirm the email belongs to the dedicated onboarding QA account.
- Confirm the email is not `LIFE_PULSE_TEST_EMAIL`.
- Confirm the account is not a real user.
- Confirm the SQL targets exactly one `auth.users` row.
- Run the preview query first.
- Run reset SQL inside a transaction.
- Review row counts where possible.
- Commit only after confirming the target user is correct.

## Preview The Target User

Run this first and verify exactly one row is returned.

```sql
select
  u.id as user_id,
  u.email,
  p.onboarding_completed,
  p.intended_use,
  p.created_at as profile_created_at
from auth.users u
left join public.profiles p on p.user_id = u.id
where lower(u.email) = lower('lifepulse-onboarding-qa@example.com');
```

Expected:

- Exactly one row.
- Email is the dedicated onboarding QA account.
- Email is not the main beta smoke-test account.

## Conservative Manual Reset SQL

Use this only for the dedicated onboarding QA account.

Replace `lifepulse-onboarding-qa@example.com` before running.

```sql
begin;

do $$
declare
  target_email text := 'lifepulse-onboarding-qa@example.com';
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email);

  if target_user_id is null then
    raise exception 'No auth user found for %', target_email;
  end if;

  if lower(target_email) in (
    lower('lifebulse@gmail.com'),
    lower('replace_main_smoke_test_email_if_different@example.com')
  ) then
    raise exception 'Refusing to reset main smoke-test account: %', target_email;
  end if;

  -- Delete dependent/link rows before parent rows.
  delete from public.knowledge_collection_items where user_id = target_user_id;
  delete from public.knowledge_collections where user_id = target_user_id;
  delete from public.knowledge_items where user_id = target_user_id;

  delete from public.passion_sessions where user_id = target_user_id;
  delete from public.passion_milestones where user_id = target_user_id;
  delete from public.passions where user_id = target_user_id;

  delete from public.workout_exercises where user_id = target_user_id;
  delete from public.workouts where user_id = target_user_id;
  delete from public.nutrition_logs where user_id = target_user_id;
  delete from public.body_measurements where user_id = target_user_id;
  delete from public.health_notes where user_id = target_user_id;

  delete from public.body_metrics where user_id = target_user_id;
  delete from public.mind_metrics where user_id = target_user_id;

  delete from public.finance_transactions where user_id = target_user_id;
  delete from public.finance_budgets where user_id = target_user_id;
  delete from public.finance_categories where user_id = target_user_id;
  delete from public.finance_accounts where user_id = target_user_id;

  delete from public.goal_links where user_id = target_user_id;
  delete from public.goal_milestones where user_id = target_user_id;
  delete from public.goals where user_id = target_user_id;

  delete from public.xp_events where user_id = target_user_id;
  delete from public.habit_logs where user_id = target_user_id;
  delete from public.habits where user_id = target_user_id;
  delete from public.tasks where user_id = target_user_id;
  delete from public.projects where user_id = target_user_id;
  delete from public.journal_entries where user_id = target_user_id;
  delete from public.realms where user_id = target_user_id;

  update public.profiles
  set onboarding_completed = false,
      intended_use = null
  where user_id = target_user_id;

  if not found then
    insert into public.profiles (user_id, onboarding_completed, intended_use)
    values (target_user_id, false, null)
    on conflict (user_id) do update
      set onboarding_completed = excluded.onboarding_completed,
          intended_use = excluded.intended_use;
  end if;
end $$;

commit;
```

Important notes:

- This SQL intentionally deletes app data for the dedicated QA user only.
- It does not delete the Auth user.
- It should not be used for real users.
- It should not be used for the main beta smoke-test account.
- The table list is based on current migrations. Re-check migrations before using this reset after future schema changes.

## Post-Reset Verification

After reset, run:

```sql
select
  u.id as user_id,
  u.email,
  p.onboarding_completed,
  p.intended_use,
  (select count(*) from public.realms where user_id = u.id) as realms_count,
  (select count(*) from public.habits where user_id = u.id) as habits_count,
  (select count(*) from public.tasks where user_id = u.id) as tasks_count
from auth.users u
join public.profiles p on p.user_id = u.id
where lower(u.email) = lower('lifepulse-onboarding-qa@example.com');
```

Expected:

- `onboarding_completed = false`.
- `intended_use = null`.
- `realms_count = 0`.
- `habits_count = 0`.
- `tasks_count = 0`.

## Running Focused Onboarding QA

After reset and env setup:

```bash
npm run test:prod:onboarding
```

The script verifies:

- Dedicated account reaches onboarding.
- Intended-use question appears.
- User cannot continue without intended-use selection.
- `Personal life` can be selected.
- Realm selection still appears.
- Daily Loop step still appears.
- Onboarding completes.
- User reaches `/today`.
- `/today` shows expected personal copy.
- `/settings` shows the Life Pulse setup card.

To also test Settings mode update:

```env
LIFE_PULSE_ONBOARDING_TEST_SETTINGS_UPDATE=true
```

Then run:

```bash
npm run test:prod:onboarding
```

This mutates the dedicated QA account by saving `business` as the starting mode and checking `/today` business copy.

## Disposable Signup Mode

The focused script supports an explicit disposable signup mode:

```env
LIFE_PULSE_ONBOARDING_CREATE_DISPOSABLE=true
LIFE_PULSE_ONBOARDING_DISPOSABLE_EMAIL_DOMAIN=example.com
LIFE_PULSE_ONBOARDING_DISPOSABLE_PASSWORD=replace_with_test_password
```

Disposable signup is safe only when:

- Production signup returns an immediate authenticated session.
- Email confirmation does not block onboarding.
- Leaving test Auth users behind is acceptable.
- The email domain is controlled by the QA team.

Disposable signup is unsafe or not useful when:

- Supabase email confirmation is required.
- The team does not have a cleanup process.
- The email domain could receive real messages to uncontrolled inboxes.
- The environment has strict user-count or auth-cleanliness requirements.

Near-term recommendation:

- Do not rely on disposable signup for production onboarding QA.
- Use a dedicated resettable QA account instead.

## Existing-User Null Safety QA

Use the same dedicated QA account after setting:

```sql
update public.profiles
set onboarding_completed = true,
    intended_use = null
where user_id = (
  select id from auth.users where lower(email) = lower('lifepulse-onboarding-qa@example.com')
);
```

Then manually verify:

- Login succeeds.
- `/today` loads.
- `/settings` loads.
- Today falls back to personal-oriented copy.
- Visiting pages does not automatically backfill `intended_use`.

Reset the account again before running first-run onboarding QA.

## Security Rules For Service-Role Keys

Service-role keys are powerful and must be treated as production secrets.

Rules:

- Never expose a service-role key to frontend code.
- Never use a service-role key in Next.js client components.
- Never commit a service-role key.
- Never add a service-role key to `.env.example` as a real value.
- Never run admin reset automation without explicit environment targeting and confirmation.
- Prefer Supabase SQL Editor manual reset for now.

If an admin reset script is added later, it must:

- Run locally only.
- Require `SUPABASE_SERVICE_ROLE_KEY` from local env.
- Refuse to run if the target email matches the main smoke-test account.
- Require an explicit confirmation phrase.
- Print the target project URL and target email before reset.
- Reset only one user by exact email.
- Never delete the Auth user by default.
- Be reviewed before use in production.

## What Not To Automate Yet

Do not automate these yet:

- Deleting production Auth users.
- Resetting arbitrary users.
- Resetting by partial email match.
- Resetting the main smoke-test account.
- Creating service-role-powered endpoints in the app.
- Running destructive cleanup as part of the normal smoke test.
- Cross-environment reset commands that can accidentally point at production.

## Future Improvement Path

Recommended future improvements:

1. Create a dedicated `qa_accounts` document listing allowed QA accounts and their purpose.
2. Add a local-only admin reset script after review.
3. Add a confirmation phrase such as `RESET PRODUCTION ONBOARDING QA ACCOUNT`.
4. Add a dry-run mode that prints row counts without deleting.
5. Add exact table coverage tests for future migrations.
6. Add a Supabase edge/admin workflow only if the team has a secure operational model.
7. Create separate QA accounts for onboarding, broad smoke, RLS, and module-specific tests.

## Final Recommendation

For the current private beta, use a dedicated production onboarding QA account and reset it manually through Supabase SQL Editor before each onboarding QA run.

Do not use the main smoke-test account. Do not rely on disposable signup unless email confirmation is disabled and account buildup is acceptable. Do not build an admin reset script until the team is ready to manage service-role secrets and destructive operations safely.
