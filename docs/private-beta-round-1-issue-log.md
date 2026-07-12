# Private Beta Round 1 Issue Log

Use this log to track feedback from the first trusted private beta testers. Add raw context quickly, then triage later using `docs/private-beta-feedback-triage.md`.

## Round 1 Testers

| Tester | Invite date | Primary device/browser | Notes |
| --- | --- | --- | --- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

## Issue Log

Example rows are placeholders. Replace them with real tester feedback as it arrives.

| ID | Date | Tester | Device/browser | Route/page | Category | Severity | Feedback summary | Screenshot/video? | Reproduced? | Decision | Status | Linked commit/fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EX-001 | YYYY-MM-DD | Example tester | iPhone / Safari | /today | Confusing wording | P2 | Example: tester was unsure what to do first on Today. | No | Not yet | Watch for repetition | Example only |  |
| EX-002 | YYYY-MM-DD | Example tester | Android / Chrome | /signup | Mobile layout issue | P1 | Example: keyboard covered the submit button. | Yes | Not yet | Fix before more testers | Example only |  |
| EX-003 | YYYY-MM-DD | Example tester | Desktop / Chrome | /coach | Personal preference | P3 | Example: tester wanted a different label for Coach. | No | Not needed | Save for later | Example only |  |
| R1-001 | 2026-07-12 | Tester 1 | Unknown | /login, /forgot-password, /reset-password | Trust/privacy concern | P1 | Tester requested password change/reset support for forgotten passwords. Audit found password reset routes already exist, so likely needs verification/discoverability rather than a new feature. | No | Not yet | Fix before more testers | Open |  |
| R1-002 | 2026-07-12 | Tester 1 | Unknown | Account/security | Trust/privacy concern | P2 | Tester requested 2FA because Life Pulse stores sensitive personal information. Security concern is valid, but MFA should be planned after password reset/account recovery is verified. | No | Not yet | Save for later | Open |  |
| R1-003 | 2026-07-12 | Tester 1 | Unknown | /body | UI polish | P2 | Body Profile height and target weight number inputs show default browser white number spinners and look visually inconsistent with the app. | Yes | Not yet | Fix this week | Open |  |
| R1-004 | 2026-07-12 | Tester 1 | Unknown | /body | Missing expectation | P2 | Tester said current weight is needed. Audit found weight already exists in body metrics and measurements, but it may be unclear or not prominent enough in Body Profile/overview. | No | Not yet | Fix this week | Open |  |
| R1-005 | 2026-07-12 | Tester 1 | Unknown | /body | Missing expectation | P2 | Tester requested an easier way to add water or food. Audit found nutrition and water logging already exist under the Nutrition tab, so this is likely discoverability and shortcut friction before schema work. | No | Not yet | Fix this week | Open |  |
| R1-006 | 2026-07-12 | Tester 1 | Unknown | Overall, /today, /coach, /onboarding | Product motivation | P3 | Tester said the app is not interactive enough and does not clearly make them feel they will become better. Do not translate this into a redesign yet; watch for repeated first-run motivation feedback. | No | Not yet | Watch for repetition | Open |  |
| R1-007 | 2026-07-12 | Tester 1 | Unknown | Overall navigation/first run | Information architecture | P3 | Tester said the app feels too messy and too much. Do not hide modules or redesign from one opinion; audit suggests this may be first-run guidance/module overload. | No | Not yet | Watch for repetition | Open |  |

## Common Repeated Issues

Group similar issues here after at least two testers mention the same theme.

-

## Top Fixes Selected

List only the top 1-3 fixes selected after reviewing the first feedback wave.

1.
2.
3.

## Fixes Shipped

| Date | Fix summary | Linked issue IDs | Commit | Production QA run |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Deferred Requests

Track useful requests that should not interrupt first-run reliability work.

| Request | Tester(s) | Reason deferred | Revisit when |
| --- | --- | --- | --- |
|  |  |  |  |

## Rejected / Not Aligned

Track decisions so the same request does not get reopened without new evidence.

| Request | Reason | Date decided |
| --- | --- | --- |
|  |  |  |

## Final Round 1 Summary

Complete this after the first tester wave.

- Testers invited:
- Testers completed first session:
- Most common friction:
- Highest severity issue:
- Top shipped fix:
- Deferred themes:
- Recommendation before Round 2:
