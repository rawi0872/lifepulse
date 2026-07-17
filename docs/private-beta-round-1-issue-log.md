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
| R1-017 | 2026-07-16 | Internal QA | /onboarding | Product activation | P2 | Onboarding still risked introducing Life Pulse as a broad module ecosystem before the user understood the first daily loop. | No | Yes | Clarify the first-session loop in onboarding and make deeper modules feel optional/later | Fixed pending production verification |  |
| R1-018 | 2026-07-17 | Internal QA | /tasks, /habits | Product activation | P2 | Sparse Tasks/Habits pages can still make first-time users unsure what visible action to create after onboarding explains the loop. | No | Yes | Improve empty/sparse guidance with concrete examples and a compact return-to-Today path, without changing creation or completion behavior | Fixed pending production verification |  |
| R1-019 | 2026-07-17 | Tester 1 / Internal QA | /body | Product activation | P2 | Body first-use flow made current weight, water, and food logging harder to find than expected; number inputs also needed polished non-native spinner styling. | Yes | Yes | Improve discoverability and safe manual-check-in framing for current weight, water, and food without schema or save behavior changes | Fixed pending production verification |  |
| R1-020 | 2026-07-17 | Internal QA | /mind | Product activation | P2 | Mind first-use can feel vague or unclear compared with the newly polished Body page; users may not know whether it is a private check-in, a mental health app, or a dashboard. | No | Yes | Improve safe manual check-in framing and discoverability without schema or save changes | Fixed pending production verification |  |
| R1-021 | 2026-07-17 | Internal QA | /finance | Product activation | P2 | Finance first-use can feel unclear unless income/expense logging, privacy, and non-advice boundaries are explicit. | No | Yes | Improve safe manual-money framing and discoverability without schema or save changes | Fixed pending production verification |  |
| R1-022 | 2026-07-17 | Tester | Phone / mobile | /tasks | Mobile interaction usability | P1/P2 | Tester tapped Edit on a task and had to scroll to the top to find the edit form, making task editing feel disconnected and unfinished on phone. | No | Yes | Move edit/delete interaction close to the task card and improve mobile ergonomics without changing task CRUD semantics | Fixed pending production verification |  |
| R1-023 | 2026-07-17 | Internal QA | Phone / mobile | /habits | Mobile interaction usability | P2 | After fixing Tasks edit ergonomics, Habits needed the same check because editing could also open a shared form far from the selected habit on phone. | No | Yes | Keep habit edit/delete interactions local to the habit card and safe on mobile without changing habit CRUD, streak, or XP semantics | Fixed pending production verification |  |
| R1-024 | 2026-07-17 | Internal QA | Phone / mobile | /projects, /goals | Mobile interaction usability | P2 | Projects and Goals still had edit/delete flows where editing opened away from the selected item or deletion used disconnected/immediate controls after Tasks/Habits were fixed. | No | Yes | Keep edit/delete interactions local to the selected item where needed, without changing project/goal CRUD, goal-linking, or XP semantics | Fixed pending production verification |  |
| R1-025 | 2026-07-17 | Internal QA | Phone / mobile | /today, /journal | Mobile interaction usability | P2 | After the daily loop became central, the Reflect step needed a mobile comfort audit because Today is the write surface while Journal is read-only history. | No | Yes | Make the reflection step comfortable and local on phone while preserving journal save/read behavior and private-history boundaries | Fixed pending production verification |  |
| R1-026 | 2026-07-17 | Internal QA | Phone / mobile | /weekly-review | Mobile interaction usability | P2 | After Journal reflection became central, Weekly Review needed a mobile comfort audit because it is the payoff step and includes several review textareas plus Save to Journal. | No | Yes | Make review inputs and save actions comfortable on phone while preserving weekly review save behavior and private/manual review boundaries | Fixed pending production verification |  |
| R1-027 | 2026-07-17 | Internal QA | Phone / mobile | /coach | Safety framing / mobile usability | P2 | Coach can risk feeling like vague AI/advice unless manual, private, optional framing is clear and suggested actions are comfortable on phone. | No | Yes | Improve Coach mobile comfort and safety framing without adding AI, automation, advice, or changing deterministic coach rules | Fixed pending production verification |  |
| R1-028 | 2026-07-17 | Internal QA | Phone / mobile 390x844 | Global protected routes | Mobile interaction usability | P2 | Global mobile audit found no horizontal overflow, but several important buttons, quick-fill chips, loop links, and secondary actions were below comfortable tap-target size; Finance still had browser confirm dialogs for budget/account deletion. | No | Yes | Raise key mobile tap targets, keep local actions near the tapped item, and replace remaining Finance browser confirms with local confirmations without changing data behavior | Fixed pending production verification |  |
| R1-029 | 2026-07-17 | Founder / Internal QA | Phone / mobile, core loop | /habits, /weekly-review, /insights | Product readiness / performance | P1/P2 | Founder reported Habits cannot be comfortably checked on phone, the app feels slow/laggy, and Weekly Review/Insights feel shallow instead of structured around useful trends. Audit found Habits completion affordance was not clickable on the Habits page and Weekly Review could repeatedly reload due to unstable date dependencies. | No | Yes | Fix Habits phone completion, reduce Weekly Review repeated loading, add one safe weekly rhythm chart, and document staged charts/usefulness plan | Fixed pending production verification |  |
| R1-030 | 2026-07-17 | Internal QA | Phone / mobile 390x844 | /today, /insights | Performance / perceived loading | P2 | Core routes still felt slower than necessary because Today and Insights waited for secondary finance, memory, body/mind, passion, knowledge, and goal-detail signals before rendering primary content. | No | Yes | Render primary Today and Insights content after core task/habit/XP data, then hydrate secondary signals in the background without changing save/delete/XP behavior | Fixed pending production verification |  |

