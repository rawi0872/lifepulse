# Life Pulse — Security & Production-Readiness Audit

## Summary

**App**: Next.js 16 + Supabase personal dashboard (habits, tasks, projects, journal, XP/gamification)
**Audit Scope**: Security posture, input validation, auth, RLS, accessibility, production readiness
**Audit Date**: 2026-06-19
**Overall Risk**: Low (no critical vulnerabilities found; several defense-in-depth improvements applied)

---

## 1. RLS & Database Security

### Status: ✅ Good, with migration applied

| Table | RLS | SELECT | INSERT | UPDATE | DELETE |
|-------|-----|--------|--------|--------|--------|
| profiles | ✅ | auth.uid() = user_id | auth.uid() = user_id (via trigger) | auth.uid() = user_id | — |
| realms | ✅ | auth.uid() = user_id | auth.uid() = user_id | auth.uid() = user_id | auth.uid() = user_id |
| habits | ✅ | auth.uid() = user_id | realm_belongs_to_user(realm_id) | realm_belongs_to_user(realm_id) | auth.uid() = user_id |
| habit_logs | ✅ | auth.uid() = user_id | habit_belongs_to_user(habit_id) | habit_belongs_to_user(habit_id) | auth.uid() = user_id |
| tasks | ✅ | auth.uid() = user_id | project_belongs_to_user(project_id) | project_belongs_to_user(project_id) | auth.uid() = user_id |
| projects | ✅ | auth.uid() = user_id | (no FK) | (no FK) | auth.uid() = user_id |
| journal_entries | ✅ | auth.uid() = user_id | auth.uid() = user_id | auth.uid() = user_id | auth.uid() = user_id |
| xp_events | ✅ | auth.uid() = user_id | habit_log_belongs_to_user(source_id) | — | auth.uid() = user_id |

### Applied: Migration `00006_rls_fk_ownership.sql`
- Added `SECURITY DEFINER` helper functions: `realm_belongs_to_user`, `habit_belongs_to_user`, `project_belongs_to_user`, `task_belongs_to_user`, `habit_log_belongs_to_user`
- Updated INSERT/UPDATE policies on `habits`, `habit_logs`, `tasks`, `xp_events` to validate FK ownership
- Prevents cross-user data insertion via forged foreign keys

### Cross-User Data Leakage Test Checklist

Before deploying to production with real users, manually verify these test cases:

1. **Direct table read** — `SELECT * FROM habits` (should return empty/error for unauthenticated)
2. **Cross-user SELECT** — Authenticate as User A, try reading User B's data via guessed UUID
3. **Cross-user INSERT** — Auth as User A, try `INSERT INTO habits (user_id, ...) VALUES ('<user-b-uuid>', ...)`
4. **Cross-user FK INSERT** — Auth as User A, try `INSERT INTO habits (user_id, realm_id, ...) VALUES ('<user-a-uuid>', '<user-b-realm-uuid>', ...)`
5. **Cross-user UPDATE** — Auth as User A, try `UPDATE habits SET ... WHERE user_id = '<user-b-uuid>'`
6. **Cross-user DELETE** — Auth as User A, try `DELETE FROM habits WHERE user_id = '<user-b-uuid>'`
7. **Anonymous access** — Verify all protected routes redirect to `/login` when unauthenticated
8. **RLS bypass via anon key** — Verify anon key cannot read/write data without authenticated session
9. **Onboarding profile race** — Verify redirect to `/onboarding` when `profiles` row doesn't exist yet

All of these should be blocked by RLS policies or the auth proxy.

---

## 2. Auth & Route Protection

### Status: ✅ Good

- **proxy.ts** correctly protects routes, redirects unauthenticated to `/login`, blocks auth routes for logged-in users
- **Auth callback** uses `PKCE` flow (safe without state parameter validation)
- **Open redirect** not exploitable: `${origin}${next}` prefix keeps all redirects same-origin
- **Cookie handling** follows `@supabase/ssr` recommended patterns for both proxy and callback
- **Root redirect** `/` → `/today` or `/onboarding` based on profile

