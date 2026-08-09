# NEXTRON Approved Cross-Domain Actions

Prompt 3 extends NEXTRON from Task-only approved actions to bounded approved changes across Goals, Habits, Projects, and Tasks.

## Supported Actions

- `life_pulse.task.create`
- `life_pulse.task.update`
- `life_pulse.goal.create`
- `life_pulse.goal.update`
- `life_pulse.habit.create`
- `life_pulse.habit.update`
- `life_pulse.project.create`
- `life_pulse.project.update`
- `life_pulse.action_plan.execute` for bounded multi-action plans

Unsupported: deletes, Calendar writes, reminders delivery, external messages, financial transactions, settings/security mutations, background/autonomous execution.

## Permission Model

Write permissions are stored on `nextron_context_preferences` and default to `false`:

- `allow_task_actions`
- `allow_goal_actions`
- `allow_habit_actions`
- `allow_project_actions`

Permission is separate from approval. Granting a write permission only allows NEXTRON to execute a specific approved preview later. Permission is rechecked at execution time, so revocation before approval/execution blocks mutation.

## Approval Model

All mutations flow through durable `nextron_action_proposals` records. Proposals are owner-scoped and can be approved or cancelled only by authenticated POST routes. GET never mutates. The provider cannot approve, execute, choose owners, choose arbitrary tables, or send SQL/RPC names.

## Lifecycle

Proposal statuses include:

- `pending`
- `completed`
- `partially_failed`
- `failed`
- `stale`
- `canceled`
- `expired`
- `invalidated`
- `approved_execution_disabled` for disabled namespaces such as reminders

Terminal states do not regress to executable states. Cancelled, expired, stale, failed, and completed records remain durable audit evidence.

## Exact-Once And Idempotency

Execution locks only owner-scoped `pending` proposals. Replays return the durable terminal row and do not execute again. Proposal creation supports an owner-scoped idempotency key for deterministic plan sources such as onboarding draft conversion.

Create actions also avoid obvious duplicate entities by checking existing owned rows with the same title before inserting. This is not fuzzy merging; ambiguous updates require exact target resolution.

## Stale Updates

Update proposals capture meaningful expected state, such as title, status, priority, due date, frequency, or deadline. Execution updates only if the owned row still matches that expected state. If the row changed, the proposal becomes stale or failed rather than blindly overwriting newer user edits.

## Onboarding Setup Translation

The saved validated Life Setup Draft is converted deterministically into a bounded `life_pulse.action_plan.execute` proposal. No model call is made for this translation. The plan is bound to a draft hash and onboarding update timestamp through the idempotency/source metadata.

Flow:

- Life Setup Draft
- Build my Life Pulse
- Action Plan Preview
- Permission review if needed
- Explicit approval
- Server execution
- Result summary

## Cost Boundary

Action preview/execution does not call the model. Opening pages does not create action proposals. There is no polling, no background AI, and no autonomous execution.

## Calendar Boundary

Calendar remains read-only. NEXTRON may explain that scheduling is not enabled, but it cannot create, move, RSVP to, or delete Calendar events.
