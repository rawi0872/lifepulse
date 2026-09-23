# Web ↔ Mobile Convergence Audit (Prompt 1/3)

Factual implementation audit. Statuses live in `docs/PARITY_MATRIX.md`;
this file records architecture, evidence, and drift with file pointers.

## 1. Actual repo architecture

- **Web**: Next.js 16 + React 19 + Tailwind 4 at the repo **root**.
  Routes under `src/app/` (`today`, `nextron` (alias of `coach`),
  `tasks`, `habits`, `goals`, `projects`, `journal`, `weekly-review`,
  `results`, `life-map`, `knowledge`, `body`, `mind`, `finance` (→
  `/wealth` after convergence 1/3), `insights`, `devices`, `passions`,
  `settings`, `auth` routes, `onboarding`). Server API under
  `src/app/api/` (NEXTRON, conversations, actions, memory, signals,
  attention, context). Route guard in `src/proxy.ts`.
- **Mobile**: Expo Router app in `apps/mobile/` (`app/(tabs)/` five tabs
  + hidden `account`/`settings`; top-level `body`, `wealth`, `health`,
  `realms`, auth screens). Per-feature service modules in
  `apps/mobile/lib/`.
- **Shared**: `packages/domain` (`@lifepulse/domain`, ESM TS, no build
  step). Web resolves it via root `tsconfig.json` paths; mobile via
  Metro `extraNodeModules` (`apps/mobile/metro.config.js`). Node tests
  import it relatively (see `scripts/test-parity-v1.mjs` + root loader).
- **Data**: Supabase Postgres + RLS. Canonical tables: `tasks`,
  `habits`, `habit_logs`, `today_priorities`, `realms`,
  `finance_accounts`, `finance_transactions`, `finance_categories`,
  `finance_budgets`, `finance_recurring_items`, `finance_preferences`,
  `health_records`, `health_preferences`, `health_sources`, `goals`,
  `projects`, `nextron_conversations` (+ messages/proposals/memories).
  Migrations in `supabase/migrations/`. There is **no parallel
  `wealth_*` table system** (`00041_wealth_foundation.sql` extends
  `finance_*` in place by design).
- **NEXTRON**: single server layer `src/lib/nextron/` served from
  `POST /api/nextron/ask`. Mobile uses Bearer auth, web uses cookie
  session; both verified server-side (`resolveNextronAuth`). Same
  endpoint, same provider, same deterministic branches.

## 2. Findings by area (with evidence)

### Tasks
- Web write path was hand-rolled: 200-char titles, raw priority
  strings, unvalidated due dates, no single-flight, no form error, no
  load retry, delete orphaned task XP (`src/app/tasks/page.tsx`
  pre-convergence lines 204–328). Mobile used domain builders.
- **Converged (Prompt 1/3)**: web `save()`/`quickCreate()` now go
  through `normalizeItemTitle`, `isValidItemTitle`,
  `buildTaskUpdatePayload`, `isValidLocalDateString`,
  `MAX_ITEM_TITLE_LENGTH`; module single-flight guards for
  save/remove; inline `formError` + load error with retry; delete
  cleans `xp_events(source_type="task")`; optimistic removal via
  `removeDeletedById`.
- Remaining (→ Prompt 2): web query bounds (mobile caps 50 / status
  filter / due-date order); XP-on-toggle is web-surface gamification
  (mobile has none) — documented, not drift.

### Habits
- Web created non-canonical `frequency="times_per_week"` rows with raw
  unsanitized `days_of_week` (including `[]` = never-due) and no
  realm bootstrap (NOT NULL hazard). Mobile canonical model:
  `daily`/`weekdays`/`weekly` via `normalizeHabitSchedule`.
- **Converged (Prompt 1/3)**: web form writes canonical frequencies
  only (`daily`/`weekdays`/`weekly` with stepper); all writes go
  through `normalizeHabitSchedule`/`buildHabitUpdatePayload`;
  legacy `times_per_week` rows are coerced to `weekly` (preserving N)
  on edit; realm bootstrap mirrors mobile; guards + errors + XP
  cleanup symmetric with tasks.
- Streak math already shared (`getCurrentStreak`, `getWeeklyProgress`,
  Monday-start weeks on both). Log window differs (web full history
  vs mobile week-scoped) — documented, → Prompt 2.

### Today
- Ordinary ranking was already shared (`normalizeTodayData`,
  `selectMorningPlanFirstAction`).
- **Converged (Prompt 1/3)**: web now runs the same max-one-hero
  competition (`selectTodayPrimaryCandidate`) against a bounded
  deterministic wealth candidate loader mirroring mobile
  (`loadWebWealthTodayCandidate`: recurring due-7d/overdue-30d,
  realm-filtered tasks/habits, `deriveWealthSignalsV2`, strong-only,
  fail-closed) plus done/total focus header.
- Web extras (streaks, XP toasts, attention bridge, evening shutdown)
  are additive surfaces, not ranking drift.

### NEXTRON
- Same endpoint + provider + deterministic branches for both
  clients; redaction server-side (`safeText`, `boundedString`,
  `isForbiddenText`, numeric grounding, action allowlist, no deletes,
  no calendar writes). Mobile Bearer vs web cookie both verified.
