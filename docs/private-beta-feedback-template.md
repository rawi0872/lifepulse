# Life Pulse Private Beta Feedback Template

## Tester Details

Tester name:

Date:

Device/browser:

Screen size if known:

## Setup

Did signup work?

Did onboarding make sense?

Did you try the app on phone, tablet, desktop, or more than one device?

Did you try adding it to your home screen or installing it as a PWA?

## What You Tested

What did you test?

- Today
- Tasks
- Habits
- Goals
- Projects
- Journal
- Knowledge
- Weekly Review
- Insights
- Coach
- Body
- Mind
- Finance
- Passions
- Settings
- Devices
- PWA install or home-screen behavior
- Other:

## Top 3 Confusing Moments

1.
2.
3.

## Top 3 Useful Moments

1.
2.
3.

## Bugs Or Errors

Bugs/errors seen:

Screenshots/videos attached?

Mobile layout issues?

PWA install issues?

## Trust And Privacy

Privacy/trust concerns?

Did any wording feel unclear, too strong, or untrustworthy?

Did any area feel like it was promising advice or automation that was not actually available?

## Overall

Would you use it again tomorrow?

Score 1-10:

Most important improvement before the next beta round:

---

## For Founder Triage Only (Internal)

Every feedback item should be logged in `docs/private-beta-round-1-issue-log.md` with this format:

| ID | Date | Tester | Device/browser | Route/page | Category | Severity | Feedback summary | Screenshot/video? | Reproduced? | Decision | Status | Linked commit/fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1-XXX | YYYY-MM-DD | [name] | iPhone / Safari | /today | Confusing wording | P1 | Tester was unsure what to do first on Today. | Yes | Yes | Fix before more testers | Open | |

### Severity Levels

- **P0 Blocker** — Blocks signup, login, onboarding, core routes, trust, or causes data loss
- **P1 Serious** — Serious confusion or broken daily-use path
- **P2 Polish/Usability** — Noticeable friction, workaround exists
- **P3 Later Idea** — Preference, feature request, not needed now

### Decision Buckets

- Fix before more testers (P0/P1, trust, repeated first-run blockers, mobile layout)
- Fix this week (repeated P2, small copy/layout, clear bugs)
- Watch for repetition (one-off, may grow)
- Save for later (larger feature requests, not needed now)
- Reject/not aligned (conflicts with scope/safety/constraints)

### Status Values

- Open
- In progress
- Fixed pending production verification
- Closed

---

## Privacy & Safety Reminder (Copy Into Tester Instructions)

- Do not enter highly sensitive data during beta (passwords, banking details, medical records, deeply private information)
- Use simple, realistic test data first
- **Finance** = manual tracking only; not financial/tax/investment/debt advice
- **Body & Mind** = wellness/productivity context only; not medical/therapy advice
- **Coach** = rule-based transparency; not an AI therapist, doctor, or advisor
- **Devices** = preview only; no automatic imports
- Life Pulse is private/manual — no AI summaries or external processing for review features