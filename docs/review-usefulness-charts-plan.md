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
3. Weekly Review v3: add section-level “what changed this week” summaries using deterministic counts only. Shipped as Deadline Prompt #2.
4. Weekly Review v4: add bounded current-week versus previous-week comparison using minimal previous-week data. Shipped as Deadline Prompt #3.
5. Insights v1: add bounded last-7-days trend surfaces for habits, tasks, reflection, body, mind, finance, and active system signals. Shipped as Deadline Prompt #4.
6. Insights v2: add 4-week trend comparisons using existing timestamps and manual logs.
7. Review v5: add user-controlled filters for current week, last week, and month, without adding new storage.

## Current Weekly Review v2 Scope

- Implemented daily action mix bars using current-week `habit_logs.completed_date` and task `completed_at` data already loaded by Weekly Review.
- Implemented reflection rhythm dots using current-week `journal_entries.entry_date` data already loaded by Weekly Review.
- Implemented mind trend strip using current-week `mind_metrics` data; this reuses the existing mind metrics query and adds `entry_date` to the selected fields so values can be grouped by day.
- Kept sparse states factual: “This becomes clearer after a few logged days” and “No judgment - quiet weeks still count.”
- Kept the review flow as summary, rhythm/trends, section details, reflection prompts, and Save to Journal.

## Deadline Prompt #2 Summary Scope

- Added a deterministic “What changed this week” section between the weekly summary cards and trend charts.
- Summary cards use the existing Weekly Review weekly payload only: logged days, habit days, completed task days, reflection days, mind check-in days, body/nutrition days, finance entry days, most active day, and quiet days.
- Sparse state uses factual copy: “This week is still quiet,” “A few tasks, habits, or reflections will make this review clearer,” and “No judgment - quiet weeks still count.”
- The section is memoized from loaded weekly data and adds no new Supabase queries.

## Deadline Prompt #3 Previous-Week Scope

- Added a compact “Compared with last week” section after “What changed this week.”
- Previous-week data is bounded to one week only and uses minimal date/count fields: habit log dates, completed task timestamps, journal entry dates, mind entry dates, body entry dates, nutrition log dates, and finance transaction dates.
- Comparison copy is factual and neutral: “+N from last week,” “Same as last week,” or “N fewer than last week.”
- The current-week page renders first; previous-week comparison hydrates as secondary data to avoid blocking the main review.
- 4-week comparisons remain deferred until performance-aware data windows are designed.

## Deadline Prompt #4 Insights Useful Trends Scope

- Upgraded `/insights` from generic blocks to a deterministic trends page with an Insight overview, Activity trends, Domain signals, Quiet areas, and Manual review links.
- Added a bounded last-7-days secondary trend payload using minimal date/count fields: completed task timestamps, habit log dates, journal entry dates, mind entry dates, body entry dates, nutrition log dates, and finance transaction dates.
- Kept the primary Insights render split intact: level, momentum, and existing primary data render first; recent trends hydrate as secondary signals.
- Replaced top score-like snapshot copy with factual logged-day, action-day, reflection-day, and task-completion summaries.
- Quiet-state copy stays neutral: not enough logged activity yet; quiet areas are not failures; no AI summaries or external processing.
- 4-week trend comparisons, deeper domain-specific insights, server-side aggregates, and richer charts remain deferred until performance-aware data windows are designed.

## Deferred From v2

- Multi-week comparisons: requires broader date windows and careful performance checks.
- Performance-aware data windows: needed before 4-week comparisons or broader historical filters.
- Rich finance trend charts: safe later, but daily money charts need more currency handling and would add clutter in this slice.
- Body trend strip: safe later, but Weekly Review already has many body/nutrition metrics and mind trends provide a clearer first depth upgrade.
- Goal/project progress history: useful later, but current data mostly shows current active/link state rather than historical change.

## Safety Boundaries

- Use factual language: trend, pattern, logged activity, manual review, private context.
- Do not use diagnosis, advice, prediction, fake AI, “you should,” financial guidance, medical guidance, or therapy language.
- Keep charts read-only and based only on user-entered data.
