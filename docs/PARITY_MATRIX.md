# Life Pulse Web ↔ Mobile Parity Matrix

Permanent engineering artifact. A Life Pulse feature is NOT complete unless
all supported clients implement equivalent capability (see convergence
prompt). Exceptions are allowed ONLY when inherently platform-specific,
and must be explicit, documented, and intentional here.

Clients: **Web** = Next.js app (`src/`), **Mobile** = Expo app
(`apps/mobile/`). Shared truth lives in `packages/domain`
(`@lifepulse/domain`). Server = Next.js API routes (`src/app/api/`) —
NEXTRON is ONE intelligence layer served from `POST /api/nextron/ask`
for both clients.

Statuses: `PARITY` · `PARTIAL` · `MISSING_WEB` · `MISSING_MOBILE` ·
`PLATFORM_SPECIFIC` · `BLOCKED`.

> Updated at the end of convergence Prompt 1/3. Items marked PARTIAL
> with "→ Prompt 2" are explicitly reserved for the feature/UI finish
> pass. Visual parity as a whole remains Prompt 2 owned.

## AUTH

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Sign in | Supabase Auth (shared backend) | `app/login.tsx` + `lib/auth.tsx`, remembered email | `src/app/login/page.tsx` (SSR browser client) | — | PARITY | Same flows/fields; mobile adds remembered-email nudge |
| Sign up | Supabase Auth | `app/signup.tsx` | `src/app/signup/page.tsx` | — | PARITY | Same metadata (first/last/birth/display name) |
| Forgot password | Supabase Auth | `app/forgot-password.tsx` (hardcoded prod redirect — drift, fix in Prompt 2) | `src/app/forgot-password/page.tsx` (dynamic origin) | — | PARTIAL | Same semantics; redirect construction differs |
| Reset password UI | Supabase Auth | — (relies on web link) | `src/app/reset-password/page.tsx` | Mobile defers to web link (intentional) | PLATFORM_SPECIFIC | Documented deferral, not a gap |
| Sign out | Supabase Auth | `lib/auth.tsx` signOut | Settings sign-out card | — | PARITY | — |
| Route protection | — | `Tabs/_layout` redirect | `src/proxy.ts` protectedRoutes + onboarding gate | — | PARITY | `/life-map` missing from proxy list (minor, Prompt 2) |

## TODAY

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Greeting/date | Local date helpers | `app/(tabs)/today.tsx` | `src/app/today/page.tsx` | — | PARITY | — |
| Up Next (ordinary ranking) | `selectMorningPlanFirstAction` | Uses it | Uses it | — | PARITY | Same deterministic result |
| Wealth/Body competition (max-one-hero) | `selectTodayPrimaryCandidate`, `WealthSignalV2` | Uses it (`loadWealthTodayCandidate`) | Uses it (web adapter `loadWebWealthTodayCandidate`, same bounds) | — | PARITY | Closed in convergence 1/3 |
| Body signals | `deriveBodySignals`, flag `BODY_TODAY_SIGNALS_ENABLED=false` | Stub (disabled) | No hero (equivalent output) | — | PARITY | Both show nothing; hook documented |
| Priorities (max 3, counts) | `today-priorities.ts` (type, limit, mapping) | Full CRUD + done/total header | Full CRUD (`src/lib/priorities.ts`) + done/total header | — | PARITY | Same table, limit, 80-char slice |
| Tasks/habits sections | `normalizeTodayData` | Uses it | Uses it | — | PARITY | Same underlying data |
| Focus counts | Domain counts | done/total header + footer | done/total header | — | PARITY | Closed in convergence 1/3 |
| Ask NEXTRON entry | — | Link to NEXTRON tab | Link `/nextron?subject=today` + attention bridge | — | PARITY | Platform-appropriate; same destination |
| Empty/loading/error | — | RefreshControl, focus reload, Alerts | Skeletons, route error boundary, inline banner | — | PARITY | Same honesty, native patterns |
| Focus reload on return | — | `useFocusEffect` reload | Midnight rollover + period timer (no focus reload) | — | PARTIAL | → Prompt 2 (web focus revalidate) |

