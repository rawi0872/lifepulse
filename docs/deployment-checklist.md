# Life Pulse — Production Deployment Checklist

## 0. First-Time GitHub Push

Run these commands once to create the GitHub remote and push:

```bash
# Rename branch from master to main
git branch -M main

# Create GitHub repo (via browser or gh CLI):
#   1. Go to https://github.com/new
#   2. Repo name: lifepulse (or your choice)
#   3. Do NOT initialize with README, .gitignore, or license
#   4. Click "Create repository"

# Link remote and push
git remote add origin https://github.com/YOUR-USERNAME/lifepulse.git
git push -u origin main

# Tag the beta release
git tag -a private-beta-v1 -m "Private beta v1"
git push origin private-beta-v1
```

**Pre-flight checks before pushing:**
- [ ] `.env.local` is NOT staged — run `git status` and confirm it does not appear
- [ ] `.env.example` IS tracked — run `git ls-files .env.example` to confirm
- [ ] No real secrets in any committed file
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run build` passes (27 pages compiled)
- [ ] `npm run test:prod` passes (requires `.env.test.local` with valid test credentials)
- [ ] Toast system functional (verify on all dashboard pages)
- [ ] Custom favicon present (`/icon.svg` — Life Pulse pulse/heartbeat)
- [ ] Favicon rewrite configured (`/favicon.ico → /icon.svg` in next.config.ts)
- [ ] Metadata icons: icon, shortcut, and apple-touch-icon all set to `/icon.svg`
- [ ] Passions form placeholder uses "Passion name" (not bare "Name") for test compatibility

---

## 1. Vercel Deployment

### 1.1 Import Project

1. Go to [Vercel Dashboard](https://vercel.com) → **Add New** → **Project**
2. Click **Import Git Repository** and select your `lifepulse` repo
3. Vercel auto-detects the Next.js framework — confirm:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next` (default)
   - **Node.js Version:** 20.x or later

### 1.2 Environment Variables

Add these in Vercel → Project Settings → Environment Variables (or during import):

| Variable | Required | Value |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anon/public key |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Yes | Your support email (e.g. `support@lifepulse.app`) |

**Important:**
- Do **not** add the Supabase `service_role` key — it bypasses RLS and must never be in client-accessible code.
- Keep production and local `.env.local` values separate in different environments.
- Confirm `.env.local` is in `.gitignore` and was **not** committed.

### 1.3 Deploy

1. Click **Deploy**
2. Wait for build to complete ("Ready" status)
3. Vercel assigns a production URL (e.g. `lifepulse.vercel.app`)
4. Copy this URL — needed for Supabase Auth configuration below

---

## 2. Supabase Auth URL Configuration