## Common Repeated Issues

Group similar issues here after at least two testers mention the same theme.

- Cognitive overload / too much at once: Tester 1 said the app feels "too messy and too much" (`R1-007`); Tester 2 said there is too much on a single page and they cannot comprehend everything (`R1-009`). Treat this as a repeated Round 1 signal before wider beta. First selected fix shipped Today-first guidance; next selected fix is Today + navigation first-run simplification so Core routes appear first and deeper modules feel optional/later. Status: in progress pending production verification.
- First-session activation feels static after an action: Tester 3 completed a priority and did not understand the next useful step (`R1-015`). Treat as a high-priority activation issue because it blocks the first useful Life Pulse loop. Current decision: guide users toward one concrete task, habit, or reflection using existing Today paths only.
- Core route sequencing: Today now explains the loop, but core routes must keep users inside the same journey (`R1-016`). Current decision: use compact UI/copy guidance only, with no backend onboarding system.
- Onboarding loop alignment: onboarding must not make a first session feel like module setup before users understand Today -> Action -> Reflect -> Review (`R1-017`). Current decision: clarify the first-session loop in onboarding and make deeper modules optional/later.
- Sparse action pages: Tasks and Habits must make the first visible action obvious for new or sparse users (`R1-018`). Current decision: improve empty/sparse guidance with concrete examples and a compact return-to-Today path only.
- Body first-use discoverability: Body must make current weight, water, and food logging obvious without sounding medical or judgmental (`R1-003`, `R1-004`, `R1-005`, `R1-019`). Current decision: polish manual-check-in UI/copy only, with no schema or save changes.
- Mind first-use discoverability: Mind must feel like a simple private check-in, not therapy, diagnosis, or a vague dashboard (`R1-020`). Current decision: improve safe manual-check-in framing and discoverability without schema or save changes.
- Finance first-use discoverability: Finance must make income/expense logging, privacy, no bank connection, and non-advice boundaries explicit (`R1-021`). Current decision: improve safe manual-money framing and discoverability without schema or save changes.
- Task edit/delete ergonomics: Task editing must happen near the selected task, especially on phone, and deletion should use a local confirmation instead of a disconnected browser prompt (`R1-022`). Current decision: inline edit and local delete confirmation only, with no task CRUD semantics changes.
- Habit edit/delete ergonomics: Habits should follow the same local mobile interaction model as Tasks while preserving repeated-action completion, streak, and XP behavior (`R1-023`). Current decision: inline edit and local delete confirmation only, with no habit CRUD, streak, or XP semantics changes.
- Projects/Goals edit-delete ergonomics: Projects and Goals should not keep the old tap-here/edit-elsewhere pattern after Tasks/Habits were fixed (`R1-024`). Current decision: inline edit and local delete confirmation only, with no project/goal CRUD, goal-linking, or XP semantics changes.
- Journal/reflection mobile comfort: Reflect is now a core daily-loop step, so Today reflection needs comfortable phone controls and Journal needs a clear return-to-Today path (`R1-025`). Current decision: improve Today reflection ergonomics and Journal CTAs only, with no journal CRUD semantics or AI processing changes.
- Weekly Review mobile comfort: Weekly Review closes the loop, so review inputs and Save to Journal should be comfortable on phone and clearly described as private manual review (`R1-026`). Current decision: improve review textarea sizing, sparse-state copy, and save-action clarity only, with no weekly review save semantics or AI processing changes.
- Coach safety framing and mobile comfort: Coach should feel like optional manual guidance over the loop, not AI advice, scoring, or automation (`R1-027`). Current decision: improve safety framing, prompt language, and mobile tap targets only, with no coach rule, CRUD, XP, AI, or automation changes.
- Global mobile ergonomics: After route-specific fixes, the remaining Round 1 risk is inconsistent small controls across protected routes (`R1-028`). Current decision: apply only high-confidence tap-target and local confirmation fixes, leaving acceptable pages and behavior semantics unchanged.
- Habits phone completion and review depth: Round 1 product readiness now depends on the core action loop feeling fast, tappable, and meaningfully reviewed (`R1-029`). Current decision: fix the concrete Habits completion blocker, reduce obvious repeated loading, add one safe existing-data Weekly Review chart, and stage broader review usefulness work in `docs/review-usefulness-charts-plan.md`.
- Perceived route loading: Today and Insights should not block their primary read on secondary module signals (`R1-030`). Current decision: split primary vs secondary client loads first; deeper server/data-shaping work belongs in `docs/performance-roadmap.md`.

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
