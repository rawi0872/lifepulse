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
| R1-001 | 2026-07-12 | Tester 1 | Unknown | /login, /forgot-password, /reset-password | Trust/privacy concern | P1 | Tester requested password change/reset support for forgotten passwords. Audit found password reset routes already exist but needed safer recovery-session handling, direct reset redirect, and verification. | No | Yes | Fix before more testers | In progress pending production verification |  |
| R1-002 | 2026-07-12 | Tester 1 | Unknown | Account/security | Trust/privacy concern | P2 | Tester requested 2FA because Life Pulse stores sensitive personal information. Security concern is valid, but MFA should be planned after password reset/account recovery is verified. | No | Not yet | Save for later | Open |  |
| R1-003 | 2026-07-12 | Tester 1 | Unknown | /body | UI polish | P2 | Body Profile height and target weight number inputs show default browser white number spinners and look visually inconsistent with the app. | Yes | Not yet | Fix this week | Open |  |
| R1-004 | 2026-07-12 | Tester 1 | Unknown | /body | Missing expectation | P2 | Tester said current weight is needed. Audit found weight already exists in body metrics and measurements, but it may be unclear or not prominent enough in Body Profile/overview. | No | Not yet | Fix this week | Open |  |
| R1-005 | 2026-07-12 | Tester 1 | Unknown | /body | Missing expectation | P2 | Tester requested an easier way to add water or food. Audit found nutrition and water logging already exist under the Nutrition tab, so this is likely discoverability and shortcut friction before schema work. | No | Not yet | Fix this week | Open |  |
| R1-006 | 2026-07-12 | Tester 1 | Unknown | Overall, /today, /coach, /onboarding | Product motivation | P3 | Tester said the app is not interactive enough and does not clearly make them feel they will become better. Do not translate this into a redesign yet; watch for repeated first-run motivation feedback. | No | Not yet | Watch for repetition | Open |  |
| R1-007 | 2026-07-12 | Tester 1 | Unknown | Overall navigation/first run | Information architecture | P3 | Tester said the app feels too messy and too much. Do not hide modules or redesign from one opinion; audit suggests this may be first-run guidance/module overload. | No | Not yet | Watch for repetition | Open |  |
| R1-008 | 2026-07-12 | Tester 2 | Unknown | /journal | Confusing wording | P1 | Journal empty-state CTA says "Write today's entry" but opens Today, making the button feel broken instead of intentional. | Yes | Yes | Fix before more testers | Open |  |
| R1-009 | 2026-07-12 | Tester 2 | Unknown | Overall navigation/first run | Information architecture | P1 | Tester said there is too much on a single page and they cannot keep up or comprehend everything. This repeats Tester 1's "messy and too much" feedback. | No | Not yet | Fix before wider beta / audit next | Open |  |
| R1-010 | 2026-07-12 | Tester 2 | Unknown | XP/progress | Product motivation | P2 | Tester said XP could be more useful and motivating. Track for a future motivation slice after core usability issues. | No | Not yet | Watch for repetition | Open |  |
| R1-011 | 2026-07-12 | Tester 2 | Unknown | XP/social motivation | Useful feature request | P3 | Tester requested Duolingo-style leagues and competition. Useful idea, but too large for Round 1 and has fairness/social-product complexity. | No | Not needed | Save for later | Deferred |  |
| R1-012 | 2026-07-12 | Tester 2 | Unknown | Social/account | Useful feature request | P3 | Tester requested adding friends for motivation and competition. Defer because it introduces privacy, safety, moderation, and social graph complexity. | No | Not needed | Save for later | Deferred |  |
| R1-013 | 2026-07-12 | Tester 2 | Unknown | XP/profile | Useful feature request | P2 | Tester requested achievements/profile badges to show progress. Consider later as a safer gamification slice, but do not build during this fix. | No | Not needed | Save for later | Deferred |  |
| R1-014 | 2026-07-15 | Internal QA | Production / Chrome | /reset-password | Trust/privacy concern | P1 | Password reset showed success but the new password did not work and the old password still worked, indicating the success state could be reached without proving the current recovery link established the Supabase recovery session used for `updateUser`. | No | Yes | Fix before more testers | Fixed pending production verification |  |
| R1-015 | 2026-07-16 | Tester 3 | Unknown | /today | Product activation | P1/P2 | Tester created a priority, checked it off, and felt nothing meaningful happened afterward. Today did not guide the next useful step, and after the first fix the phrase "complete one visible action" still needed concrete task/habit guidance for sparse users. | No | Yes | Add first-run live guide, post-action next-step feedback, and concrete first-action guidance using existing Today state and task/habit paths only | Fixed pending production verification |  |
| R1-016 | 2026-07-16 | Internal QA | Core routes | /today, /tasks, /habits, /journal, /weekly-review | Product activation | P2 | After Today guidance improved, Tasks, Habits, Journal, and Weekly Review still risked feeling like separate tools instead of one first-use loop. | No | Yes | Connect Today, Tasks/Habits, Journal, and Weekly Review with compact route guidance and copy only | Fixed pending production verification |  |

## Common Repeated Issues

Group similar issues here after at least two testers mention the same theme.

- Cognitive overload / too much at once: Tester 1 said the app feels "too messy and too much" (`R1-007`); Tester 2 said there is too much on a single page and they cannot comprehend everything (`R1-009`). Treat this as a repeated Round 1 signal before wider beta. First selected fix shipped Today-first guidance; next selected fix is Today + navigation first-run simplification so Core routes appear first and deeper modules feel optional/later. Status: in progress pending production verification.
- First-session activation feels static after an action: Tester 3 completed a priority and did not understand the next useful step (`R1-015`). Treat as a high-priority activation issue because it blocks the first useful Life Pulse loop. Current decision: guide users toward one concrete task, habit, or reflection using existing Today paths only.
- Core route sequencing: Today now explains the loop, but core routes must keep users inside the same journey (`R1-016`). Current decision: use compact UI/copy guidance only, with no backend onboarding system.

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
