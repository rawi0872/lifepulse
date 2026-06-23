# LIFE PULSE — Current State Audit

**Date:** June 22, 2026
**Commit:** `4fa6b98` (Phase 0 base; Phase 1 + 1.5 + 2A + 2B applied on top)
**Branch:** `master` (no remote configured)
**Build status:** ✅ Clean (0 lint errors, 0 build errors)
**Working tree:** Clean — all Phase 2B changes applied
**Architecture Plan:** `docs/LIFE_OS_ARCHITECTURE_PLAN.md` (created in Phase 2B)

---

## 1. Executive Summary

Life Pulse is a dark-themed, monorepo Next.js 16 web application that functions as a personal dashboard operating system. It provides authenticated users with 8 core tools: Today (command center), Habits, Tasks, Projects, Finance, Journal, Insights (analytics), and Settings. It uses Supabase for all backend needs — auth, database, RLS, and row-level security.

**Production readiness:** The app is feature-complete for a private beta. Build and lint pass clean. All 17 routes render. Auth flow (signup → onboarding → dashboard) is wired end-to-end. RLS is enabled on every table with FK ownership validation. The deployment checklist has been written. After GitHub push and Vercel import, the app can be deployed in minutes.

**Strongest parts:** Auth and onboarding flow, RLS security model (FK ownership helpers in 00006 migration, finance ownership in 00007), Insight radar chart, Today dashboard aggregating all data types, Finance module with budgets/trends/breakdowns, XP/level progression system with per-realm titles.

**Biggest gaps:** Excessively large pages (finance ~930 lines, today ~1100 lines, projects ~860 lines), duplicated CSS class patterns across remaining auth page inputs, ILS currency hardcoded in finance, no AI coach, no body/health tracking, no wearable integration, no weekly review, no server component data fetching.

**Private beta verdict:** ✅ Ready to deploy after GitHub push + Vercel setup + Supabase Auth URL config + setting `NEXT_PUBLIC_SUPPORT_EMAIL` env var on Vercel. Not ready to invite users until post-deploy smoke test passes.

---

## 2. Current Architecture

### Framework & Versions
- **Framework:** Next.js 16.2.4 (App Router + Turbopack)
- **React:** 19.2.4
- **TypeScript:** ^5
- **Tailwind CSS:** ^4 (with `@tailwindcss/postcss` plugin)
- **Supabase SSR:** ^0.10.3
- **Supabase JS:** ^2.105.4
- **ESLint:** ^9 with `eslint-config-next` 16.2.4

### Routing Model
- App Router with 17 routes under `src/app/`
- All routes are server-rendered by default (dynamic), except static routes (/, /privacy, /terms) which are prerendered as static content
- Proxy middleware (`src/proxy.ts`) handles auth gating for 8 protected routes and 2 auth routes

### Folder Structure
```
src/
├── app/                  # 17 routes + layout + globals.css
│   ├── auth/callback/    # OAuth code exchange
│   ├── finance/          # 935 lines — largest page
│   ├── forgot-password/
│   ├── habits/
│   ├── insights/
│   ├── journal/
│   ├── login/
│   ├── onboarding/       # 823 lines — very large
│   ├── privacy/
│   ├── projects/         # 875 lines — very large
│   ├── reset-password/
│   ├── settings/
│   ├── signup/
│   ├── tasks/
│   ├── terms/
│   ├── today/            # 1052 lines — largest page
│   ├── layout.tsx
│   ├── page.tsx          # Landing page
│   └── globals.css
├── components/           # Shared UI components
│   ├── finance/          # Finance sub-components
│   ├── insights/         # Radar chart components
│   ├── ui/               # Button, Card, Input primitives
│   ├── DashboardNav.tsx  # Sidebar + mobile bottom nav
│   ├── JournalSection.tsx
│   ├── HabitCard.tsx
│   ├── TaskCard.tsx
│   └── ... (13 more)
├── lib/                  # Utilities and libraries
│   ├── supabase/         # client.ts + server.ts
│   ├── levels.ts         # XP/level system
│   ├── streaks.ts        # Habit streak calculator
│   ├── taskCompletion.ts # Task toggle + XP dedup
│   └── utils.ts          # cn(), formatDate(), getTodayDateString()
└── proxy.ts              # Auth middleware (route protection)
```

### Auth / Proxy Setup
- `src/proxy.ts` exports `proxy()` and a `config.matcher` that intercepts all routes except static assets
- Protected routes: `/onboarding`, `/today`, `/habits`, `/tasks`, `/journal`, `/insights`, `/settings`, `/finance`
- Auth routes (redirect to dashboard if logged in): `/login`, `/signup`
- Root `/` redirects to `/today` (onboarded) or `/onboarding` (not onboarded)
- Proxy checks `auth.getUser()`, then checks `profiles.onboarding_completed`
- No middleware.ts — Next.js 16 auto-detects `src/proxy.ts`

### Supabase Client/Server Setup
- **Browser client** (`src/lib/supabase/client.ts`): Uses `createBrowserClient` from `@supabase/ssr`. Includes placeholder detection and dev-mode console warnings for missing/misconfigured env vars.
- **Server client** (`src/lib/supabase/server.ts`): Uses `createServerClient` with cookie handling via `next/headers`. Wraps `setAll` in try/catch for server component compatibility.
- Auth callback (`src/app/auth/callback/route.ts`): Creates server client from raw cookie header and exchanges code for session. Whitelist-based redirect (4 allowed paths).

### Environment Variables
- **Required:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Optional (RLS test):** `RLS_TEST_USER_A_EMAIL`, `RLS_TEST_USER_A_PASSWORD`, `RLS_TEST_USER_B_EMAIL`, `RLS_TEST_USER_B_PASSWORD`
- `.env.local` is gitignored (`.gitignore:34:.env*`)
- `.env.example` contains only placeholders (`your_supabase_project_url`, `your_supabase_anon_key`)
- No service role key anywhere in the codebase

### Security Headers (next.config.ts)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restricts camera, microphone, geolocation)
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (prod only, 2 years, includeSubDomains, preload)
- `Content-Security-Policy` (dev allows `unsafe-eval`, prod does not; both restrict `connect-src` to `*.supabase.co`)

### Deployment Readiness
- Build and lint pass clean
- `next build` produces 20 pages (17 routes + `/_not-found` + proxy + layout)
- 1 static route (/) pre-rendered; all others dynamic
- No git remote configured (branch is `master`, not `main`)
- Deployment checklist written with sections 0–8

---

## 3. Current Routes

