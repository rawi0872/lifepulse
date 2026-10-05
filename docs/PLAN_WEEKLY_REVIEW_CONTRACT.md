# Weekly Plan → Weekly Review Contract (PLAN V1 — Prompt 1/3)

Prompt 3 (Weekly Review integration) will answer, per reviewed week:

- What did I plan?
- What got done?
- What slipped?
- What changed?
- What deserves next week?

## Source of truth (no migration gymnastics)

All answers come from the Prompt 1 tables, keyed by the SAME week:

- `weekly_plans.week_start` (Monday, local) === Weekly Review `weekStart`
  (both derive from `getPlanWeekStart` / `getWeekStartForDate` — Monday).
- `weekly_plans.week_end` is the Sunday of `week_start`.

## Per-question mapping

| Review question      | Plan data |
| -------------------- | --------- |
| What did I plan?     | `weekly_plans` row (intention) + `weekly_outcomes` rows (text, position, done, must_win, goal_id, project_id) for that `week_start`. |
| What got done?       | Outcome `done` flags (explicit user marking) + linked task `status = done` + `habit_logs` rows in `[week_start, week_end]` for linked habits. Use `summarizePlanEvidence` (counts only, never a score). |
| What slipped?        | Outcomes with `done = false` + linked tasks still `todo` + linked habits with zero log days in the week. |
| What changed?        | `updated_at` on plans/outcomes; deleted outcomes disappear (history is the review block itself, written at review time). |
| What deserves next week? | Unfinished outcomes are re-creatable via `buildWeeklyOutcomeInsert` into the next week's plan (copy text forward, never move rows). |

## Invariants Prompt 3 must preserve

- One plan per user/week (`weekly_plans_user_week_unique`).
- At most 3 outcomes per plan, positions 1–3, at most 1 Must Win.
- Links reference canonical tasks/habits (`weekly_plan_links`); deleting a
  task/habit never destroys plan history (no FK from links).
- Deleting a goal/project nulls the outcome's `goal_id`/`project_id`
  (`on delete set null`) instead of deleting the outcome.
- NEXTRON may read plans to interpret ("You planned X; today Y looks most
  relevant") but never writes plans autonomously.