Open [Supabase Dashboard](https://supabase.com) → Authentication → URL Configuration.

### Site URL
- Set to your production domain: `https://YOUR-DOMAIN.com`

### Redirect URLs
Add both of the following:

**For local development:**
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/reset-password`

**For production:**
- `https://YOUR-DOMAIN.com/auth/callback`
- `https://YOUR-DOMAIN.com/reset-password`

### Phase 5C QA (June 23, 2026)
- Goal links migration QA: follows project conventions, security model correct, 17 tables ✅
- Goal links UI QA: expand button now shows when links exist (fixed bug — was gated on milestones only) ✅
- Goals page behavior QA: create/edit/delete/complete/reopen/add-milestone/toggle-milestone/delete-milestone/add-link/remove-link all verified from code ✅
- Today Goal Pulse QA: lightweight query (id, status, target_date + goal_id, completed_at), no divide-by-zero, clean empty state ✅
- Cross-page integration: `/projects` shows "Goal" badge for linked projects (light query, no schema change) ✅
- RLS smoke test review: 13 goal_links tests cover read/update/delete/FK/positive/self-read/cleanup, no credentials hardcoded ✅
- Build output includes /goals /body /mind (23 routes total) ✅
- 17 app tables total (profiles, realms, habits, habit_logs, tasks, xp_events, journal_entries, projects, finance_accounts, finance_categories, finance_transactions, finance_budgets, body_metrics, mind_metrics, goals, goal_milestones, goal_links)

### Phase 6A QA (June 23, 2026)
- /devices route created with loading + error states ✅
- Route protected in proxy.ts ✅
- DashboardNav updated — Devices added to Intelligence group (after Insights) ✅
- Device Pulse architecture doc created (docs/DEVICE_PULSE_ARCHITECTURE.md) — defines schema, provider strategy, privacy model ✅
- Audit doc updated: 24 routes, updated nav, Device Pulse section reflecting placeholder status ✅
- Architecture plan updated: route map, nav structure, gaps table ✅
- No schema changes (Phase 6B is next) ✅
- 24 routes total (23 existing + /devices) ✅
- 17 app tables (unchanged from Phase 5C)

### Phase 7A QA (June 24, 2026)
- Feedback system migration (00011) creates `beta_feedback` table with insert-only RLS + `on delete set null` ✅
- Feedback dialog UI opens from sidebar footer, collects rating (1-5), category, message, auto browser info ✅
- Auth pages use `friendlyAuthError()` — safe, specific messages, no raw Supabase errors, no email enumeration ✅
- Mobile nav has 5 fixed tabs (Today, Goals, Body, Journal, More) + "More" bottom sheet ✅
- Next Best Action card shows on `/today` — rule-based, max 2 suggestions, links to correct pages ✅
- Finance default categories updated (9 expense, 4 income) — idempotent seeding ✅
- Production smoke test (`npm run test:prod`) tests feedback dialog, NextBestAction, finance seeds ✅
- 18 app tables total (17 existing + beta_feedback)
- 24 routes total (unchanged — no new routes in Phase 7A)

### Phase 8B QA (June 24, 2026)
- Passions migration (00013) creates 3 tables (passions, passion_sessions, passion_milestones) with RLS + indexes + updated_at trigger ✅
- /passions route renders with 4 tabs (Overview, My Passions, Sessions, Milestones) ✅
- All passions CRUD operations work (create, edit, delete passions; log sessions; add/complete milestones) ✅
- Today NextBestAction shows "Add a passion" (no active passions) or "Log a practice session this week" (no session this week) ✅
- Passions link added to desktop sidebar (Life Domains) and mobile "More" bottom sheet ✅
- PassionsInsights card renders on /insights, shows active passions, weekly sessions/minutes, completed milestones ✅
- Production smoke test extended with passions tests (page load, add passion, log session) ✅
- 25 routes total (24 existing + /passions) ✅
- 21 app tables total (18 existing + passions, passion_sessions, passion_milestones)

### Phase 9A QA (June 24, 2026)
- /weekly-review route created with 5 sections (Week Summary, Body & Mind, Goals & Growth, Passions, Reflection) ✅
- No new database tables — reads from 13 existing tables, reflection saved to journal_entries ✅
- Proxy protection added for /weekly-review ✅
- Desktop sidebar: Weekly Review added to Pulse group (after Today) ✅
- Mobile "More" sheet: Weekly Review accessible ✅
- NextBestAction: Monday shows "Plan your week ahead", Thu-Sat shows "Review your week" ✅
- Insights page: "Open Weekly Review" link card ✅
- Plan Next Week section with rule-based suggested actions (no AI) ✅
- Production smoke test extended with weekly review tests (page load, sections, reflection) ✅
- 26 routes total (25 existing + /weekly-review) ✅
- 21 app tables (unchanged from Phase 8B — no new tables)
- Recommended next phase: Phase 10A — Rule-Based Coach Engine

### Phase 9B QA (June 24, 2026)
- Passions form placeholder uses "Passion name" (not bare "Name") — tests pass ✅
- Passions add button uses "Save Passion" (not "Add Passion") — matches smoke test selector ✅
- Asset 404s fixed: /favicon.ico rewrite → /icon.svg in next.config.ts ✅
- Metadata icons complete: icon, shortcut, and apple-touch-icon all point to /icon.svg ✅
- Signup/onboarding flow audited — friendly error messages, validation, realm selection all work ✅
- Mobile navigation polished — 5-tab bottom bar (Today, Goals, Body, Journal, More) + "More" bottom sheet with all routes ✅
- Feedback system verified — categories, rating, message submit to beta_feedback table ✅
- Copy polished across empty states, placeholders, buttons ✅
- Documentation updated for Phase 9B (state audit, deployment checklist, AGENTS.md) ✅
- Build: 0 errors, 6 pre-existing lint warnings (unchanged) ✅
- 26 routes (unchanged — no new routes in Phase 9B)

### Phase 9C QA (June 24, 2026)
- Passions save bug fixed: all inserts now include `user_id` — RLS no longer rejects ✅
- Smoke test made honest: removed `skip()`, passions tests verify data persistence (name appears in list, session appears as "30 min", milestone appears in list) ✅
- Visual polish: passions overview gradient cards, weekly review accent section headers + PulseCard upgrades ✅
- Knowledge system created: migration (00014), 3 tables, RLS, indexes, triggers ✅
- Knowledge route (`/knowledge`) created with 4 tabs (Overview, Add, Collections, Recent Items) ✅
- Knowledge added to navigation (Intelligence group, desktop + mobile More) ✅
- `/knowledge` and `/passions` added to `protectedRoutes` in proxy middleware ✅
- Insights page shows "Open Knowledge" link card ✅
- Production smoke test: 3 new Knowledge sections, post-logout redirect includes /knowledge + /passions ✅
- 27 routes (26 existing + /knowledge) ✅
- 24 app tables (21 existing + knowledge_items, knowledge_collections, knowledge_collection_items)
- Recommended next phase: Invite 2–5 private beta testers

### Vercel Preview Deployments
- Vercel preview deployments get random URLs (e.g. `project-xxxxx.vercel.app`). Auth redirects to these URLs will fail if they are not whitelisted in Supabase.
- **Recommendation:** Disable auth testing on preview deployments, or add `https://*-username.vercel.app/auth/callback` as a wildcard redirect URL (Supabase supports `*` wildcards in redirect URLs). Test password reset and email confirmation only on the production domain.

---

## 3. Supabase Database

- [ ] **Confirm all migrations applied** — Run `supabase migration list` (all should show as "local" or "remote" up)
- [ ] **Confirm RLS enabled** — Check all user tables have `enable row level security` applied
- [ ] **Clean test data** — Remove any test accounts or dummy data from the production database unless intentional
- [ ] **Point-in-Time Recovery (PITR)** — Enable in Supabase dashboard for production data safety

---

## 4. Production Smoke Test

After deploying, test every route and flow:

### Automated Smoke Test
- [ ] Run `npm run test:prod` — tests feedback dialog, NextBestAction, finance seeds, passions CRUD, weekly review, and all route rendering

### Public pages
- [ ] Landing page (`/`) — loads, nav links work, footer links work
- [ ] Privacy Policy (`/privacy`) — loads, has support email
- [ ] Terms of Service (`/terms`) — loads, has support email
- [ ] Footer — Privacy and Terms links go to correct pages

### Auth flows
- [ ] Signup (`/signup`) — account creation works, friendly error messages shown on validation issues
- [ ] Login (`/login`) — "Forgot password?" link visible, sign in works, friendly errors for wrong credentials
- [ ] Logout — clears session, redirects to login
- [ ] Email confirmation (if enabled) — users receive confirmation email
- [ ] Forgot password (`/forgot-password`) — sends reset email, shows generic "If an account exists…" message (no email enumeration)
- [ ] Reset password — click email link, set new password, success shown, can log in with new password
- [ ] Protected routes redirect to `/login` when logged out (`/today`, `/habits`, `/tasks`, `/projects`, `/finance`, `/journal`, `/insights`, `/settings`, `/body`, `/mind`, `/devices`)

### Onboarding & Core App
- [ ] Onboarding — first-time flow works, creates profile
- [ ] `/today` — priorities, habits, quick capture all work; Next Best Action card visible with suggestions (including weekly review hints on Mon/Thu-Sat)
- [ ] `/today` — feedback dialog opens from sidebar, submit works with all rating/category combinations
- [ ] `/today` — feedback dialog opens from sidebar, submit works with all rating/category combinations
- [ ] `/habits` — create, log, edit, delete habits
- [ ] `/tasks` — create, complete, organize tasks
- [ ] `/projects` — create, manage, link tasks, update, delete
- [ ] `/finance` — accounts, transactions, budgets all work
- [ ] `/journal` — write, save, view journal entries
- [ ] `/insights` — Life Balance Map renders, expanded dialog opens/closes
- [ ] `/settings` — profile, realms, password settings save correctly
- [ ] `/body` — Body Pulse manual metrics form saves/updates (sleep, steps, energy, HR, workouts, weight, recovery)
- [ ] `/mind` — Mind Pulse manual metrics form saves/updates (mood, stress, focus, clarity, motivation, tags, reflection)
- [ ] `/goals` — Goal Pulse works: create/edit/complete/pause/archive goals, add/toggle/delete milestones, add/remove goal links to projects/tasks/habits
- [ ] `/goals` — Goal links appear on linked project pages ("Goal" badge)
- [ ] `/devices` — Device Pulse placeholder page loads, shows "Coming Soon" state, links to Body/Mind
- [ ] `/weekly-review` — loads all sections, reflection saves to journal, plan next week suggestions show

### Mobile (narrow viewport)
- [ ] Landing page — responsive, no overflow
- [ ] Onboarding — form inputs usable on small screen
- [ ] `/today` — priorities, habits, quick capture all usable
- [ ] `/finance` — account cards, transaction list, budget cards fit viewport
- [ ] `/insights` — expanded Life Balance Map dialog scrollable and closable
- [ ] `/settings` — form fields and buttons accessible
- [ ] `/body` — Body Pulse form scrollable on mobile viewport
- [ ] `/mind` — Mind Pulse form scrollable on mobile viewport
- [ ] `/goals` — Goal Pulse expandable sections work on mobile
- [ ] `/devices` — Device Pulse cards readable on mobile

---

## 5. RLS Production Smoke Test

**Before inviting testers**, run the RLS smoke test against the **production** Supabase project.
The smoke test covers: profiles, realms, habits, habit_logs, tasks, xp_events, journal_entries, projects, finance_accounts, finance_categories, finance_transactions, finance_budgets, body_metrics, mind_metrics, goals, goal_milestones, goal_links, beta_feedback, passions, passion_sessions, passion_milestones, knowledge_items, knowledge_collections, knowledge_collection_items (24 tables total).

1. Create two test accounts in the production Supabase Auth (use email/password)
2. Set these environment variables locally:
   - `RLS_TEST_USER_A_EMAIL`
   - `RLS_TEST_USER_A_PASSWORD`
   - `RLS_TEST_USER_B_EMAIL`
   - `RLS_TEST_USER_B_PASSWORD`
3. Run:
   ```bash
   npm run test:rls
   ```
4. Expected result: User A cannot read, update, or delete User B's data
5. Clean up test accounts after verification

---

## 6. Security Checklist

- [ ] No `service_role` key in any client-accessible file
- [ ] No hardcoded secrets or API keys in source code
- [ ] `.env.local` is in `.gitignore` and was not committed
- [ ] No `.env` files other than `.env.example` committed to repo
- [ ] RLS smoke test passes
- [ ] Protected routes redirect unauthenticated users to `/login`
- [ ] Privacy and Terms links exist in the landing page footer
- [ ] Security headers (CSP, HSTS, X-Content-Type-Options, etc.) are present in production responses
- [ ] No raw Supabase error messages shown to users (auth pages use `friendlyAuthError()` with safe messages)
- [ ] Forgot password always shows "If an account exists…" — does not reveal whether email is registered
- [ ] Reset password requires valid session (redirects to `/login` if no session)

---

## 7. Beta Launch Checklist

- [ ] **Set `NEXT_PUBLIC_SUPPORT_EMAIL`** — Add to Vercel env vars (e.g. `support@lifepulse.app`)
- [ ] **Invite 2–5 testers first** — Small group to catch early issues
- [ ] **Ask testers to report bugs** — Ask for reproduction steps and screenshots
- [ ] **Freeze new features** — Do not add major features during the first test cycle
- [ ] **Bug-fix only mode** — During beta stabilization, only fix bugs and critical issues

---

## 8. Post-Deployment Verification

- [ ] Vercel deployment shows "Ready" status
- [ ] Custom domain (if any) resolves and SSL works
- [ ] Supabase project shows active connections
- [ ] `npm run build` passes locally (current state ✅)
- [ ] `npm run lint` passes locally (current state ✅)
- [ ] `npm run test:prod` passes against production (requires `.env.test.local`)
- [ ] Build output includes all 27 routes: /, /auth/callback, /body, /devices, /finance, /forgot-password, /goals, /habits, /icon.svg, /insights, /journal, /knowledge, /login, /mind, /onboarding, /passions, /privacy, /projects, /reset-password, /settings, /signup, /tasks, /terms, /today, /weekly-review

---

*Life Pulse — Last updated: June 24, 2026 (Phase 9C — Pre-Beta Bug Fixes + Knowledge System)*
