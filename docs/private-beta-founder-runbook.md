# Life Pulse Private Beta Founder Runbook

## Goal

Run a focused private beta with 5–10 trusted testers. Collect structured feedback on clarity, reliability, mobile comfort, and daily return intent. Do not build features — fix blockers and confusion.

---

## Who To Invite First

- 5–10 trusted people who:
  - Use their phone daily for productivity/wellness
  - Will give specific, honest feedback
  - Represent your target early adopter (not power users only)

## Invitation Message (Copy-Paste)

```
Hey — I'm opening a small private beta for Life Pulse and would value your honest feedback.

Life Pulse is a personal operating system for daily tasks, habits, goals, reflection, and life areas. It is not publicly launched yet, so I'm mainly testing clarity, reliability, and whether the daily flow feels useful on phone and desktop.

Beta link: https://lifepulse-sand.vercel.app

If you have 10 minutes, please:
1. Create an account
2. Finish onboarding
3. Open Today → add one priority, one task, one habit
4. Write a short journal reflection
5. Look around Weekly Review, Insights, Coach, Settings, Devices

Please do not enter highly sensitive data during beta. Finance, Body, Mind, and Coach are for tracking and reflection only, not professional advice. Devices are preview only and do not sync automatically yet.

The most helpful feedback:
- What confused you?
- What felt useful?
- What looked broken on your device?
- Would you come back tomorrow?

Thanks!
```

---

## What To Ask Them To Test

**First 10 minutes** (send this path):
1. Onboarding → Today → add priority → add task/habit → reflect
2. Goals/Projects (optional)
3. Weekly Review, Insights, Coach, Settings, Devices

**Over 3–7 days**:
- Daily loop: priority → action → reflection
- Day 4–7: Weekly Review → save to Journal
- Try all modules they find relevant
- Phone + desktop if possible

---

## How To Collect Feedback

- Ask testers to message you directly (email, DM, whatever works)
- Provide the feedback template: `docs/private-beta-feedback-template.md`
- Ask for screenshots/recordings of anything confusing or broken
- Note: testers should NOT enter highly sensitive data

---

## How To Triage Feedback

Use `docs/private-beta-feedback-triage.md`:

| Severity | Meaning | Action |
|----------|---------|--------|
| **P0** | Blocks signup, login, onboarding, core routes, or trust | Fix before more testers |
| **P1** | Serious confusion or broken daily-use path | Fix this week |
| **P2** | Noticeable friction, workaround exists | Fix if repeated or easy |
| **P3** | Polish, preference, nice-to-have | Track, don't interrupt |

**Decision buckets:**
- Fix before more testers (P0/P1, trust, repeated first-run blockers, mobile layout)
- Fix this week (repeated P2, small copy/layout, clear bugs)
- Watch for repetition (one-off, may grow)
- Save for later (larger feature requests, not needed now)
- Reject/not aligned (conflicts with scope/safety/constraints)

---

## What Counts As Beta Success

- ≥3 testers complete first 10 minutes without founder help
- ≥3 testers use it 3+ days without prompting
- No P0/P1 unresolved after first wave
- Mobile 390x844: no horizontal overflow, comfortable tap targets
- Feedback shows the daily loop is understood: priority → action → reflect → review

---

## Timeline

**Day 0** — Send invites (5–10 testers)

**Day 1–3** — Review feedback daily. Group into triage buckets. Fix P0/P1 immediately. Run production QA after fixes.

**Day 3** — Checkpoint:
- How many testers active?
- Any P0/P1 unresolved?
- Is the daily loop clear?
- Any mobile overflow or tap target issues?
- Decide: invite more? fix more? proceed?

**Day 7** — Review all feedback. Update issue log. Pick top 1–3 fixes for next prompt. Reset onboarding QA account if needed for next test run.

---

## After 3 Days

- Consolidate feedback into `docs/private-beta-round-1-issue-log.md`
- Run production QA on affected routes
- Verify mobile 390x844 still clean
- Decide on next 5 testers or iterate

## After 7 Days

- Final Round 1 summary in issue log
- Top shipped fix
- Deferred themes
- Recommendation before Round 2

---

## What Not To Do

- No big new modules
- No native apps
- No AI automation
- No offline sync
- No bank integrations
- No schema-heavy changes unless blocker
- No redesign from one opinion
- Don't change product direction from single feedback
- Don't treat one power-user request as beta-wide requirement

---

## Production QA Before Expanding

After any fix, run:
- `npm run lint`
- `npm run build`
- `npm run test:prod:today`
- `npm run test:prod:mobile-tablet`
- `npm run test:prod:navigation`
- `npm run test:prod:weekly-insights`
- `npm run test:prod:network-audit`
- Manual phone 390x844 check on affected routes