## TASKS

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| List/grouping | `groupTasksByDate` | Uses it | Uses it | — | PARITY | — |
| Create | `normalizeItemTitle`, `MAX_ITEM_TITLE_LENGTH` (120) | Uses them | Uses them (convergence 1/3) | — | PARITY | Web quick-capture also length-capped |
| Complete/uncomplete | Status flip + `completed_at` | Direct update | `src/lib/taskCompletion.ts` (+25 XP, rollback) | XP is web-surface gamification; mobile has none | PARTIAL | Same core semantics; XP web-only by design (documented) |
| Edit | `buildTaskUpdatePayload` (title/priority/date validation, no-change skip) | Uses it | Uses it (convergence 1/3) | — | PARITY | Same mutation semantics |
| Delete + confirmation | `removeDeletedById`, cascade | `ConfirmDeleteDialog` + optimistic removal | Inline confirm panel + optimistic removal | — | PARITY | Desktop uses inline panel, not long-press |
| Loading/error/empty | — | Skeletons, ErrorBanner+retry, empties | Skeletons, route boundary + inline load error + retry, empties | — | PARITY | Closed in convergence 1/3 |
| Duplicate-submit guard | `createSingleFlight` | `saveGuardRef`/`deleteGuardRef` | Module-level guards for save/remove (convergence 1/3) | — | PARITY | Same single-flight semantics |
| No stale Today afterward | `normalizeTodayData` re-read | Focus reload | `reloadTasks` after every mutation | — | PARITY | — |
| Query bounds | — | `limit(50)`, status filter, due-date order | Unbounded, created-at order | — | PARTIAL | → Prompt 2 (align web query bounds) |

## HABITS

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Canonical schedule model | `normalizeHabitSchedule`: `daily`/`weekdays`/`weekly` (+`WEEKDAY_DAYS` fallback, 1–7 clamp) | Uses it | Uses it (convergence 1/3; web writes canonical `weekly`, legacy `times_per_week` coerced on edit) | — | PARITY | No separate web rules |
| Create | `normalizeItemTitle`, `MAX_ITEM_TITLE_LENGTH` | Uses them + realm bootstrap | Uses them + realm bootstrap (convergence 1/3) | — | PARITY | Realm-less users no longer fail on web |
| Complete/log + undo | Existence check + `habit_logs` row | Direct insert/delete | Same + XP with rollback (`+10`) | XP web-only by design (documented) | PARTIAL | Same core semantics |
| Edit (history-preserving) | `buildHabitUpdatePayload` (definition columns only) | Uses it | Uses it (convergence 1/3) | — | PARITY | Logs/streaks stay valid on both |
| Delete + confirmation | `removeDeletedById` | `ConfirmDeleteDialog` + cascade delete | Inline confirm panel + explicit log/XP cleanup | — | PARITY | Same destructive meaning; web also cleans XP it created |
| Daily / weekdays / weekly | Domain due/streak fns | All three | All three (canonical) | `weekends` legacy read-only on both | PARITY | — |
| Streak/progress display | `getCurrentStreak`, `getBestStreak`, `getWeeklyProgress` | Uses them (week-scoped logs) | Uses them (full-history logs) | Log window differs; web more correct | PARTIAL | → Prompt 2 (align log window or accept documented difference) |
| Loading/error/empty | — | Skeletons, ErrorBanner+retry, empties | Skeletons, inline load error + retry, empties | — | PARITY | Closed in convergence 1/3 |
| Duplicate-submit guard | `createSingleFlight` | `saveGuardRef`/`deleteGuardRef` | Module guards (convergence 1/3) | — | PARITY | — |