| Route | Source File | Purpose | Status | Data Used | Notes |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` (381 lines) | Landing page with hero, features, how-it-works, footer | Working | None (static) | Sticky nav, responsive, premium feel. 6 feature cards, Life Balance Map spotlight. Good first impression. |
| `/login` | `src/app/login/page.tsx` (113 lines) | Email/password sign-in | Working | `supabase.auth.signInWithPassword` | Basic form. Error from Supabase shown directly (acceptable — "Invalid login credentials" is user-facing). No loading skeleton. |
| `/signup` | `src/app/signup/page.tsx` (237 lines) | Account registration (first/last name, birth date, email, password) | Working | `supabase.auth.signUp` with metadata | Client-side validation. Raw Supabase error replaced with generic message in previous session. Email confirmation flow handled. Birth date field uses native date picker. |
| `/forgot-password` | `src/app/forgot-password/page.tsx` (109 lines) | Email input to receive reset link | Working | `supabase.auth.resetPasswordForEmail` | Generic success message (no info leak). Redirects to `/auth/callback?next=/reset-password`. |
| `/reset-password` | `src/app/reset-password/page.tsx` (146 lines) | Set new password with confirmation | Working | `supabase.auth.updateUser` | Validates min 8 chars + match. Session check on mount (redirects to `/login` if no session). |
| `/auth/callback` | `src/app/auth/callback/route.ts` (47 lines) | OAuth code exchange + session creation | Working | `supabase.auth.exchangeCodeForSession` | Whitelist-based redirect (4 allowed paths). Safe against open redirect. |
| `/onboarding` | `src/app/onboarding/page.tsx` (823 lines) | 6 default realms, profile creation, feature tour | Working | `profiles`, `realms` tables | Creates profile + 6 default realms in one transaction. Very large file. Feature tour carousel. |
| `/today` | `src/app/today/page.tsx` (1052 lines) | Daily command center | Working | `tasks`, `habits`, `habit_logs`, `projects`, `journal_entries`, `xp_events`, `finance_transactions`, `finance_accounts`, `finance_budgets`, `realms` | Heaviest page. Priorities, habits grid, quick capture, task list, journal snippet, XP display, finance overview. No loading states. Largest file in project. |
| `/habits` | `src/app/habits/page.tsx` (565 lines) | Habit CRUD, daily log, weekly grid, streaks | Working | `habits`, `habit_logs`, `realms` | Frequency: daily, weekdays, weekends, weekly, times_per_week. Streak calculation via `src/lib/streaks.ts`. Raw errors fixed in previous session. |
| `/tasks` | `src/app/tasks/page.tsx` (547 lines) | Task CRUD with priority, due date, project filter | Working | `tasks`, `realms`, `projects` | Sort by priority + due date. Filter by project. Task completion via `toggleTaskCompletion()` with XP dedup. Raw errors fixed. |
| `/projects` | `src/app/projects/page.tsx` (875 lines) | Project CRUD, task linking, quick-draft wizard | Working | `projects`, `tasks`, `realms` | Status: active/paused/completed. Progress slider (0-100). Expandable task list per project. Quick-draft wizard. Raw errors fixed. Very large file. |
| `/finance` | `src/app/finance/page.tsx` (935 lines) | Accounts, transactions, budgets, KPI cards, charts | Partial | `finance_accounts`, `finance_categories`, `finance_transactions`, `finance_budgets` | Full CRUD for accounts, transactions, budgets. Cash-flow trend chart, expense breakdown pie, budget usage bar. Hardcoded ILS currency. Responsive but complex. Second-largest file. Missing default categories on fresh signup. |
| `/journal` | `src/app/journal/page.tsx` (209 lines) | Daily entries with mood/energy ratings, reflection prompts | Working | `journal_entries` | 5 reflection prompts. Mood (1-5) and energy (1-5) ratings. One entry per day (upsert). Clean, focused page. |
| `/insights` | `src/app/insights/page.tsx` (727 lines) | Realm XP breakdown, radar chart, balance score, suggestions | Working | `xp_events`, `realms`, `habits`, `habit_logs` | Hexagonal radar chart with expanded dialog. Balance score computation. 6 realm XP totals. Strong visual component. Large file with embedded analysis logic. |
| `/settings` | `src/app/settings/page.tsx` (510 lines) | Profile fields, realm CRUD, change password, logout | Working | `profiles`, `realms` | Edit first/last name, display name, birth date. Add custom realms (icon + color picker). Change password form. Logout button. Progression customization section is a placeholder comment. |
| `/privacy` | `src/app/privacy/page.tsx` (182 lines) | Privacy policy | Working (static) | `getSupportEmail()` from config | Reads from `NEXT_PUBLIC_SUPPORT_EMAIL` env var via `src/lib/config.ts`. Falls back to `support@lifepulse.app`. Must be set in Vercel before beta. |
| `/terms` | `src/app/terms/page.tsx` (170 lines) | Terms of service | Working (static) | `getSupportEmail()` from config | Reads from `NEXT_PUBLIC_SUPPORT_EMAIL` env var via `src/lib/config.ts`. Falls back to `support@lifepulse.app`. Must be set in Vercel before beta. |

### Route Status Summary
- **Working:** 16/17 routes (all except finance)
- **Partial:** 1/17 (finance — missing default category seeding)
- **Risky:** 0/17
- **Placeholder:** 0/17
- **Missing:** 0/17
- **Auto-generated (not in route list):** `/_not-found` (Next.js default, excluded from audit count)

---

## 4. Database and RLS Audit

### Tables

| Table | Purpose | RLS | FK Ownership Check | Notes |
|---|---|---|---|---|
| `profiles` | User profile (display_name, first_name, last_name, birth_date, onboarding_completed) | ✅ | N/A | Auto-created via trigger on `auth.users` insert. Updated by 00003 migration. |
| `realms` | Life areas (Mind, Body, Career, Relationships, Finance, Faith) per user | ✅ | N/A | Unique constraint on (user_id, name) from 00004. No delete allowed in v1. |
| `habits` | Habits per user, linked to a realm | ✅ | ✅ (realm_id) | Frequency constraints: daily/weekdays/weekends/weekly/times_per_week. |
| `habit_logs` | Daily habit completion records | ✅ | ✅ (habit_id) | Unique(habit_id, completed_date). |
| `tasks` | Tasks with priority, due date, status, optional realm + project links | ✅ | ✅ (realm_id, project_id) | Status: todo/done. |
| `xp_events` | XP earned from habits and tasks | ✅ | ✅ (source_id via type) | source_type: habit/task. Dedup check on insert. |
| `journal_entries` | Daily journal with mood/energy | ✅ | N/A | Unique(user_id, entry_date). |
| `projects` | Projects with status, deadline, progress | ✅ | ✅ (realm_id) | Status: active/paused/completed. |
| `finance_accounts` | Financial accounts (cash/bank/card/savings/investment/other) | ✅ | N/A | Currency default ILS. |
| `finance_categories` | Income/expense categories per user | ✅ | N/A | Unique(user_id, type, lower(name)). |
| `finance_transactions` | Income/expense records | ✅ | ✅ (account_id, category_id) | Amount > 0; type checked against category type. |
| `finance_budgets` | Monthly budget per expense category | ✅ | ✅ (category_id must be expense type) | Month must be 1st of month. |

### Key Relationships
- All tables reference `auth.users(id)` via `user_id` with `on delete cascade`
- `habits.realm_id` → `realms(id)` (cascade delete)
- `tasks.realm_id` → `realms(id)` (set null), `tasks.project_id` → `projects(id)` (set null)
- `projects.realm_id` → `realms(id)` (set null)
- `habit_logs.habit_id` → `habits(id)` (cascade delete)
- `finance_transactions.account_id` → `finance_accounts(id)` (set null), `finance_transactions.category_id` → `finance_categories(id)` (set null)
- `finance_budgets.category_id` → `finance_categories(id)` (cascade delete)

### Ownership Safety (00006 + 00007)
- 5 helper functions: `realm_belongs_to_user`, `habit_belongs_to_user`, `project_belongs_to_user`, `task_belongs_to_user`, `habit_log_belongs_to_user`, `finance_account_belongs_to_user`, `finance_category_belongs_to_user_and_type`
- All INSERT/UPDATE policies on FK-bearing tables validate ownership of referenced rows
- XP event INSERT validates that the source task or habit log belongs to the user
- Budgets only allow expense-type categories
- No user can read/update/delete another user's data (all policies check `auth.uid() = user_id`)

### Migration Risks
- **00002 (times_per_week):** Drops and recreates the frequency check constraint — safe because migration runs before any data exists
- **00004 (onboarding idempotency):** Uses DO block with conditional to avoid error if constraint already exists — safe for re-runs
- **00006 (RLS FK ownership):** Replaces policies from 00001 — safe, always drops first
- **00007 (finance):** Adds new tables + helpers + policies — fully additive, no conflicts
- **00005 (projects):** Adds `project_id` column to `tasks` via `alter table ... add column if not exists` — safe

### Production Setup Requirements
- Run `supabase migration up` (or apply all 7 migrations manually) on production Supabase project
- Configure Supabase Auth: Enable email confirmations (or disable for beta), set Site URL and redirect URLs
- Create 2 test users for RLS smoke test, then delete them

### RLS Smoke Test
- Script: `scripts/rls-smoke-test.mjs` (745 lines)
- Requires env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RLS_TEST_USER_A_EMAIL`, `RLS_TEST_USER_A_PASSWORD`, `RLS_TEST_USER_B_EMAIL`, `RLS_TEST_USER_B_PASSWORD`
- Tests that User A cannot read/update/delete User B's data across all 12 tables
- Currently **blocked** — cannot run until test users exist in production Supabase

