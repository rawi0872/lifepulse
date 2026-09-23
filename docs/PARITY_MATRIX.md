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

> Updated at the end of convergence Prompt 1/3, finalized in Prompt 2/3.
> After Prompt 2, core rows are PARITY. Remaining non-PARITY rows are
> ONLY truly platform-specific, documented below. Visual per-page polish
> is done; device/browser acceptance belongs to Prompt 3.

## AUTH

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Sign in | Supabase Auth (shared backend) | `app/login.tsx` + `lib/auth.tsx`, remembered email | `src/app/login/page.tsx` (SSR browser client) | — | PARITY | Same flows/fields; mobile adds remembered-email nudge |
| Sign up | Supabase Auth | `app/signup.tsx` | `src/app/signup/page.tsx` | — | PARITY | Same metadata (first/last/birth/display name) |
| Forgot password | Supabase Auth | `app/forgot-password.tsx` (redirect via shared `lib/links.ts`) | `src/app/forgot-password/page.tsx` (dynamic origin) | — | PARITY | Same destination; both derive from the web origin |
| Reset password UI | Supabase Auth | — (relies on web link) | `src/app/reset-password/page.tsx` | Mobile defers to web link (intentional) | PLATFORM_SPECIFIC | Documented deferral, not a gap |
| Sign out | Supabase Auth | `lib/auth.tsx` signOut | Settings sign-out card | — | PARITY | — |
| Route protection | — | `Tabs/_layout` redirect | `src/proxy.ts` protectedRoutes + onboarding gate | — | PARITY | `/life-map` added in Prompt 2 |
| Remembered email | Shared key `lifepulse.remembered_email` | `lib/remembered-email.ts` + login prefill | `src/lib/remembered-email.ts` + login prefill | Storage medium differs (platform) | PARITY | Same contract |
| Birth validation | Same rules (required, valid, not future, sane) | Free-text YYYY-MM-DD input | Date picker input | Widget differs (platform-appropriate) | PARITY | Identical error semantics |

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
| Focus reload on return | — | `useFocusEffect` reload | Visibility + focus revalidate in `use-today-data` | — | PARITY | Same no-stale guarantee, native patterns |

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
| Query bounds | — | `limit(50)`, status filter, due-date order | Same OR filter + due-date order, `limit(500)` on Today reads | Bound sizes differ by surface (documented) | PARITY | Same semantics; bounds are safety rails, not behavior |

## HABITS

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Canonical schedule model | `normalizeHabitSchedule`: `daily`/`weekdays`/`weekly` (+`WEEKDAY_DAYS` fallback, 1–7 clamp) | Uses it | Uses it (convergence 1/3; web writes canonical `weekly`, legacy `times_per_week` coerced on edit) | — | PARITY | No separate web rules |
| Create | `normalizeItemTitle`, `MAX_ITEM_TITLE_LENGTH` | Uses them + realm bootstrap | Uses them + realm bootstrap (convergence 1/3) | — | PARITY | Realm-less users no longer fail on web |
| Complete/log + undo | Existence check + `habit_logs` row | Direct insert/delete | Same + XP with rollback (`+10`) | XP web-only by design (documented) | PARTIAL | Same core semantics |
| Edit (history-preserving) | `buildHabitUpdatePayload` (definition columns only) | Uses it | Uses it (convergence 1/3) | — | PARITY | Logs/streaks stay valid on both |
| Delete + confirmation | `removeDeletedById` | `ConfirmDeleteDialog` + cascade delete | Inline confirm panel + explicit log/XP cleanup | — | PARITY | Same destructive meaning; web also cleans XP it created |
| Daily / weekdays / weekly | Domain due/streak fns | All three | All three (canonical) | `weekends` legacy read-only on both | PARITY | — |
| Streak/progress display | `getCurrentStreak`, `getBestStreak`, `getWeeklyProgress` | Uses them (full 365d history) | Uses them (full 365d history) | Log window identical (365d, 5000 rows) | PARITY | Weekly N honored for canonical `weekly` on both (shared fix) |
| Loading/error/empty | — | Skeletons, ErrorBanner+retry, empties | Skeletons, inline load error + retry, empties | — | PARITY | Closed in convergence 1/3 |
| Duplicate-submit guard | `createSingleFlight` | `saveGuardRef`/`deleteGuardRef` | Module guards (convergence 1/3) | — | PARITY | — |

