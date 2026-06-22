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
- [ ] `npm run build` passes (19 pages compiled)
- [ ] Toast system functional (verify on all dashboard pages)
- [ ] Custom favicon present (`/icon.svg` — Life Pulse pulse/heartbeat)

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

### Public pages
- [ ] Landing page (`/`) — loads, nav links work, footer links work
- [ ] Privacy Policy (`/privacy`) — loads, has support email
- [ ] Terms of Service (`/terms`) — loads, has support email
- [ ] Footer — Privacy and Terms links go to correct pages

### Auth flows
- [ ] Signup (`/signup`) — account creation works
- [ ] Login (`/login`) — "Forgot password?" link visible, sign in works
- [ ] Logout — clears session, redirects to login
- [ ] Email confirmation (if enabled) — users receive confirmation email
- [ ] Forgot password (`/forgot-password`) — sends reset email, shows generic success
- [ ] Reset password — click email link, set new password, success shown, can log in with new password
- [ ] Protected routes redirect to `/login` when logged out (`/today`, `/habits`, `/tasks`, `/projects`, `/finance`, `/journal`, `/insights`, `/settings`)

### Onboarding & Core App
- [ ] Onboarding — first-time flow works, creates profile
- [ ] `/today` — priorities, habits, quick capture all work
- [ ] `/habits` — create, log, edit, delete habits
- [ ] `/tasks` — create, complete, organize tasks
- [ ] `/projects` — create, manage, link tasks, update, delete
- [ ] `/finance` — accounts, transactions, budgets all work
- [ ] `/journal` — write, save, view journal entries
- [ ] `/insights` — Life Balance Map renders, expanded dialog opens/closes
- [ ] `/settings` — profile, realms, password settings save correctly

### Mobile (narrow viewport)
- [ ] Landing page — responsive, no overflow
- [ ] Onboarding — form inputs usable on small screen
- [ ] `/today` — priorities, habits, quick capture all usable
- [ ] `/finance` — account cards, transaction list, budget cards fit viewport
- [ ] `/insights` — expanded Life Balance Map dialog scrollable and closable
- [ ] `/settings` — form fields and buttons accessible

---

## 5. RLS Production Smoke Test

**Before inviting testers**, run the RLS smoke test against the **production** Supabase project:

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
- [ ] No raw Supabase error messages shown to users (all errors use generic messages)
- [ ] Forgot password does not reveal whether email is registered
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

---

*Life Pulse — Last updated: June 2026*
