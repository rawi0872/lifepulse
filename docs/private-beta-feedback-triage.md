# Private Beta Feedback Triage

## Purpose

This process is for organizing feedback from the first 2-3 trusted Life Pulse private beta testers.

The goal is to identify repeated friction, real bugs, and trust or confusion problems before expanding beta. Use this to avoid overreacting to one opinion, chasing large feature requests too early, or losing important screenshots and tester context.

## Feedback Categories

- Blocker: prevents signup, login, onboarding, or basic use.
- Bug: broken behavior, visible error, failed save, or unexpected route failure.
- Mobile layout issue: overflow, overlap, tiny tap target, awkward keyboard behavior, or broken phone/tablet layout.
- Confusing wording: copy that makes testers unsure what to do or what a feature means.
- Missing expectation: tester expected something reasonable that is not present or not explained.
- Trust/privacy concern: wording, data handling, finance/body/mind/coach claims, or unclear safety boundary.
- Useful feature request: a request that supports the current product direction and repeated daily use.
- Nice-to-have: polish or convenience that does not block use.
- Personal preference: subjective taste that does not clearly affect broad usability.

## Severity Scale

- P0: Blocks beta use. Tester cannot sign up, log in, complete onboarding, access core routes, or trust the app enough to continue.
- P1: Serious confusion or broken core flow. Tester can continue, but a key first-run or daily-use path is unclear or unreliable.
- P2: Noticeable friction, but a workaround exists. Worth fixing if repeated or easy.
- P3: Polish, preference, or nice-to-have. Track but do not interrupt higher-priority fixes.

## Priority Rules

- Fix repeated issues first.
- Fix signup, login, and onboarding confusion before feature requests.
- Fix mobile layout bugs before adding features.
- Fix trust and privacy concerns immediately.
- Prefer copy or layout fixes before adding new logic.
- Do not build large requested features unless multiple testers clearly need them.
- Do not change product direction from one tester's opinion.
- Do not treat one power-user request as a beta-wide requirement.

## Decision Framework

For each feedback item, ask:

- Did more than one tester mention it?
- Did it stop them from continuing?
- Did it affect phone use?
- Did it reduce trust?
- Is it a bug or just a preference?
- Can it be fixed with copy or layout before adding logic?
- Is it safe before beta expansion?
- Does it fit the current private beta scope?
- Would fixing it improve first-run clarity or daily return intent?

## Next-Action Buckets

- Fix before more testers: P0/P1 issues, trust concerns, repeated first-run blockers, or serious mobile layout problems.
- Fix this week: repeated P2 friction, small copy/layout improvements, or bugs with clear reproduction.
- Watch for repetition: one-off feedback that may become important if another tester mentions it.
- Save for later: useful but larger feature requests that are not needed for the first beta round.
- Reject / not aligned: requests that conflict with Life Pulse scope, safety boundaries, or current beta constraints.

## What Not To Do During Beta

- No big new modules.
- No native iOS or Android app.
- No watch app.
- No AI automation.
- No offline sync.
- No bank integrations.
- No wearable integrations.
- No redesign.
- No schema-heavy changes unless there is a blocker.
- No large workflow rewrites based on one tester.

## Recommended Review Rhythm

- Review incoming feedback once or twice per day.
- Copy messages, screenshots, and videos into the Round 1 issue log before discussing fixes.
- Group similar issues under common repeated issues.
- After the first wave, pick only the top 1-3 fixes.
- Keep fixes small and directly connected to observed tester friction.
- Run production QA after every fix.
- Re-check production on phone before inviting more testers.

## Triage Checklist

For every item added to the issue log:

- Capture tester, date, device, browser, and route.
- Save screenshot or video links if provided.
- Assign category and severity.
- Try to reproduce without mutating production data unless there is a safe QA path.
- Decide one next-action bucket.
- Link the commit after a fix ships.