## NEXTRON (ONE intelligence layer: `POST /api/nextron/ask` for both)

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Server provider path | `src/lib/nextron/*` (evidence, provider, actions, memory, signals) | Bearer `Authorization` → same endpoint | Cookie session → same endpoint | Transport auth differs; both verified server-side (`resolveNextronAuth`) | PARITY | No separate AI behavior |
| Conversation history | `nextron_conversations` + messages (limit 120) | List + auto-open first | List + open + create + delete | Mobile lacks create/delete UI | PARTIAL | → Prompt 2 (mobile conversation management); server enforces ownership either way |
| Starter state | — | Starters + permission summary | Starters + composer (500 chars) | — | PARITY | — |
| Live response + thinking state | — | `sending` + preparing bubble | `thinking/syncing` states, 35s timeout + retry | — | PARITY | — |
| Permission model (Body) | `health-privacy.ts` contract (unused by runtimes) + `health_preferences` table | `nextron-health-permissions.ts`: `effective = nextronAllowed ∩ allowed`, fail-closed | `evidence.ts`: same intersection, fail-closed | Helpers duplicated, semantically aligned | PARTIAL | → Prompt 2 (single shared import); no bypass today |
| Permission model (Wealth) | `finance_preferences` table | `nextron-wealth-permissions.ts`: master-gated sections, fail-closed | `evidence.ts` + `wealth-evidence.ts`: same gate | Same as Body | PARTIAL | Same disposition |
| Evidence redaction | Server `safeText`/`boundedString`/`isForbiddenText`/numeric grounding | Inherited (client sends no raw data) | Inherited | — | PARITY | Redaction lives server-side for both |
| Action proposals + approval | Server allowlist, 15-min expiry, exact-title revalidation, `EXECUTION_DISABLED` | Read-only hint ("review and approve on web") | Full propose/list/approve/cancel UI | Mobile cannot approve by design (positive security property) | PARITY | Permission ≠ approval on both |
| Failure behavior | Calm error mapping | `toCalmNextronError` | `AskFailureCode` + retry | — | PARITY | — |
| Memory (explicit-only) | `memory.ts`: `remember that` gate, no auto-monitoring | Via prompt text (same endpoint) | Via prompt text + memory CRUD in Settings | No memory UI on mobile | PARTIAL | → Prompt 2; enforcement identical |
| Signals/attention | `signals.ts`, `attention.ts` (deterministic) | Not fetched | Fetched + displayed | Mobile omits observability only | PARTIAL | → Prompt 2; no enforcement divergence |
| Body section in AI prompt | `buildNextronProviderInput` omits `body` (only wealth) | — | — | Shared behavior | PARITY | Confirm intentional before adding (Prompt 2) |
| Request length limits | Server `parseNextronUserRequest` decides | Client 2000 | Client 500 | Server is decider | PARITY | — |

## BODY

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Realm overview | `body.ts` (summary, activity level, freshness) | `app/body.tsx` + `body-service.ts` | Manual Body Pro overview (metrics/workouts/nutrition/measurements/notes) | Different data sources (below) | PARTIAL | → Prompt 2 (shared summary cards) |
| Metric display + trends | `getBodyMetricTrend` (7D/30D, coverage-gated) | 6-key grid + trend cards | Manual `body_metrics` form + naive averages | Web lacks trend engine | PARTIAL | → Prompt 2 |
| Goals (quantitative) | `BodyGoalProgress` | Inline goal create + progress | Free-text `body_profiles.body_goal` only | — | PARTIAL | → Prompt 2 |
| Storage consent + NEXTRON toggles | `health-privacy.ts` three layers | Health Connections screen (per-metric) | None in UI (backend gating only) | — | PARTIAL | → Prompt 2 (web consent visibility; toggles stay mobile-gated for ingestion) |
| Synced data visibility | `health_records` (server-synced) | Reads it | Does not read it | — | PARTIAL | → Prompt 2 (web displays synced normalized data) |
| Platform exception | — | ANDROID: Health Connect ingestion → `health_records` gated by `health_preferences.allowed_metrics`; NEXTRON by `nextron_allowed_metrics` | WEB: manual tracking + display of synced normalized data only; never reads device APIs; `/devices` is an explicit preview with no import | Explicit, intentional | PLATFORM_SPECIFIC | No silent divergence; web makes no device-read claims |

## WEALTH (canonical model = `finance_*` tables; NO parallel `wealth_*` system)

| Capability | Shared/domain | Mobile | Web (`/wealth`, renamed from `/finance` in convergence 1/3) | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Accounts (+archive) | `wealth.ts` account types | Full CRUD + archive | Read subset + create + hard delete only | — | PARTIAL | → Prompt 2 (edit/archive, canonical types `checking/credit_card/loan/asset/liability`) |
| Stored-balance invariant | `wealth.ts`: transactions do NOT mutate balances | Respected | Violated (derived `start+in−out`) | — | PARTIAL | → Prompt 2 (adopt invariant; changes displayed numbers — needs care) |
| Transactions (incl. transfer/adjustment + paired legs) | `linked_transaction_id` | Full incl. paired transfers + linked cleanup | income/expense only, single-row delete | — | PARTIAL | → Prompt 2 |
| Cash flow (per-currency, MTD-comparable) | `wealth-intelligence.ts` | Per-currency, comparable bounds | Cross-currency sums, full-month deltas | — | PARTIAL | → Prompt 2 |
| Budgets (+currency) | `getWealthBudgetStatuses` | Currency chips + statuses | No currency, always on-track-capable | — | PARTIAL | → Prompt 2 |
| Recurring items | `getWealthRecurringIntelligence` | Full CRUD + advance | Absent | — | MISSING_WEB | → Prompt 2 |
| Goals (truthful progress) | `getWealthGoalProgress` | Full CRUD + progress | Absent | — | MISSING_WEB | → Prompt 2 |
| Currency semantics + unknown bucket | `parseWealthAmount`, `__unknown` isolation | Chips, validation, base currency pref | Free-text currency, env default ILS, no unknown bucket | — | PARTIAL | → Prompt 2 |
| NEXTRON permissions (master + 5 sections) | `finance_preferences` | Inline toggles on Wealth screen | Master toggle in Settings (convergence 1/3); sections in NEXTRON evidence only | — | PARTIAL | → Prompt 2 (full section UI on web) |
| Bounded insights | `deriveWealthInsights` + data contract | Uses them | Local unbounded `computeInsights` | — | PARTIAL | → Prompt 2 |
| Terminology | `REALM_NAMES.wealth = "Wealth"` (`domain/copy.ts`) | "Wealth" | "Wealth" (renamed in convergence 1/3) | Storage prefix stays `finance_*` by design | PARITY | Display strings converged |

