# Supabase Migration Deployment (CLI workflow)

Replaces the temporary workaround of pasting SQL into the Supabase SQL Editor.
Future versioned migrations deploy from the dev environment via the pinned
Supabase CLI (`supabase` devDependency, currently 2.119.0).

## One-time setup (human, ~5 minutes)

1. Create a Supabase **personal access token** (Dashboard → Account → Access Tokens).
   It is used ONLY for project linking and `db push` auth.
2. Export it for the current shell only (never commit, never print):
   - PowerShell: `$env:SUPABASE_ACCESS_TOKEN = "..."`
   - bash: `export SUPABASE_ACCESS_TOKEN="..."`
3. Link this repo to the Life Pulse project (ref `pvmrpknuvqsxdzoeowmh`,
   derived from the app's `NEXT_PUBLIC_SUPABASE_URL` — never guess):
   ```
   npx supabase link --project-ref pvmrpknuvqsxdzoeowmh
   ```
4. `db push` also needs the database password on first use: set
   `SUPABASE_DB_PASSWORD` the same shell-only way when prompted.

`SUPABASE_SECRET_KEY` stays reserved for admin QA/RLS provisioning scripts.
Neither credential may enter `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, client code,
logs, or commits (all `.env*` paths are gitignored).

## Every migration

```
npm run db:migrations:status    # local vs remote history
npm run db:migrations:dry-run   # what WOULD apply — review this list
npm run db:migrations:push      # apply pending migrations
npm run db:migrations:status    # confirm the new version is remote
```

Then run live RLS acceptance (`LIFE_PULSE_RLS_LIVE_WRITE_ACK=1 npm run test:rls`
plus any feature-specific live script).

## Manually-applied migrations (00043, 00044)

These were applied via SQL Editor before this workflow existed, so `db push`
may list them as pending. Do NOT reapply. After verifying the schema effects
exist remotely, mark history to match reality:

```
npx supabase migration repair --status applied <version> --linked
```

with `<version>` = the migration timestamp prefix (e.g. `00043`). Verify with
`db:migrations:status` afterwards; the only pending migration must be the
genuinely new one.

## Safety rules

- NEVER `supabase db reset --linked` or any destructive remote command.
- NEVER seed production unless explicitly authorized.
- NEVER `db push --include-all` without reviewing the dry-run list first.
- Order for every future migration: forward migration → tests → dry-run →
  push → status → live RLS acceptance.