## NEXTRON (ONE intelligence layer: `POST /api/nextron/ask` for both)

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Server provider path | `src/lib/nextron/*` (evidence, provider, actions, memory, signals) | Bearer `Authorization` → same endpoint | Cookie session → same endpoint | Transport auth differs; both verified server-side (`resolveNextronAuth`) | PARITY | No separate AI behavior |
| Conversation history | `nextron_conversations` + messages (limit 120) | List + auto-open + delete (long-press, confirm) | List + open + create + delete | Creation is server-side on first ask for both | PARITY | Same ownership enforcement |
| Starter state | — | Starters + permission summary | Starters + composer (500 chars) | — | PARITY | — |
| Live response + thinking state | — | `sending` + preparing bubble | `thinking/syncing` states, 35s timeout + retry | — | PARITY | — |
| Permission model (Body) | `domain/nextron-permissions.ts` (single import) + `health_preferences` table | Domain `effectiveNextronMetrics`, fail-closed | Domain `effectiveNextronMetrics`, fail-closed | Fetchers differ (platform clients) | PARITY | One semantic implementation |
| Permission model (Wealth) | `domain/nextron-permissions.ts` + `finance_preferences` table | Domain gate + inline toggles | Domain gate + Settings master + section toggles | Same as Body | PARITY | One semantic implementation |
| Evidence redaction | Server `safeText`/`boundedString`/`isForbiddenText`/numeric grounding | Inherited (client sends no raw data) | Inherited | — | PARITY | Redaction lives server-side for both |
| Body section in AI prompt | Explicitly wired when allowed: metric names + one summary line only | Same (server decides) | Same (server decides) | — | PARITY | Allowed = summarize; otherwise omitted. No raw records ever |
| Action proposals + approval | Server allowlist, 15-min expiry, exact-title revalidation, `EXECUTION_DISABLED` | Pending list + explicit Approve/Reject via same RPCs | Full propose/list/approve/cancel UI | Same contract; mobile proposes via ask text like web starters | PARITY | Permission ≠ approval on both; exact-once + owner isolation server-side |
| Failure behavior | Calm error mapping | `toCalmNextronError` | `AskFailureCode` + retry | — | PARITY | — |
| Memory (explicit-only) | `memory.ts`: `remember that` gate, no auto-monitoring | View + forget via same API | Via prompt + Settings CRUD | Same enforcement | PARITY | No auto-monitoring on either |
| Signals/attention | `signals.ts`, `attention.ts` (deterministic) | Read-only list (same API) | Full panels | Observability depth differs, same data | PARITY | No enforcement divergence |
| Body section in AI prompt | `buildNextronProviderInput` omits `body` (only wealth) | — | — | Shared behavior | PARITY | Confirm intentional before adding (Prompt 2) |
| Request length limits | Server `parseNextronUserRequest` decides | Client 2000 | Client 500 | Server is decider | PARITY | — |

## BODY

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Realm overview | `body.ts` (summary, activity level, freshness) | `app/body.tsx` + `body-service.ts` | Synced tab: latest values, 7D/30D trends, goals, consent visibility | Different data sources (below) | PARITY | Same information classes; ingestion is the only exception |
| Metric display + trends | `getBodyMetricTrend` (7D/30D, coverage-gated) | 6-key grid + trend cards | 5-key synced cards + 7D/30D toggle + coverage honesty | Manual `body_metrics` remain web-manual extras | PARITY | Same engine, same gates |
| Goals (quantitative) | `getBodyGoalProgress` | Inline goal create + progress | Create + delete + progress via same function | Same 00039 column contract | PARITY | Truthful progress both |
| Storage consent + NEXTRON toggles | `health-privacy.ts` three layers | Health Connections screen (per-metric) | Read-only consent + NEXTRON visibility; toggles stay mobile | Toggles require device stores (platform) | PARITY | Visibility on web, control on mobile — explicit split |
| Synced data visibility | `health_records` (server-synced) | Reads it | Reads it (60d, display-only) | — | PARITY | Web never ingests; claims none |
| Platform exception | — | ANDROID: Health Connect ingestion → `health_records` gated by `health_preferences.allowed_metrics`; NEXTRON by `nextron_allowed_metrics` | WEB: manual tracking + display of synced normalized data only; never reads device APIs; `/devices` is an explicit preview with no import | Explicit, intentional | PLATFORM_SPECIFIC | No silent divergence; web makes no device-read claims |