---

## 5. Feature Status Matrix

| Feature | Status | What Works | What Is Missing | Upgrade Priority |
|---|---|---|---|---|
| **Auth** | ✅ Working | Signup, login, logout, forgot/reset password, session management, email confirmation flow | No social login (Google/GitHub OAuth), no magic link, no MFA | Low |
| **Onboarding** | ✅ Working | 6 default realms, profile creation, feature tour carousel, onboarding_completed flag | No skip option, no edit-after-onboarding prompt | Low |
| **Realms** | ✅ Working | CRUD via settings, color + icon picker, used by habits/tasks/projects, XP per realm | No delete in v1 (policy: `using (false)`), no realm reordering, no progress targets per realm | Low |
| **Habits** | ✅ Working | CRUD, daily log, 5 frequency types, streak calculation (current + best), weekly progress for times_per_week | No habit notes on log, no habit templates, no smart reminders | Medium |
| **Tasks** | ✅ Working | CRUD, priority/due-date sorting, project filtering, completion toggling with XP dedup | No sub-tasks, no recurring tasks, no task notes | Medium |
| **Projects** | ✅ Working | CRUD, progress slider, deadline, linked tasks, quick-draft wizard | No milestones, no Gantt/timeline, no file attachments | Medium |
| **Journal** | ✅ Working | Daily entries, mood/energy ratings, 5 reflection prompts, history view | No rich text formatting, no media attachments, no historical streak/graph | Low |
| **Finance** | ⚠️ Partial | Accounts, transactions, budgets, KPI cards, cashflow/expense/budget charts, computed insights | No default categories on fresh signup (user must create them), no recurring transactions, no export, ILS hardcoded | Medium |
| **XP/Levels** | ✅ Working | 20-level progression, per-realm titles, overall titles, XP from habits + tasks, dedup on task completion | No XP breakdown UI, no level-up animation, no badge system | Low |
| **Insights** | ✅ Working | Realm radar chart (hexagonal), expanded dialog, balance score, strongest/weakest realm, suggestions | No trend over time, no historical data comparison, no habit completion rate chart | Medium |
| **Settings/Profile** | ✅ Working | Edit first/last/display name, birth date, realms (add/edit), change password, logout | "Progression customization" is a placeholder comment, no theme/skin options, no notification preferences | Low |
| **Legal Pages** | ⚠️ Partial | Privacy policy and terms of service pages exist with proper layout. Support email now reads from `NEXT_PUBLIC_SUPPORT_EMAIL` env var. | No cookie notice, no GDPR compliance check | Medium |
| **Deployment Docs** | ✅ Working | `deployment-checklist.md` with 9 sections, `security-audit.md` | No CI/CD config, no monitoring setup doc | Low |
| **Mobile Responsiveness** | ⚠️ Partial | DashboardNav has mobile bottom bar (5 items: habits, projects, tasks, journal, insights + Settings added in Phase 0) | Finance page may overflow on narrow screens, Today page layout stacks but may have cramped sections | Medium |
| **Loading States** | ✅ Phase 0 Complete | Root `loading.tsx` + skeleton loading states for all 8 dashboard routes (today, habits, tasks, projects, finance, journal, insights, settings) | No Suspense boundaries, no granular per-component loading | Low |
| **Error Handling** | ✅ Phase 0 Complete | Root `error.tsx` + error boundaries for all 8 dashboard routes with "Try again" buttons. No raw Supabase errors exposed. | No offline detection, no retry-after-failure logic for data fetches | Low |
| **Toasts/Feedback** | ✅ Complete | Toast system via `useToast` hook + `ToastProvider` in root layout. Inline `feedback` banners replaced in all 7 dashboard pages. Dark-glass styling, auto-dismiss 4s, max 5 visible. | Auth pages (login, signup, forgot/reset password) still use inline error states — acceptable for form-level validation | Low |
| **AI Coach** | ❌ Missing | None | Not started | Future phase |
| **Body/Health Tracking** | ❌ Missing | None | Not started | Future phase |
| **Smart Ring/Watch** | ❌ Missing | None | Not started | Future phase |

---

## 6. UI/UX Audit

### What Feels Premium Already
- Dark color system with cohesive CSS variable palette (bg, surface, text, accent, success, warning, danger)
- DashboardNav sidebar with grouped navigation (Build, Reflect, Review) and "Personal OS" tagline
- Landing page with sticky glass-morphism nav, gradient hero, feature cards, Life Balance Map spotlight
- Hexagonal radar chart with grid rings, smooth data polygon, and expanded dialog with focus trap
- Finance KPIs, cashflow trend chart, expense breakdown (donut), budget usage bars
- Card component with 5 variants (default, subtle, elevated, ghost, inset)
- Button component with 4 variants (primary, secondary, ghost, danger) and active scale animation
- Custom scrollbar styling
- `::selection` color matches accent
- `:focus-visible` outline matches accent
- Consistent border radius (rounded-lg, rounded-xl), spacing, typography

### What Feels Basic
- Auth pages (login, signup, forgot/reset password) are functional but plain — single centered card, no brand animation
- Onboarding is a long scroll page with realm cards — no stepper/progress indicator
- Journal page is a simple textarea with mood buttons — no rich text, no entry preview, no calendar heatmap
- Tasks page is a flat list with inline forms — no drag-and-drop reordering, no Kanban view
- Habits page is a vertical list with a weekly grid — no calendar view, no habit sorting
- No transition animations between pages/routes
- No loading skeletons anywhere

### What Feels Inconsistent
- Some pages use `Card` component, others use direct div styling
- Input fields have duplicated className patterns (20+ instances of the same 5-line Tailwind string)
- Dashboard pages mix 2-column and 1-column layouts without clear pattern
- Finance page uses `[color-scheme:dark]` on date input; other date inputs may not
- Some pages have HelpPopover, others don't
- Settings page has `InfoTip` components; other pages don't

### Navigation Quality
- Desktop: Fixed left sidebar (56px width) with grouped nav + Settings at bottom — good
- Mobile: Fixed bottom bar with 5 items — but **Settings is missing** from mobile nav
- No breadcrumbs, no back button pattern for nested routes
- Logo links to `/today` (correct), but no visual indicator of which nav section is active beyond color change

### Dashboard Quality
- Today page is the most feature-rich dashboard. It aggregates: priorities, habits, tasks, journal, XP, finance overview
- However, it's 1052 lines with all state/rendering logic in one file — hard to maintain, no component separation
- No "good morning" personalization, no weather/date greeting, no AI-suggested next action
- Finance overview on Today page shows account balances only — no mini trends or budget alerts