### Minor Notes
- Protected routes other than `/today` aren't blocked when onboarding is incomplete (intentional)
- No `state` param validation in callback (mitigated by PKCE)

---

## 3. Input Validation

### Status: ✅ Good (improvements applied)

| Field | maxLength | Empty guard | Client-side | Server-side |
|-------|-----------|-------------|-------------|-------------|
| Habit title | 100 ✅ | `if (!title.trim()) return;` | ✅ | RLS |
| Task title | 200 ✅ | `if (!title.trim()) return;` | ✅ | RLS |
| Project title | 200 ✅ | `if (!title.trim()) return;` | ✅ | RLS |
| Project description | 2000 ✅ | optional | ✅ | — |
| Priority item | 200 ✅ | `if (!priorityInput.trim()) return;` | ✅ | RLS |
| Quick capture | 200 ✅ | — | ✅ | RLS |
| Journal content | 10000 ✅ | — | ✅ | RLS |
| Realm name | 50 ✅ | — | ✅ | RLS |
| First/last name | 100 ✅ | `required` attribute | ✅ | RLS |
| Display name | 100 ✅ | — | ✅ | RLS |
| Signup email/password | — | browser `required` | ✅ | Supabase Auth |

- All text inputs now have `maxLength` to prevent excessively long strings
- Empty title submissions are silently prevented (`if (!title.trim()) return`)
- Priority buttons use `disabled` prop for visual feedback
- Server-side validation relies on RLS policies (defense-in-depth)

---

## 4. Secrets & Configuration

| Item | Status |
|------|--------|
| `.env.local` in `.gitignore`? | ✅ Yes |
| Only `NEXT_PUBLIC_*` vars in client | ✅ Yes |
| No `service_role` key in app code | ✅ Yes |
| Supabase anon key in `.env.example` | ✅ Documented as placeholder |
| No hardcoded secrets | ✅ Clean |
| No `console.log` in source | ✅ Clean |
| No `TODO`/`FIXME` in source | ✅ Clean |

---

## 5. Security Headers

### Status: ✅ Applied (next.config.ts)

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | See below |

### CSP (production)
```
default-src 'self';
script-src 'self' 'unsafe-inline' https://*.vercel.live;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
```

- `'unsafe-inline'` required for Next.js inline bootstrap scripts/styles
- Supabase realtime connections allowed via `connect-src`
- Dev mode additionally allows `'unsafe-eval'` for Turbopack HMR
- Vercel analytics scripts allowed

---

## 6. XP/Gamification System

| Aspect | Status | Notes |
|--------|--------|-------|
| XP deduplication (task toggle) | ✅ | Checks existing `xp_events` before insert |
| XP deduplication (habit log) | ✅ | One XP per habit per day |
| Habit log uniqueness | ✅ | Unique constraint on (habit_id, date) |
| RLS on xp_events | ✅ | OWNER can read own, INSERT checks FK ownership |

---

## 7. Accessibility

### Status: ⚠️ Improvements applied

| Component | Issue | Fix |
|-----------|-------|-----|
| `HabitCard.tsx` | Missing checkbox semantics | Added `role="checkbox"`, `aria-checked`, `aria-label`, `tabIndex`, keyboard handler (Enter/Space) |
| `ColorPicker.tsx` | Color buttons lack labels | Added `aria-label="Color #hex"` |
| `IconPicker.tsx` | Icon buttons lack labels | Added `aria-label="Icon {emoji}"` |
| `RealmPicker.tsx` | Missing ARIA combobox pattern | Added `aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"`, `role="option"`, `aria-selected` |
| `SelectPicker.tsx` | Same as RealmPicker | Same fixes applied |
| `ProjectPicker.tsx` | Same as RealmPicker | Same fixes applied |
| Color contrast | ✅ | Custom CSS variables, user-configurable |
| Keyboard navigation | ✅ | All controls focusable, Escape/click-outside for dropdowns |

---

## 8. Production Deployment Readiness Checklist

### Pre-Deployment

