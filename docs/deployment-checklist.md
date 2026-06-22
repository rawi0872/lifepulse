# Life Pulse — Production Deployment Checklist

## 1. GitHub & Vercel Preparation

- [ ] **Commit all changes** — `git add -A && git commit -m "prepare for production deployment"`
- [ ] **Push to GitHub** — `git push origin main`
- [ ] **Import repo into Vercel** — Use Vercel dashboard → Add New → Project → Import Git Repository
- [ ] **Set framework** — Vercel auto-detects Next.js; confirm it is set to Next.js
- [ ] **Build command** — Confirm `next build` (default)
- [ ] **Output directory** — Confirm `.next` (default)
- [ ] **Node.js version** — Vercel defaults to 20.x; confirm compatibility

---

## 2. Vercel Environment Variables

Add these in Vercel dashboard → Project Settings → Environment Variables:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anon/public key |

**Important:**
- Do **not** add the Supabase `service_role` key — it bypasses RLS and must never be in client-accessible code.
- Keep production and local `.env.local` values separate.
- Confirm `.env.local` is in `.gitignore` and was **not** committed.
- After adding env vars, redeploy the project.

---

## 3. Supabase Auth URL Configuration

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

## 4. Supabase Database Readiness

- [ ] **Confirm all migrations applied** — Run `supabase migration list` (all should show as "local" or "remote" up)
- [ ] **Confirm RLS enabled** — Check all user tables have `enable row level security` applied
- [ ] **Run RLS smoke test** — Before inviting testers, create two test users and run:
  ```
  npm run test:rls
  ```
- [ ] **Clean test data** — Remove any test accounts or dummy data from the production database unless intentional
- [ ] **Point-in-Time Recovery (PITR)** — Enable in Supabase dashboard for production data safety

---

## 5. Production Smoke Test

After deploying, test every route and flow:

### Public pages
- [ ] Landing page (`/`) — loads, nav links work, footer links work
- [ ] Privacy Policy (`/privacy`) — loads, has support email
- [ ] Terms of Service (`/terms`) — loads, has support email
- [ ] Footer — Privacy and Terms links go to correct pages

### Auth flows
- [ ] Login (`/login`) — "Forgot password?" link visible, sign in works
- [ ] Signup (`/signup`) — account creation works
- [ ] Email confirmation (if enabled) — users receive confirmation email
- [ ] Forgot password (`/forgot-password`) — sends reset email, shows generic success
- [ ] Reset password — click email link, set new password, success shown, can log in with new password

### Protected routes (logged out)
- [ ] `/today` — redirects to `/login`
- [ ] `/habits` — redirects to `/login`
- [ ] `/tasks` — redirects to `/login`
- [ ] `/projects` — redirects to `/login`
- [ ] `/finance` — redirects to `/login`
- [ ] `/journal` — redirects to `/login`
- [ ] `/insights` — redirects to `/login`
- [ ] `/settings` — redirects to `/login`

### Protected routes (logged in)
- [ ] Onboarding — first-time flow works, creates profile
- [ ] `/today` — priorities, habits, quick capture all work
- [ ] `/habits` — create, log, edit, delete habits
- [ ] `/tasks` — create, complete, organize tasks
- [ ] `/projects` — create, manage, update projects
- [ ] `/finance` — accounts, transactions, budgets
- [ ] `/journal` — write, save, view journal entries
- [ ] `/insights` — Life Balance Map renders, expanded dialog works
- [ ] `/settings` — profile, realms, password settings work
- [ ] Logout — clears session, redirects to login

### Cross-cutting
- [ ] Mobile layout — all pages render correctly on narrow viewports
- [ ] Navigation — sidebar/app nav works on all pages

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

- [ ] **Choose a support email** — e.g. `support@lifepulse.app` or a personal email
- [ ] **Replace placeholder** — Update `SUPPORT_EMAIL` in both `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`
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