### Mobile Readiness
- Layout uses `min-h-screen` and `md:` breakpoints — adequate but not polished
- DashboardNav mobile bottom bar is flat (all 5 items equal), no "more" menu for Settings
- Finance page at 935 lines has complex responsive JSX that may overflow on small screens
- No touch-friendly interactions (swipe, long-press, pull-to-refresh)
- Input fields on mobile may be small (py-2.5 is ~28px touch target, which is minimum recommended)

### Overall Premium Feeling
The app has a solid foundation — the dark theme, CSS variable system, and typography choices (Geist font) give it a professional feel. However, it does not yet feel like a "life operating system" — it feels like a well-built productivity dashboard. The gap is:

1. No personalized greeting or ambient UI
2. No animations/micro-interactions (page transitions, hover reveals, data animations)
3. No AI-powered features (recommendations, next-best-action, reflections)
4. No data visualizations beyond the radar chart and finance charts
5. No unified search/command palette
6. The sidebar is informative but not immersive

### Visual Changes Needed Later (Premium JARVIS-like Direction)
- Animated logo/mark on loading
- Ambient gradient backgrounds or subtle particle effects
- Glass-morphism panels with backdrop blur
- Data-rich dashboard with animated counters and live-updating cards
- Command palette (Cmd+K) for search and quick actions
- Smooth page transitions
- Personalized greeting based on time of day + user data
- Holographic/metallic accent effects on the radar chart
- Full-screen focus mode for Today dashboard

---

## 7. Code Quality Audit

### Duplicated Code
- **Input field className pattern** repeated ~25 times across files (login, signup, forgot-password, reset-password, today, habits, tasks, projects, finance, settings, journal). The `input.tsx` UI component exists but is not used consistently.
- **Tailwind color variable references** (`var(--accent)`, `var(--accent-soft)`, etc.) hardcoded in className strings instead of using Tailwind CSS v4 `@theme` utilities
- **Realm data shape** defined as inline interface in habits, tasks, projects, today, settings, onboarding, insights (at least 7 times)
- **Supabase client creation** done directly in each page instead of using a shared hook

### Oversized Pages/Components
- `src/app/today/page.tsx`: **1052 lines** — dashboard aggregates 7 data types, all logic in one file
- `src/app/finance/page.tsx`: **935 lines** — accounts, transactions, budgets, 6 modals, all in one file
- `src/app/projects/page.tsx`: **875 lines** — project CRUD, task linking, wizard, all in one file
- `src/app/onboarding/page.tsx`: **823 lines** — realm creation + feature tour + profile, all in one file
- `src/app/insights/page.tsx`: **727 lines** — analytics computation + rendering + radar chart, all in one file
- `src/app/today/page.tsx`: **1052 lines** — largest file in project

These should be broken into smaller components/pages for maintainability.

### Client/Server Component Concerns
- All pages use `"use client"` — **no server components** except `/privacy`, `/terms`, and `/` (landing page)
- Data fetching is done directly inside client components via `useEffect` + `supabase.from().select()` — no React Server Components, no `react-query`/`swr`, no server actions
- This means no SSR for dashboard data, no streaming, and extra client-side JavaScript bundle
- The landing page (`/`) is a static server component — correctly implemented
- Legal pages (`/privacy`, `/terms`) are static server components — correctly implemented

### Data Fetching Concerns
- No React Server Components for initial data load
- No data caching strategy (no `stale-while-revalidate`, no SWR, no TanStack Query)
- Each page fetches its own data independently — no shared data layer
- No optimistic updates — UI waits for server confirmation before reflecting changes
- No offline support — all data fetching requires network

