# Alpha 1 Private Testing

## Purpose

Test whether Life Pulse genuinely helps people organize and execute their lives through NEXTRON.

## Tester Size

3-5 trusted people initially.

## What Not To Do

Do not teach them detailed workflows.

Do not guide them around confusing UX.

Confusion is feedback.

Do not build analytics infrastructure for this Alpha 1 test.

## Release Gate Environment

The disposable-user production verifier is local CLI-only. Use `SUPABASE_SECRET_KEY` for the server/admin credential when available; `SUPABASE_SERVICE_ROLE_KEY` remains a fallback. Never expose either key to browser code, public Next.js environment variables, application API routes, logs, or committed files.

Fresh production auth users are expected to have one auto-created `profiles` row with `onboarding_completed = false`. The disposable verifier treats that as healthy new-user state, while Goals, Projects, Habits, Tasks, NEXTRON conversations, and Life Map relationships must still start empty.

## What To Observe

- Onboarding comprehension
- Whether NEXTRON understood them
- Quality of Life Setup
- Whether they trusted permissions
- Whether they naturally use NEXTRON
- Whether NEXTRON Noticed is valuable
- Life Map comprehension
- Whether they return voluntarily

## Day 1 Questions

- What confused you?
- What surprised you?
- What felt useful?
- What felt unnecessary?
- Did NEXTRON understand you?

## Day 7 Questions

- Did Life Pulse become more useful?
- What did you actually return for?
- What did you ignore?
- What did you stop using?
- What do you wish NEXTRON understood?
- Would you continue using it?