- [ ] **Apply migration 00006** — `supabase migration up` (FK ownership validation)
- [ ] **Production environment** — Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in deployment environment
- [ ] **Supabase Auth settings** — Toggle "Confirm email" as desired; configure redirect URL: `https://yourdomain.com/auth/callback`
- [ ] **Turn off email confirmation in dev** — Disable in Supabase dashboard for local development
- [ ] **CSP review** — Update `connect-src` in `next.config.ts` if using custom Supabase host or external APIs
- [ ] **Build verification** — `npm run build` (currently passing ✅)
- [ ] **TypeScript check** — `npx tsc --noEmit` (currently passing ✅)

### Post-Deployment

- [ ] **Verify signup flow** — Create a new account, confirm email (if enabled), verify redirect to `/onboarding`
- [ ] **Verify login flow** — Login with existing credentials, verify redirect to `/today`
- [ ] **Verify RLS** — Run cross-user test checklist (Section 1)
- [ ] **Verify CSP** — Check browser console for CSP violation reports
- [ ] **Verify headers** — Use curl or browser DevTools to confirm security headers
- [ ] **Error monitoring** — Configure Sentry or equivalent for client/server error tracking

### Ongoing

- [ ] **Database backups** — Enable Supabase Point-in-Time Recovery (PITR) for production
- [ ] **Dependency updates** — Regularly run `npm audit` and update dependencies
- [ ] **Session management** — Review Supabase Auth session duration settings
- [ ] **Rate limiting** — If deploying behind a CDN, configure rate limiting on auth endpoints
- [ ] **Vercel Analytics / PostHog** — Decide on privacy-preserving analytics

### Architecture Notes

- All data is local-timezone based (`getTodayDateString()`) — no timezone conversion at rest
- Cookie-based auth (no JWT in localStorage) — standard Supabase SSR pattern
- No image upload or file handling → no SSRF/malware vector
- No external API integrations → no OAuth token management needed
- No admin panel or elevated roles → all users are peers

---

## 9. Summary of Changes Made

| File | Change |
|------|--------|
| `supabase/migrations/00006_rls_fk_ownership.sql` | **NEW** — RLS FK ownership validation via SECURITY DEFINER helpers |
| `next.config.ts` | **MODIFIED** — Added CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy |
| `src/components/HabitCard.tsx` | **MODIFIED** — a11y: checkbox role, aria attributes, keyboard handler |
| `src/components/ColorPicker.tsx` | **MODIFIED** — a11y: aria-label on color swatches |
| `src/components/IconPicker.tsx` | **MODIFIED** — a11y: aria-label on icon buttons |
| `src/components/RealmPicker.tsx` | **MODIFIED** — a11y: aria-haspopup, aria-expanded, role=listbox/option, aria-selected |
| `src/components/SelectPicker.tsx` | **MODIFIED** — a11y: same as RealmPicker |
| `src/components/ProjectPicker.tsx` | **MODIFIED** — a11y: same as RealmPicker |
| `src/app/habits/page.tsx` | **MODIFIED** — maxLength=100 on title input |
| `src/app/tasks/page.tsx` | **MODIFIED** — maxLength=200 on title input |
| `src/app/projects/page.tsx` | **MODIFIED** — maxLength=200 on title, maxLength=2000 on description |
| `src/app/today/page.tsx` | **MODIFIED** — maxLength=200 on priority and quick capture inputs |
| `src/app/settings/page.tsx` | **MODIFIED** — maxLength on profile fields and realm inputs |
| `src/app/onboarding/page.tsx` | **MODIFIED** — maxLength on habit/task inputs |
| `src/app/signup/page.tsx` | **MODIFIED** — maxLength on first/last name inputs |
| `src/components/JournalSection.tsx` | **MODIFIED** — maxLength=10000 on content textarea |
| `src/app/projects/page.tsx` | **MODIFIED** — maxLength on title/description |

---

## 10. Conclusion

Life Pulse has a **strong security foundation**: RLS on all tables, proper Supabase SSR auth, no secrets exposure, and clean code. The audit found:

- **1 medium finding** (RLS FK ownership) — fixed with migration
- **1 low finding** (missing security headers) — fixed
- **Several low/defer findings** — input maxLength, a11y improvements — all applied

The app is **ready for production** once the deployment checklist items are completed. No critical blockers remain.
