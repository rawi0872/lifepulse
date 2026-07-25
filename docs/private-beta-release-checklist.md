# Life Pulse Private Beta Release Checklist

Use this before inviting each small trusted tester wave.

## Release Target

- Production URL: https://lifepulse-sand.vercel.app
- Current expected deployed commit: `41a8cbe Keep completed tasks in Today summaries`
- Audience: 2-5 trusted private-beta testers
- Scope: browser/PWA private beta, not public launch

## Code And Deployment

- [ ] `main` is synchronized with `origin/main`
- [ ] Production is serving the expected deployed behavior
- [ ] No uncommitted release changes are pending
- [ ] Rollback commit or revert path is understood before invites

## Safe Verification

- [ ] `npm run lint` passes with only known warnings
- [ ] `npm run build` passes
- [ ] `node scripts/mobile-tablet-prod-test.mjs` passes
- [ ] `node scripts/navigation-prod-test.mjs` passes
- [ ] Responsive checks cover 320px, 390px, 768px, and desktop for the core loop
- [ ] General production smoke tests that write data are not run unless explicitly intended
- [ ] No production data was created, edited, completed, reopened, archived, deleted, or saved during read-only checks

## Auth And Core Loop

- [ ] Logged-out users are redirected from protected routes to `/login`
- [ ] Signup/login/onboarding can reach Today
- [ ] Today, Tasks, Habits, Results, Journal, and Weekly Review load
- [ ] Evening Shutdown can be inspected and saved by testers when they intentionally choose to reflect
- [ ] Settings includes sign out and feedback paths

## Privacy And Safety

- [ ] No secrets, credentials, UUIDs, cookies, or private tester data are included in docs or reports
- [ ] `.env.example` contains placeholders only
- [ ] No service-role key is used client-side
- [ ] Finance remains manual tracking only; no bank connection or financial advice
- [ ] Body and Mind remain tracking context only; no medical or therapy advice
- [ ] Coach is rule-based; NEXTRON AI Coach is not available yet

## Tester Handoff

- [ ] Send `docs/private-beta-tester-instructions.md`
- [ ] Include `docs/private-beta-feedback-template.md`
- [ ] Keep the tester list private and out of repository files
- [ ] Remind testers not to enter highly sensitive data during early beta
- [ ] Confirm each tester knows how to report blocker, major, minor, and suggestion feedback
- [ ] Track issues in `docs/private-beta-round-1-issue-log.md`

## Known Limitations To State Clearly

- Private beta only; features may change
- No NEXTRON AI Coach yet
- No native mobile app yet
- No smartwatch/wearable integration yet
- No automatic notifications yet
- No bank connection
- No medical diagnosis, therapy, financial, tax, legal, or investment advice
- Limited support process during early beta
