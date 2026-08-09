# NEXTRON Conversational Onboarding

Prompt 2 introduces a NEXTRON-native first session for new users. The user talks to NEXTRON, NEXTRON builds an onboarding-only understanding, and the result is a Life Setup Draft.

## State Model

Onboarding state is stored in `public.nextron_onboarding`, one row per user:

- `not_started`: row exists, no meaningful turn yet.
- `in_progress`: conversation has begun and understanding is accumulating.
- `draft_ready`: NEXTRON has enough information to show a Life Setup Draft.
- `completed`: the user confirmed the draft is ready to build.
- `skipped`: the user chose to use Life Pulse without finishing onboarding.

`profiles.onboarding_completed` remains the existing-user gate. A completed draft updates that profile flag. Skipping persists in `nextron_onboarding` and lets the user proceed without pretending setup was completed.

## Conversation Architecture

Onboarding reuses canonical NEXTRON conversation storage:

- `nextron_conversations` stores the private thread.
- `nextron_messages` stores visible user and assistant turns.
- `nextron_onboarding.conversation_id` links onboarding state to that thread.

There is no second chat backend and no hidden long-term memory system.

## AI Contract

Each explicit user send can produce:

- a natural `reply`
- cumulative `understanding`
- `missingHighValueInformation`
- `readiness`
- optional `setupDraft`

The schema is validated and bounded. Provider failure falls back to deterministic synthesis. Ordinary page render does not call the provider.

## Draft Meaning

The Life Setup Draft is a proposal only. It can include current focus, recommended goals, starter habits, initial tasks, projects, routines, important dates, and deliberately omitted items.

Confirming “setup ready” does not create Goals, Habits, Tasks, Projects, Calendar events, reminders, or actions. Prompt 3 owns the safe execution layer.

## Privacy

Onboarding statements remain onboarding-owned state and conversation context. They are not silently written to NEXTRON Memory. Explicit Memory behavior remains separate and permission-bound.

The onboarding table is authenticated, owner-scoped through RLS, and does not grant anon/public access.