### Error Handling Concerns
- No `error.tsx` files in any route directory
- No global error boundary in `layout.tsx`
- Individual try/catch blocks in each page handle errors differently (some show error state, some don't)
- Finance and Journal pages have minimal error handling
- Network errors during fetch result in silent failures or blank states

### Loading State Concerns
- No `loading.tsx` files in any route directory
- No Suspense boundaries
- Most pages use a local `loading` boolean and conditional render, but the initial render shows empty/default state
- No skeleton placeholders — content appears all at once or not at all
- Todo quick-capture on Today page has no loading indicator when saving

### Naming/Folder Organization
- **Good:** Components are in `src/components/` with subfolders for domains (finance/, insights/, ui/)
- **Good:** Library code is well-separated into `src/lib/`
- **Could improve:** Pages contain too much logic (data fetching + state + rendering + event handlers in one file)
- **Could improve:** No hooks directory — all state logic is inline in components

### Unused/Dead Files
- `public/` — clean (empty, default SVGs removed in Phase 0)
- `src/app/favicon.ico` — removed (Phase 2A), replaced by `src/app/icon.svg` (Life Pulse pulse/heartbeat design)
- `src/app/apple-icon.tsx` — removed (Phase 2A), apple icon falls back to `icon.svg`
- `tsconfig.tsbuildinfo` — build artifact, should be gitignored (already is)
- `next-env.d.ts` — auto-generated, should be gitignored (already is)

### TypeScript / Lint / Build Status
- **Lint:** ✅ 0 errors, 0 warnings (`npm run lint` passes)
- **TypeScript:** ✅ No type errors (verified during build)
- **Build:** ✅ `next build` completes successfully (3.0s compile, 4.8s TypeScript check, 520ms page generation)
- 20 pages generated (17 routes + `/_not-found` + proxy + layout)
- 1 static route (`/`), rest dynamic

---

## 8. Production Deployment Readiness

### What Is Already Ready
- Build and lint pass clean
- All 17 routes render
- Auth flow (signup → onboarding → dashboard) is complete
- RLS enabled on all 12 tables with FK ownership checks
- Security headers configured (CSP, HSTS, X-Frame-Options, etc.)
- `.env.local` is gitignored
- `.env.example` contains only placeholders
- Deployment checklist written (`docs/deployment-checklist.md`) with 9 sections
- Security audit written (`docs/security-audit.md`)
- No service role key in codebase

### What Must Be Done Before Vercel Deployment
1. **Rename branch:** `git branch -M main` (currently `master`)
2. **Add git remote:** `git remote add origin https://github.com/USERNAME/lifepulse.git`
3. **Push:** `git push -u origin main`
4. **Tag:** `git tag -a private-beta-v1 -m "Private beta v1" && git push origin private-beta-v1`
5. **Import into Vercel:** Framework auto-detects Next.js, set env vars

### What Must Be Done in Supabase Auth URL Settings
- **Site URL:** Set to production Vercel domain (e.g. `https://lifepulse.vercel.app`)
- **Redirect URLs:**
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - `https://lifepulse.vercel.app/auth/callback`
  - `https://lifepulse.vercel.app/reset-password`

### What Must Be Tested After Deployment
- Full smoke test (all 17 routes)
- Auth flow (signup, login, logout, forgot/reset password)
- Protected route redirects
- RLS isolation test
- Mobile responsiveness on actual devices
- All CRUD operations (habits, tasks, projects, finance, journal, settings)

### What Must Be Changed Before Inviting Beta Users
1. **Set `NEXT_PUBLIC_SUPPORT_EMAIL`** in Vercel env vars (e.g. `support@lifepulse.app`)
2. **Replace favicon.ico** with Life Pulse brand mark
3. **Clean up test data** from production database
4. **Disable email confirmation** in Supabase Auth settings (or ensure it works before inviting testers)

### support@example.com Status
- ✅ **No longer hardcoded.** Support email now reads from `getSupportEmail()` in `src/lib/config.ts`, which uses `NEXT_PUBLIC_SUPPORT_EMAIL` env var with a `support@lifepulse.app` fallback.
- `.env.example` includes `NEXT_PUBLIC_SUPPORT_EMAIL=your_support_email@example.com`
- Deployment checklist updated to reference env var instead of file edits

### .env.local Safety
- ✅ Confirmed gitignored: `.gitignore:34:.env*` matches `.env.local`
- `git check-ignore -v .env.local` confirms it is ignored
- No `.env.local` in `git ls-files`

### .env.example Safety
- ✅ Contains only placeholder values (`your_supabase_project_url`, `your_supabase_anon_key`)
- ✅ Tracked in git via `!.env.example` in `.gitignore`
- No real secrets exposed

---

## 9. Gap to Life Pulse OS / JARVIS Vision

The future vision is a premium personal operating system / AI life assistant — here is the gap analysis for every component:

### Today's Pulse
**Current:** Aggregates habits, tasks, journal, XP, finance. Static, no personalization.
**Needed:** Personalized daily briefing (weather, agenda, priority of the day, AI-suggested schedule). Animated dashboard with live data. "Good morning, [name]" greeting.

### Body Pulse
**Current:** Body realm exists with XP tracking. No health data.
**Needed:** Sleep tracking, workout logging, step count, heart rate, weight/BMI tracking, water intake, nutrition logging, integration with Apple Health / Health Connect.

### Mind Pulse
**Current:** Mind realm exists. Journal has mood/energy ratings.
**Needed:** Meditation tracking, focus sessions, reading log, mood trends over time, cognitive performance metrics.

### Money Pulse
**Current:** Finance module with accounts, transactions, budgets, charts. ILS hardcoded.
**Needed:** Multi-currency support, recurring transactions, bill reminders, net worth tracking, investment portfolio tracking, spending insights (AI-categorized), export to CSV/PDF, financial goal setting.

### Goal Pulse
**Current:** No dedicated goals feature. Projects serve as proxies.
**Needed:** Goal-setting framework (OKR or SMART), progress tracking aligned with XP, milestone tracking, quarterly/annual review.

### Project Pulse
**Current:** Projects CRUD with tasks, progress slider, deadlines.
**Needed:** Gantt/timeline view, milestone tracking, project templates, file attachments, collaboration (multi-user).

### Habit Pulse
**Current:** Habits CRUD, 5 frequency types, streak tracking, weekly progress.
**Needed:** Calendar heatmap, habit templates, smart reminders (time-based or location-based), habit notes per log, habit statistics (completion rate by month/quarter), habit stacking suggestions.

### Journal/Reflection
**Current:** Daily entries, mood/energy, reflection prompts.
**Needed:** Rich text editor, media attachments, entry search, calendar view, mood trend charts, AI-generated weekly summaries, prompt customization.

### Device Pulse
**Current:** Not started.
**Needed:** Smart ring (Oura, Ultrahuman), smartwatch (Apple Watch, Garmin, Fitbit, Whoop), continuous glucose monitor integration, sleep tracker data import.

### AI Coach
**Current:** Not started.
**Needed:** Daily next-best-action recommendation, habit suggestions based on patterns, journal reflection analysis, task prioritization AI, goal decomposition, weekly review generation, anomaly detection (e.g., "Your mood has been declining — check in with yourself").

### Weekly Review
**Current:** Not started.
**Needed:** Automated weekly summary (what went well, what needs work, streak report, XP earned, finance overview, mood trend), reflection prompts, goal progress review.

### Apple Health / Health Connect Readiness
**Current:** No health data storage schema.
**Needed:** Health metrics tables, data import pipeline (Apple Health XML export / Health Connect API), normalized health data model (steps, sleep, HR, weight, etc.).

### Daily Recommendations
**Current:** Not started.
**Needed:** AI-generated recommendations based on realm balance, habit streaks, task urgency, journal sentiment, finance status. "You haven't journaled in 3 days — want to reflect?" "Your Body realm is trailing — try a 10-minute walk."

### Automation / JARVIS-like Assistant Behavior
**Current:** Not started.
**Needed:** Proactive notifications, ambient suggestions, "good morning" briefing, automatic task rescheduling, habit time suggestions, anomaly alerts, conversational interface.

---

## 10. Recommended Upgrade Roadmap

### Phase 0: Private Beta Deployment Cleanup
**Goal:** Ship a stable, safe private beta
**What to build:**
- Replace `support@example.com` with real support email
- Add `loading.tsx` to all dashboard routes (simple skeleton)
- Add `error.tsx` to all dashboard routes (basic error boundary with retry)
- Remove default Next.js SVGs from `public/`
- Replace favicon.ico with Life Pulse mark
- Add Settings to mobile bottom nav
- Minor: extract duplicated input className into reusable component
**Likely affected files:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `public/*.svg`, `public/favicon.ico`, `src/components/DashboardNav.tsx`, `src/components/ui/input.tsx`, 8x `loading.tsx`, 8x `error.tsx`
**Database changes:** None
**Risks:** Low
**Difficulty:** Low

### Phase 1: Premium Dashboard Redesign
**Goal:** Elevate visual quality to premium "life OS" feel
**What to build:**
- Personalized greeting (time-of-day + name)
- Animated dashboard elements (counters, transitions)
- Glass-morphism panels on key surfaces
- Page transition animations
- Command palette (Cmd+K) for search and quick navigation
- Unified header/nav with breadcrumbs
**Likely affected files:** `src/app/today/page.tsx`, `src/app/layout.tsx`, `src/components/DashboardNav.tsx`, `src/app/globals.css`
**Database changes:** None
**Risks:** Medium — animation choices could impact performance
**Difficulty:** Medium

### Phase 2: Life OS Navigation and Sections
**Goal:** Restructure the app as a true operating system with sections
**What to build:**
- Split oversized pages (today 1052, finance 935, projects 875, onboarding 823, insights 727) into focused sub-components
- Create consistent section layout template
- Add data caching layer (SWR or TanStack Query)
- Add toast notification system
- Convert key data-fetching to React Server Components
**Likely affected files:** All dashboard pages, new `src/hooks/` directory, new `src/lib/api/` directory, `package.json` (add @tanstack/react-query or swr)
**Database changes:** None
**Risks:** Medium — refactoring without breaking existing flows requires careful testing
**Difficulty:** Medium

### Phase 3: Body / Mind / Money / Goals Upgrade
**Goal:** Deepen domain-specific features
**What to build:**
- Health metrics tables (sleep, steps, HR, weight, water, nutrition)
- Manual health logging UI
- Multi-currency finance support
- Financial goal setting
- Goal framework (OKR/SMART) with XP alignment
- Mood/energy trend charts in Journal
**Likely affected files:** New migrations, new route pages or sections, new components
**Database changes:** New tables for health metrics, goals; finance tables may need multi-currency columns
**Risks:** Medium — schema changes require migration planning
**Difficulty:** Medium-High

### Phase 4: Manual Health and Life Metrics
**Goal:** Enable comprehensive manual tracking before wearable integration
**What to build:**
- Body metrics dashboard (sleep log, workout log, weight, water, nutrition)
- Mind metrics dashboard (meditation, reading, focus sessions)
- Custom metric creation (users define their own tracked fields)
- Daily check-in (mood, energy, stress, sleep quality)
**Likely affected files:** New route pages, new components, new migration
**Database changes:** New `health_metrics` or `tracked_metrics` table
**Risks:** Medium — UX for custom metric creation is complex
**Difficulty:** Medium

### Phase 5: AI Daily Coach
**Goal:** Add AI-powered recommendations and insights
**What to build:**
- Daily next-best-action suggestion based on habits, tasks, realm balance
- Journal sentiment analysis (basic)
- Habit recommendation ("Try adding meditation to improve Mind realm")
- Weekly review generation (summarize XP, streaks, mood, finance)
- Anomaly detection ("Your mood has been trending down")
**Likely affected files:** New `src/lib/ai/` directory, new API route for AI calls, new components for AI suggestions on Today and Insights pages
**Database changes:** May need `ai_suggestions` table for caching
**Risks:** Medium-High — requires AI API integration (OpenAI, Claude, or local model), costs, latency
**Difficulty:** High

### Phase 6: Wearable Data Architecture
**Goal:** Normalized data model for importing health data
**What to build:**
- Health data tables (time-series metrics: heart rate, steps, sleep stages, calories, HRV, SpO2)
- Import pipeline (manual CSV/XML import)
- Data normalization layer
- Basic health charts and trends
**Likely affected files:** New migrations, new `src/lib/health/` directory, new components
**Database changes:** New time-series health data tables
**Risks:** Medium — time-series data is large, needs efficient querying
**Difficulty:** Medium

### Phase 7: Smart Ring / Watch Integrations
**Goal:** Direct API integrations with wearable devices
**What to build:**
- Oura Ring API integration
- Apple Health / Health Connect bridge
- Whoop API integration
- Automatic nightly sync
- Sleep/activity/readiness scores imported into Life Pulse
**Likely affected files:** New `src/lib/integrations/` directory, new API routes for OAuth, background sync jobs
**Database changes:** New `integrations` table, OAuth token storage
**Risks:** High — each API has different auth, rate limits, data formats; OAuth token refresh complexity
**Difficulty:** High

### Phase 8: JARVIS-like Automation Layer
**Goal:** Proactive, context-aware assistant
**What to build:**
- Proactive notifications ("Your Body realm streak is at risk")
- Ambient suggestions (subtle in-app nudges)
- Automatic task rescheduling (based on priority, deadlines, completion patterns)
- Automatic habit time suggestions
- Conversational interface (chat-like assistant)
- "Good morning" briefing (agenda, weather, priorities, health summary)
**Likely affected files:** New assistant UI, notification service, scheduling engine, AI prompt orchestration
**Database changes:** New `assistant_interactions`, `schedules`, `notifications` tables
**Risks:** High — complex orchestration, AI reliability, user trust, notification fatigue
**Difficulty:** Very High

---

## 11. Top 10 Issues / Gaps

1. **Excessively large pages** — Today (~1060 lines after Phase 1+2A), Finance (~925 lines after Phase 2A), Projects (~860 lines after Phase 2A), Onboarding (823 lines), Insights (727 lines). These are unmaintainable and will become blockers as features grow. Each should be 200-400 lines max with extracted sub-components.

3. **Hardcoded ILS currency** — Finance module defaults to ILS in both migrations and `formatCurrency` utility. International users cannot use finance features without code changes.

4. **No data caching strategy** — Every page fetches data fresh on every render. No SWR, no TanStack Query, no React Server Components for initial data. This will cause poor UX and unnecessary Supabase queries at scale.

5. **No default finance categories on signup** — Unlike realms (which are created during onboarding), finance categories are empty until the user manually creates them. New users who visit `/finance` first will see a blank state with no guidance.

6. ~~**No custom favicon** — Resolved in Phase 2A. `src/app/icon.svg` is a Life Pulse pulse/heartbeat design (dark bg, accent stroke, emerald dot). `favicon.ico` and `apple-icon.tsx` removed.~~ ✅

7. **Duplicated CSS patterns** — Input className strings duplicated ~25 times across auth pages and dashboard forms. `src/components/ui/input.tsx` exists but is not consistently used. Full migration deferred to Phase 1.

8. **All pages are `"use client"`** — No React Server Components for initial data fetching. Only `/`, `/privacy`, and `/terms` are server components. This increases client JS bundle size and prevents SSR for dashboard data.

9. **No Supabase query caching** — Every `useEffect` + `supabase.from().select()` fetches data fresh on mount. No SWR/TanStack Query layer. Unnecessary network requests on every navigation.

10. **Finance missing default categories** — Unlike realms (seeded during onboarding), finance has no defaults. New users see an empty state with no guided setup.

---

## 12. Phase 0 Completion Note

### What Changed
- **Support email**: Created `src/lib/config.ts` with `getSupportEmail()` reading from `NEXT_PUBLIC_SUPPORT_EMAIL` env var. Updated privacy + terms pages. Updated `.env.example`.
- **Loading states**: Added `loading.tsx` to root and all 8 dashboard routes (today, habits, tasks, projects, finance, journal, insights, settings) with dark-themed skeleton placeholders.
- **Error boundaries**: Added `error.tsx` to root and all 8 dashboard routes with "Try again" buttons using `reset()`.
- **Mobile navigation**: Added Settings link to mobile bottom nav in `DashboardNav.tsx`.
- **Public assets**: Removed unused default Next.js SVGs (file.svg, globe.svg, next.svg, vercel.svg, window.svg).
- **Input primitives**: Created `TextArea.tsx` and `Select.tsx` UI components. Full migration of existing pages deferred to Phase 1 to avoid layout risk.
- **Route count**: Fixed audit summary (16 working + 1 partial = 17 routes; `/_not-found` is auto-generated).

### What Was Intentionally Not Changed
- No toast/notification system (Phase 1)
- No page refactoring (Phase 1)
- No favicon replacement (needs designer input)
- No ILS currency generalization (Phase 3)
- No data caching strategy (Phase 2)
- No finance default category seeding (Phase 3)
- No React Server Components conversion (Phase 2)
- Individual page input CSS migration (Phase 1)

### Remaining Blockers Before Beta
1. Add `NEXT_PUBLIC_SUPPORT_EMAIL` to Vercel env vars
2. Run post-deploy smoke test
3. Run RLS smoke test (requires test users in Supabase)

## 13. Phase 1 Completion Note — Premium Dashboard Redesign

### What Changed
- **Dashboard UI primitives**: Created 4 reusable components in `src/components/ui/`:
  - `pulse-card.tsx` — Card with optional accent header, title, description, action slot, and variant support
  - `metric-card.tsx` — Compact KPI display card with icon, label, value, trend indicator, and active state
  - `section-header.tsx` — Consistent section heading with accent dot, label, optional count and action slot
  - `empty-state.tsx` — Reusable empty state with message, description, and optional CTA
- **Today page redesign** (`/today`):
  - Added "Today's Pulse" header badge with "Life OS · Mission Control" sub-label
  - Added 5-column **Command Strip** with compact MetricCards for Habits, Tasks, Reflection, XP, and Money (Money links to /finance)
  - Grouped priorities + quick capture into a single **Mission Control** PulseCard
  - Kept existing next-action suggestion card
  - Rebranded sections: habits → **Body Pulse**, tasks → **Mind Pulse**, journal → **Evening Reflection**
  - Added all-done "Day complete" banner
  - Used `EmptyState` component for empty habit/task states
  - Welcome message updated to "Welcome to your Life OS"
- **DashboardNav polish** (`DashboardNav.tsx`):
  - Active nav items now show a left accent bar (gradient from accent to accent-strong)
  - "Today" renamed to **"Today's Pulse"** (mobile nav shows "Today" for space)
  - Nav group "primary" renamed to **"Pulse"** group
  - Settings sidebar now matches nav item styling with active accent bar
  - Mobile bottom nav now has `backdrop-blur-sm` for premium glass effect
  - Improved hover states across all nav items
- **Life OS language** introduced throughout:
  - "Today's Pulse", "Mission Control", "Body Pulse", "Mind Pulse", "Evening Reflection"
  - "Life OS · Mission Control" header tagline
  - "Welcome to your Life OS" onboarding copy
  - "Pulse" nav group label

### What Was Intentionally Not Changed
- No toast/notification system (Phase 2)
- No page extraction/refactoring (Phase 2 — today page remains ~1050 lines with new layout)
- No input CSS migration (Phase 2)
- No data caching (Phase 2)
- No animated transitions beyond existing CSS animations
- No favicon replacement (needs designer input)
- No ILS currency generalization (Phase 3)
- No AI coach or wearable features (Phase 4+)

### Files Touched
| File | Change |
|------|--------|
| `src/components/ui/pulse-card.tsx` | **Created** — reusable pulse card with accent header |
| `src/components/ui/metric-card.tsx` | **Created** — compact KPI display |
| `src/components/ui/section-header.tsx` | **Created** — consistent section heading |
| `src/components/ui/empty-state.tsx` | **Created** — reusable empty state |
| `src/app/today/page.tsx` | **Redesigned** — new header, command strip, mission control, Life OS rebranding |
| `src/components/DashboardNav.tsx` | **Polished** — active accent bar, premium sidebar, Life OS labels, mobile glass |
| `docs/LIFE_PULSE_CURRENT_STATE_AUDIT.md` | **Updated** — Phase 1 summary |

### Build Verification
- `npm run lint` ✅ — 0 ESLint errors
- `npm run build` ✅ — Compiled successfully, all 18 pages generated

## 14. Phase 1.5 Visual QA and Polish Pass

### What Was Checked
- **Today page layout**: Spacing, card alignment, heading hierarchy, mobile/tablet/desktop responsiveness, command strip density, Mission Control clarity, Body/Mind/Reflection section labels, empty state consistency, premium feel
- **Navigation sidebar**: Active state indicators, mobile bottom nav, Settings visibility, route labels, spacing, overflow, route accessibility (all 8 protected routes)
- **Cross-route consistency**: /habits, /tasks, /projects, /finance, /journal all confirmed using shared `DashboardNav` pattern without breakage
- **Mobile responsiveness**: 360px / 390px / 768px / desktop layouts reasoned from JSX/Tailwind classes
- **Brand language**: "Today's Pulse", "Mission Control", "Body Pulse", "Mind Pulse", "Evening Reflection", "Life OS" — used professionally without overuse
- **Accessibility**: Button labels, keyboard reachability, focus states, contrast, error/loading state consistency

### Issues Found and Fixed
| Issue | Severity | Fix |
|-------|----------|-----|
| Command Strip `grid-cols-5` on 360px screens (each card ~60px) | High | Changed to `grid-cols-3 sm:grid-cols-5` — mobile shows 3 across, desktop 5 |
| Loading skeleton also used `grid-cols-5` — same cramped mobile layout | High | Same responsive fix applied to loading skeleton |
| Mobile bottom nav Settings link had `py-2` vs `py-1.5` on other items | Low | Changed Settings to `py-1.5` for visual consistency |
| PulseCard title was `text-xs` — too small for section-level headings | Medium | Bumped to `text-sm font-semibold tracking-tight` |
| Finance sidebar money link used hardcoded `text-green-400`/`text-red-400` (Tailwind defaults, not custom palette) | Low | Changed to `text-[var(--success)]`/`text-[var(--danger)]` CSS variables |

### What Was Deferred to Phase 2
- ~~Toast/notification system~~ ✅ (Phase 2A)
- Input CSS migration to primitives (partially done in Phase 2A — habits, tasks done; projects, finance, settings remaining)
- Data caching layer (SWR/TanStack Query)
- Animated transitions and micro-interactions
- Page size refactoring (extract sub-components from oversized pages)
- ~~Favicon replacement~~ ✅ (Phase 2A)
- Weekly review feature

### Files Changed in Phase 1.5
| File | Change |
|------|--------|
| `src/app/today/page.tsx` | Responsive command strip (`grid-cols-3 sm:grid-cols-5`), finance color CSS vars |
| `src/components/DashboardNav.tsx` | Mobile nav Settings `py-1.5` consistency |
| `src/components/ui/pulse-card.tsx` | Title bumped to `text-sm` |
| `docs/LIFE_PULSE_CURRENT_STATE_AUDIT.md` | Phase 1.5 note added |

## 15. Phase 2A Completion Note — UX Foundation Cleanup

### Goal
Replace inline feedback patterns with a unified toast system, consolidate form primitives, fix favicon/branding, and standardize loading/error patterns — before adding new Life OS sections.

### What Changed

#### Toast System
- **Created `src/hooks/use-toast.tsx`** — Toast context, `ToastProvider`, `useToast` hook, `ToastCard` component. Dark-glass styling, auto-dismiss 4s, max 5 visible. Success/error/info/warning types with SVGs.
- **Root layout updated** (`src/app/layout.tsx`) — `<ToastProvider>` wraps all pages.
- **7 pages migrated** from inline `feedback` banners to `useToast`:
  - Habits — 6 toast calls (create, update, delete, error)
  - Tasks — 8 toast calls (create, update, delete, toggle, error)
  - Projects — 11 toast calls (create, update, delete, quick plan, add task, toggle, error)
  - Finance — 11 toast calls (save transaction, delete, add budget, delete budget, add account, delete account, load error, validation)
  - Today — 8 toast calls (quick capture success/error, habit toggle, task toggle, validation)
  - Journal — 4 toast calls (save/update success, error)
  - Settings — 1 toast call (profile save success, error)
- **All `setFeedback`, `setSaved`, `setError`/`setQuickError` inline patterns** removed from migrated pages.
- **File renamed** `use-toast.ts` → `use-toast.tsx` (required for JSX support).

#### Form Primitives Migration
- **Habits page**: Title `<input>` swapped to `Input` primitive.
- **Tasks page**: Title + Due date `<input>` swapped to `Input` primitive.
- Projects, finance, settings inputs still use inline className patterns — deferred.

#### Favicon / Branding
- **Created `src/app/icon.svg`** — Custom Life Pulse favicon: dark rounded rect (`#0b0d10`), pulse/heartbeat path (`#7aa2c7`), emerald dot (`#7fb394`). 32×32 SVG.
- **Removed `src/app/favicon.ico`** — Old default Next.js favicon.
- **Removed `src/app/apple-icon.tsx`** — Caused build error (`ImageResponse` missing), apple icon falls back to `icon.svg` automatically.
- **Cleaned layout metadata** — Removed stale `icons.apple` reference.
- `public/` remains empty (clean since Phase 0).

#### Loading / Error Patterns
- All routes already had loading skeletons + error boundaries from Phase 0.
- No new loading/error infrastructure added — scope limited to toast migration.

### Files Changed in Phase 2A

| File | Change |
|------|--------|
| `src/hooks/use-toast.tsx` | **Created** — toast context, provider, hook, ToastCard |
| `src/app/layout.tsx` | **Updated** — added `<ToastProvider>`, cleaned metadata icons |
| `src/app/icon.svg` | **Created** — Life Pulse pulse/heartbeat favicon |
| `src/app/favicon.ico` | **Removed** — old default favicon |
| `src/app/apple-icon.tsx` | **Removed** — broken `ImageResponse` handler |
| `src/app/habits/page.tsx` | **Updated** — toast migration, Input primitive for title |
| `src/app/tasks/page.tsx` | **Updated** — toast migration, Input primitives for title + due date |
| `src/app/projects/page.tsx` | **Updated** — toast migration (11 calls), removed feedback JSX |
| `src/app/finance/page.tsx` | **Updated** — toast migration (11 calls), removed feedback JSX |
| `src/app/today/page.tsx` | **Updated** — toast migration (8 calls), removed quickSuccess/quickError state |
| `src/components/JournalSection.tsx` | **Updated** — toast migration (4 calls), removed saved/error state |
| `src/app/settings/page.tsx` | **Updated** — toast migration for profile save, removed saved/error state |

### Build/Lint Verification
- `npm run lint` ✅ — 0 errors, 1 warning (use-toast.tsx ref clean-up, pre-existing)
- `npm run build` ✅ — Compiled successfully, 19 pages generated (17 routes + `/_not-found` + `icon.svg`)
- No `npm run typecheck` script (Next.js build includes TypeScript check)
- No `npm run test` script (only `test:rls` for RLS smoke testing)

### Stale Branding Search Results
- `support@example.com` — Not found in source code. Only in audit docs referencing the Phase 0 fix.
- Default SVGs (next.svg, vercel.svg, file.svg, globe.svg, window.svg) — Not found in source. Removed in Phase 0.
- `public/` — Empty. Clean.
- `favicon.ico` — Removed. Replaced by `icon.svg`.

### CRUD Verification Summary (Code Review)
| Flow | File | Toasts? | Behavior Preserved? | Risks |
|------|------|---------|---------------------|-------|
| Habits create/update/delete | `src/app/habits/page.tsx` | ✅ | Yes — replaced inline `feedback` with `toast()`, same logic flow | None |
| Habits complete/uncomplete | `src/app/today/page.tsx` | ✅ | Yes — same supabase calls, toast on success | None |
| Tasks create/update/delete | `src/app/tasks/page.tsx` | ✅ | Yes — same logic, Input primitive for title/due date | None |
| Tasks complete/uncomplete | `src/app/today/page.tsx` + `src/app/tasks/page.tsx` | ✅ | Yes — same `toggleTaskCompletion` helper | None |
| Projects create/update/delete | `src/app/projects/page.tsx` | ✅ | Yes — all 6 CRUD paths + quick plan + add task + toggle | None |
| Journal save/update | `src/components/JournalSection.tsx` | ✅ | Yes — removed `setSaved`/`setError`, toast only | None |
| Settings/profile save | `src/app/settings/page.tsx` | ✅ | Yes — removed inline "Saved!" text + error display | Minimal UX change (no "Saved!" indicator) |
| Finance CRUD (tx, budget, account) | `src/app/finance/page.tsx` | ✅ | Yes — all 11 feedback paths migrated, same logic | None |
| Auth (signup/login/onboarding/logout) | Not touched | N/A | Unaffected | Zero risk |

### Remaining Risks
1. **Settings profile save** no longer shows inline "Saved!" indicator — user must now rely on toast. Acceptable trade-off for consistency.
2. **Auth pages** (login, signup, forgot/reset password) still use inline `setError` — these show form-level validation errors, not action feedback. Appropriate to keep.
3. **Finance default categories** still missing on fresh signup (pre-existing issue).
4. **Input primitive migration** only partial (habits + tasks done). Projects, finance, and settings still use inline className patterns.
5. **`use-toast.tsx`** has one lint warning about ref cleanup in effect — cosmetic, no runtime impact.

### Recommended Next Phase
**Phase 2B — Life OS Information Architecture and New Section Planning**
- Split oversized pages (today, finance, projects) into focused sub-components
- Convert key data-fetching to React Server Components
- Add data caching layer (SWR or TanStack Query)
- Plan Body Pulse, Mind Pulse, Goal Pulse, Device Pulse sections
- Migrate remaining inline input patterns to `Input`/`TextArea`/`Select` primitives
- Do NOT start AI coach, wearable integration, or database schema changes

## 16. Phase 2B Completion Note — Life OS Architecture and Implementation Plan

### Goal
Audit current information architecture, design the future Life OS route map, propose navigation restructuring, create a technical plan for splitting oversized pages, plan data layer improvements, design future schema for Body/Mind/Goals/Devices, plan wearable integration, and plan the AI Coach — all without implementing features or changing schema.

### What Was Created
- **`docs/LIFE_OS_ARCHITECTURE_PLAN.md`** — Comprehensive 200+ line architecture document covering all 10 task areas.

### Key Decisions
1. **Navigation Architecture**: Pulse → Growth → Life Domains → Intelligence → System (5 groups). Phase 3 renames "Build" → "Growth" and moves Finance to "Life Domains" as "Money". Body, Mind, Goals, Coach added in later phases.
2. **Page Split Order**: Finance (lowest risk) → Projects → Today → Insights → Onboarding (highest risk). Each extraction documented with proposed component breakdown, estimated line reduction, and risk level.
3. **Data Layer**: Custom hooks (`useHabits`, `useTasks`, etc.) in Phase 3 before evaluating SWR/React Query. No dependencies added yet. Cache helper option available if needed.
4. **Future Schema**: Body (`body_metric_types`, `body_metric_logs`), Mind (`mind_session_types`, `mind_session_logs`), Goals (`goals`, `goal_milestones`, `goal_links`), Devices (`integration_providers`, `user_integrations`), Coach (`coach_recommendations`, `weekly_reviews`). All proposals — no migrations created.
5. **Wearable Integration**: Manual entry first (Phase 4), HealthKit/Health Connect (Phase 6), Oura/smart ring APIs (Phase 7), generic provider abstraction (Phase 8). NOT direct BLE integration.
6. **AI Coach**: Rule-based first (Phase 5), LLM-assisted optional (Phase 7). Data read from all existing tables but never shared without consent.
7. **No Placeholder Routes**: Decision not to add `/body`, `/mind`, `/goals`, `/devices`, `/coach` yet. They create confusing pages for beta testers.
8. **ADR-001 through ADR-006**: Documented architecture decisions with accepted status, rationale, and risk.

### Build/Lint Verification
- No code changed — only documentation created/updated.
- `npm run lint` ✅ — 0 errors (1 pre-existing warning)
- `npm run build` ✅ — Compiles cleanly

### Files Touched
| File | Change |
|------|--------|
| `docs/LIFE_OS_ARCHITECTURE_PLAN.md` | **Created** — comprehensive architecture and implementation plan |
| `docs/LIFE_PULSE_CURRENT_STATE_AUDIT.md` | **Updated** — Phase 2B completion note |

### Remaining Risks (Unchanged from Phase 2A)
- Finance missing default categories (pre-existing)
- Input primitive migration partial
- Auth pages still use inline error states (appropriate)

## 17. Recommended Next Prompt

```
Continue Phase 1: Premium dashboard redesign and navigation overhaul.

Phase 1 goal: Elevate the existing dashboard UI to feel premium without adding features. Make Life Pulse look and feel like a life operating system, not a productivity tool.

Reminder of the Life Pulse Golden Rules:
- Keep design dark, calm, professional, premium, market-ready.
- Do not add new features.
- Do not change database schema or RLS.
- Do not break existing auth, onboarding, or dashboard flows.
- Preserve all existing behavior.
- Every change must be buildable.

Tasks:

1. Add toast notification system using a lightweight approach (CSS-only or minimal JS). All dashboard pages should show save confirmations and error feedback for user actions. Create a shared toast context/provider and use it where appropriate.

2. Consolidate duplicated input styling. Migrate all auth pages (login, signup, forgot-password, reset-password) and dashboard forms to use the Input/TextArea/Select/Button primitives in src/components/ui/. Remove inline Tailwind className patterns. Do not change layout.

3. Add data caching layer. Integrate SWR or TanStack Query for all Supabase data fetches. Eliminate useEffect + direct supabase calls. Cache user profile, realms, habits, tasks, projects, finance data with stale-while-revalidate semantics.

4. Add animated dashboard elements: page transition animations, micro-interactions on cards/buttons, smooth data loading transitions. Use CSS animations only, no external animation libraries.

5. Restructure oversized pages. Extract repeated sub-components from today (1052 lines), finance (935 lines), projects (875 lines), onboarding (823 lines), and insights (727 lines) into focused components. Target max 400 lines per page file.

Run `npm run lint && npm run build` after each change. When done, update the audit document to reflect Phase 1 status.
```
