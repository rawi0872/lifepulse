# NEXTRON Proactive Attention

Prompt 5 defines proactive intelligence as in-app deterministic awareness. It means Life Pulse can surface useful current information before the user asks, but it does not mean background monitoring, notifications, autonomous action, or automatic AI.

## Architecture

- Signals are the underlying deterministic rule events.
- NEXTRON Attention is the ranked user-facing presentation of those Signals.
- `/api/nextron/signals` returns both raw Signals and the ranked Attention summary for the command center.
- `/api/nextron/attention` returns the same ranked Attention summary for Today.
- Both routes are authenticated, owner-scoped, permission-gated, and server-side.

## Cost Boundary

- Attention uses `modelCalls: 0`.
- Opening `/nextron` does not call a provider merely to compute Attention.
- Opening Today does not call a provider merely to compute Attention.
- No polling, cron, background agent, scheduled AI, push notification, email, SMS, or autonomous execution is introduced.
- Daily Brief remains the separate explicit generation surface with its existing cost contract.

## Rule Registry

Rules live in `src/lib/nextron/signals.ts`. Each rule emits a bounded Signal with a stable identity, type, severity, title, summary, evidence, source domains, route, and bridge prompt.

Shipped rule families:

- Tasks: high-priority overdue work, multiple overdue tasks.
- Projects + Tasks: open-loop clusters, conservative project quiet/stall signal from explicit project-task links and update/completion timestamps.
- Habits: repeated fixed-schedule misses.
- Weekly Review: review window gap.
- Calendar + Tasks: read-only calendar pressure, useful free blocks.
- Positive progress: due tasks clear, weekly habit target met.

## Ranking

Attention ranks deterministically by severity: `important`, then `attention`, then `info`, with title and stable ID tie-breakers. One primary item and up to four secondary items are surfaced. If only informational or no items exist, calm state is valid.

## Evidence

Every attention item includes concise evidence. Evidence comes from canonical Life Pulse state already available through owner-scoped reads: Tasks, Projects, Habits, Weekly Review, and read-only Calendar when allowed. No provider-generated telemetry is accepted as authority.

## Calm And Positive States

Calm state is first-class: NEXTRON can say nothing important needs attention. Positive signals are sparse and only emitted when canonical data proves a useful completion state.

## Seen And Dismissal

Prompt 5 does not add persistence for seen/dismissed states. Existing Signals are derived current observations, not stored alerts. This avoids a new inbox or nag system. If later dismissal becomes necessary, it should bind to the stable condition identity and remain owner-scoped.

## Privacy

Attention does not scan Knowledge, Drive, Memory, or Journal text. Calendar signals are permission-gated and read-only. The UI shows minimum factual evidence and never raw tokens, provider reasoning, hidden prompts, embeddings, or internal IDs.

## Deferred

Deferred to later prompts or hardening gates: notifications, scheduled delivery, background monitoring, broad historical change intelligence, Life Map, fuzzy semantic relationship inference, graph databases, and advanced dismissal/snooze workflows.