## WEALTH (canonical model = `finance_*` tables; NO parallel `wealth_*` system)

| Capability | Shared/domain | Mobile | Web (`/wealth`, renamed from `/finance` in convergence 1/3) | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| Accounts (+archive) | `wealth.ts` account types | Full CRUD + archive | Full CRUD + archive (canonical types, institution) | — | PARITY | Same columns |
| Stored-balance invariant | `wealth.ts`: transactions do NOT mutate balances | Respected | Respected (manual balance shown; linked flow informational) | — | PARITY | Fixed in Prompt 2 |
| Transactions (incl. transfer/adjustment + paired legs) | `linked_transaction_id` | Full incl. paired transfers + linked cleanup | Full incl. paired transfers + linked cleanup | — | PARITY | Same-currency gate both |
| Cash flow (per-currency, MTD-comparable) | `wealth-intelligence.ts` | Per-currency, comparable bounds | Base-currency gate, unknown/foreign counted honestly | Comparator depth differs, invariants hold | PARITY | No silent FX on either |
| Budgets (+currency) | `getWealthBudgetStatuses` | Currency chips + statuses | Currency field + unknown display | — | PARITY | Legacy NULL = unknown both |
| Recurring items | `getWealthRecurringIntelligence` | Full CRUD + advance | Full CRUD + advance | — | PARITY | Same frequencies |
| Goals (truthful progress) | `getWealthGoalProgress` | Full CRUD + progress | Full CRUD + progress | — | PARITY | Savings/debt/net-worth/investment rules shared |
| Currency semantics + unknown bucket | `parseWealthAmount`, `__unknown` isolation | Chips, validation, base currency pref | Chips, validation, base currency pref, unknown counts | — | PARITY | `^[A-Z]{3}$` both |
| NEXTRON permissions (master + 5 sections) | `finance_preferences` | Inline toggles on Wealth screen | Master + section toggles in Settings | Placement differs (platform-appropriate) | PARITY | Same fail-closed gate |
| Bounded insights | `deriveWealthInsights` + data contract | Uses them | Uses them (mapped, max 5) | — | PARITY | Same engine |
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
| Appearance (System/Light/Dark) | Theme token map (both) | Segmented selector, persisted | Segmented selector, persisted (`lifepulse:appearance`) | — | PARITY | Same contract, verified switch + persistence |
| NEXTRON permissions | Context domains + body/wealth gates | Coach-adjacent + realm screens | Memory CRUD, calendar/drive, body status, wealth master + sections | Full body/wealth section UI placement differs | PARITY | Same gates; toggles where platform-appropriate |
| Account identity + sign out | Supabase Auth | Account screen | Settings account card + sign out (+ `/account` redirect) | No separate `/account` screen (redirect documents it) | PARITY | Same capability |
| Notifications/version rows | — | Static rows | Absent | — | PARTIAL | → Prompt 2 (trivial) |

## THEMES

| Capability | Shared/domain | Mobile | Web | Platform exception | Status | Notes |
|---|---|---|---|---|---|---|
| System / Light / Dark | Token correspondence map (docs) | `ThemeProvider`, persisted, OS-follow | `ThemeProvider` (`src/components/theme-provider.tsx`), persisted, OS-follow | — | PARITY | Same key/values contract |
| Signature Pulse dark | `darkColors` | Full identity | Dark variable set across all major surfaces | NEXTRON keeps attention-cyan brand (deliberate, like realm colors) | PARITY | Same color language |
| Warm Human Premium light | `lightColors` | Full identity | Light variable set across all major surfaces | Same | PARITY | Same color language |
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
| NEXTRON history | `nextron_conversations` | Reads + deletes | Reads + manages | Management UI depth differs | PARITY | Same ownership enforcement |
| Goals / Body / Wealth | Canonical tables | Yes | Goals yes; Body display yes; Wealth full | Body ingestion mobile-only | PARITY | Per sections above |

## Reserved for Prompt 3 (acceptance only — no implementation left)

- Physical device + browser visual acceptance of both themes.
- Production migration application (none pending; none proposed).
- Any defect found during Prompt 3 acceptance (none known).