- Mobile cannot propose/approve/execute (read-only hint) — positive
  security property, preserved.
- **Known duplication (no bypass)**: web `src/lib/nextron/context.ts`
  vs mobile `nextron-{health,wealth}-permissions.ts`; domain
  `health-privacy.ts` unused by both runtimes. Both implementations
  are fail-closed and semantically aligned
  (`effective = allowed ∩ nextronAllowed`, master gates).
  Single-shared-import is → Prompt 2.
- `buildNextronProviderInput` omits the `body` section (wealth only)
  — shared behavior; confirm intentional before adding (Prompt 2).

### Body
- Mobile: HealthKit/Health Connect → `health_records`, gated by
  `health_preferences`, trends/goals/consent UI.
- Web: manual Body Pro (`body_metrics`, `workouts`, `nutrition_logs`,
  `body_measurements`, `health_notes`, `body_profiles`) + realm-joined
  habits/tasks. Makes no device-read claims (`/devices` is an
  explicit preview). NEXTRON body gating exists only server-side.
- **Platform exception** (documented in matrix): Android ingestion vs
  web manual + synced display.

### Wealth
- Storage is already canonical (`finance_*` only). Web UI was a
  subset with stale semantics.
- **Converged (Prompt 1/3)**: route `/finance` → `/wealth` (+ redirect
  stub), core display strings Finance → Wealth, NEXTRON wealth master
  toggle in Settings, canonical copy map (`domain/copy.ts`).
- **Deferred (→ Prompt 2)**: recurring/goals/budgets-currency UI,
  stored-balance invariant, transfer/adjustment flows, per-currency
  semantics + unknown bucket, section toggles, bounded insights,
  remaining label sweep.

### Themes / navigation / settings / copy
- Web was dark-only with no provider. **Converged (Prompt 1/3)**:
  `ThemeProvider` (System/Light/Dark, localStorage, OS-follow, same
  key/values contract as mobile) + light variable set + Settings
  Appearance section. Per-page visual polish → Prompt 2.
- **Converged (Prompt 1/3)**: `/realms` hub (Body/Wealth cards),
  `/account` → settings redirect, Settings Connections rows (Health
  Connections info + wealth NEXTRON master toggle).
- Copy: core Finance→Wealth + realm/frequency/Today labels converged
  via `domain/copy.ts`; deep label sweep → Prompt 2.

## 3. Duplicate/dead logic removed
- Web task/habit write validation, schedule normalization, and
  single-flight logic deleted in favor of domain imports (net code
  removed from both pages).
- `getDueDateLabel` (web) retained: it is presentation copy, correctly
  layered over `hasInvalidTaskDueDate` — not duplication.

## 5. Prompt 2/3 closure notes (appendix — history above preserved)

- **Wealth**: web now implements accounts (edit/archive/canonical types/institution), manual-first balances, transfer/adjustment flows with paired-leg cleanup, per-base-currency cash flow with unknown/foreign honesty, budget currency (+unknown display), recurring CRUD + advance, truthful goals, base-currency preference, master + section NEXTRON toggles, and bounded `deriveWealthInsights` (max 5). No `wealth_*` tables; `finance_*` only.
- **Body**: web Synced tab reads `health_records` (60d display-only) + `health_preferences`/`health_sources` visibility, 7D/30D `getBodyMetricTrend` cards, quantitative goals with `getBodyGoalProgress`, consent shown read-only. No browser ingestion; no device-read claims.
- **NEXTRON permissions**: single domain module (`nextron-permissions.ts`) consumed by mobile helpers and web evidence builder. Action routes (propose/list/approve/cancel) + signals route accept Bearer via `resolveNextronAuth` (same contract as ask). Mobile approves/rejects through the same RPCs (exact-once, owner-isolated, expiring). No BLOCKED items remain.
- **Conversations**: mobile deletes (long-press + confirm), views/forgets memory, reads signals. Same server enforcement.
- **Today**: web focus/visibility revalidate + bounded queries (500). Habit logs: both 365d/5000; canonical `weekly` honors N (shared streak fix, friction test updated to correct semantics).
- **Auth**: mobile reset redirect derived from web origin; remembered email on both (same key); birth validation messages aligned.
- **Life-map**: real route, added to proxy guards.
- **Terminology**: core surfaces say Wealth/Body/NEXTRON; knowledge content tags and legacy realm-title keys intentionally kept (persisted user data).
- **Body AI evidence**: explicitly wired when allowed — metric names + one summary line only, never raw records.
- **Visual**: theme vars applied across nav, cards, dialogs, forms, errors, coach, onboarding, today/town surfaces; NEXTRON keeps attention-cyan brand + orbit art as deliberate identity (like realm colors); `on-accent`/`on-danger` text tokens.
- **Remaining for Prompt 3**: physical/browser acceptance only. No known defects, no pending migrations, no BLOCKED items.

## 4. Migration / RLS posture
- No new migrations in Prompt 1/3. Realm bootstrap (habits) and
  `finance_preferences` upsert (wealth toggle) reuse existing tables
  and RLS paths already exercised by mobile. No service-role usage,
  no secrets, no production writes (all verification is build/test/
  static; no device acceptance in Prompt 1 by schedule).