## REALMS

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Body access | `REALM_NAMES` | Realms hub → `/body` | `/realms` hub → `/body` | — | PARITY | Hub added to web in convergence 1/3 |
| Wealth access | `REALM_NAMES` | Realms hub → `/wealth` | `/realms` hub → `/wealth` | — | PARITY | Same |
| Terminology | `REALM_NAMES` | "Realms", "Body", "Wealth" | "Realms", "Body", "Wealth" | — | PARITY | — |

## SETTINGS

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Appearance (System/Light/Dark) | Theme token map (both) | Segmented selector, persisted | Segmented selector, persisted (`lifepulse:appearance`) | — | PARITY | Closed in convergence 1/3 |
| NEXTRON permissions | Context domains + body/wealth gates | Coach-adjacent + realm screens | Memory CRUD, calendar/drive, body status row, wealth master toggle | Full body/wealth section UI differs | PARTIAL | → Prompt 2 |
| Account identity + sign out | Supabase Auth | Account screen | Settings account card + sign out | No separate `/account` (redirects to settings) | PARTIAL | → Prompt 2 if dedicated screen wanted |
| Notifications/version rows | — | Static rows | Absent | — | PARTIAL | → Prompt 2 (trivial) |

## THEMES

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| System / Light / Dark | Token correspondence map (docs) | `ThemeProvider`, persisted, OS-follow | `ThemeProvider` (`src/components/theme-provider.tsx`), persisted, OS-follow | — | PARITY | Foundation closed in convergence 1/3 |
| Signature Pulse dark | `darkColors` | Full identity | Dark variable set = existing system (converged values) | Full per-page visual polish differs | PARTIAL | → Prompt 2 owns per-page visual parity |
| Warm Human Premium light | `lightColors` | Full identity | Light variable set added | Same | PARTIAL | → Prompt 2 |
| Persistence | `lifepulse:appearance` key name shared | AsyncStorage | localStorage, same key + same values | Storage medium differs (platform) | PARITY | Same contract |

## ACCOUNT

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Email/identity | `profiles` | Account screen | Settings account card | — | PARITY | — |
| Feedback | — | Alpha share | FeedbackButton | — | PARITY | — |
| Logout | Supabase Auth | Sign out | Sign out | — | PARITY | — |

## CROSS-DEVICE

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Auth state | Supabase session | Session context | SSR session + proxy gate | — | PARITY | Same account, no separate identity |
| Server-backed tasks/habits/priorities | Canonical tables | Yes | Yes | — | PARITY | Same rows, same queries (bounds differ, noted) |
| NEXTRON history | `nextron_conversations` | Reads | Reads + manages | Management UI differs | PARTIAL | → Prompt 2 |
| Goals / Body / Wealth | Canonical tables | Yes | Goals yes; Body manual-only; Wealth subset | Body ingestion mobile-only | PARTIAL | Per sections above |

## Reserved for Prompt 2 (explicit, not drift)

Visual per-page parity (web); wealth recurring/goals/budgets-currency/balance-invariant/section toggles/bounded insights; body trends/goals/synced display/consent UI; mobile conversation management + memory/signals UI; web focus-reload + query bounds; habit log-window alignment; forgot-redirect + birth-input + remembered-email micro-drift; `/life-map` proxy entry; full Finance→Wealth label sweep beyond core surfaces.
