# Review Usefulness And Charts Plan

Life Pulse needs Weekly Review and Insights to answer clearer questions from logged activity, not just show information blocks. This plan uses existing data only and does not require schema changes for the first slices.

## Product Diagnosis

- The core loop is useful but still shallow when a user has only a few logs: Today can guide action, but Review needs stronger payoff.
- Habits and Tasks are currently the most immediately useful loop pages because they support direct action.
- Weekly Review and Insights are partly useful, but many sections still read like metric cards instead of a guided review experience.
- Body, Mind, Finance, Knowledge, and Passions have useful manual logging surfaces, but their value is delayed until Review turns them into patterns.
- The product will feel deeper when each review section answers: what changed, what repeated, what was quiet, and what one manual adjustment is worth considering.

## Existing Data Available

- Habits: `habit_logs.completed_date`, habit frequency, days per week, times per week.
- Tasks: `tasks.status`, `tasks.completed_at`, priority, realm, project links.
- Journal: `journal_entries.entry_date`, mood, energy, content.
- Mind: `mind_metrics.entry_date`, mood, stress, focus, clarity, motivation.
- Body: `body_metrics.entry_date`, energy, sleep, weight fields; workouts, nutrition, measurements.
- Finance: manual income/expense transactions by date and account currency.
- Goals/Projects: active status, milestones, goal links to projects/tasks/habits.
- Knowledge/Passions: saved items and session durations by date.

## Safe First Charts

- Weekly rhythm chart: habits, completed tasks, and reflections by weekday.
- Habit consistency graph: expected vs completed habit actions for each day of the current week.
- Task completion by day: completed tasks grouped by `completed_at` date.
- Mind trend strip: mood, stress, focus, and clarity as small 7-day line or bar trends.
- Body trend strip: sleep and energy across the week; avoid medical interpretation.
- Finance weekly bars: logged income and expenses by day; always labeled manual tracker, not advice.
- Goal action linkage visual: active goals with vs without linked actions.

## Staged Implementation

1. Weekly Review v1: add daily rhythm chart and fix weekly task counts to use this week only. Shipped.
2. Weekly Review v2: add existing-data trend surfaces for daily action mix, reflection rhythm, and mind check-in trends. Shipped.
3. Weekly Review v3: add section-level “what changed this week” summaries using deterministic counts only.
4. Insights v1: add reusable small bar chart primitives for habits, tasks, body, mind, and finance signals.
5. Insights v2: add 4-week trend comparisons using existing timestamps and manual logs.
6. Review v4: add user-controlled filters for current week, last week, and month, without adding new storage.

## Current Weekly Review v2 Scope

- Implemented daily action mix bars using current-week `habit_logs.completed_date` and task `completed_at` data already loaded by Weekly Review.
- Implemented reflection rhythm dots using current-week `journal_entries.entry_date` data already loaded by Weekly Review.
- Implemented mind trend strip using current-week `mind_metrics` data; this reuses the existing mind metrics query and adds `entry_date` to the selected fields so values can be grouped by day.
- Kept sparse states factual: “This becomes clearer after a few logged days” and “No judgment - quiet weeks still count.”
- Kept the review flow as summary, rhythm/trends, section details, reflection prompts, and Save to Journal.

## Deferred From v2

- Multi-week comparisons: requires broader date windows and careful performance checks.
- Rich finance trend charts: safe later, but daily money charts need more currency handling and would add clutter in this slice.
- Body trend strip: safe later, but Weekly Review already has many body/nutrition metrics and mind trends provide a clearer first depth upgrade.
- Goal/project progress history: useful later, but current data mostly shows current active/link state rather than historical change.

## Safety Boundaries

- Use factual language: trend, pattern, logged activity, manual review, private context.
- Do not use diagnosis, advice, prediction, fake AI, “you should,” financial guidance, medical guidance, or therapy language.
- Keep charts read-only and based only on user-entered data.
