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
6. Today review handoff: make Today explain how priority, action, reflection, and manual context become Weekly Review and Insights value. Shipped as Deadline Prompt #5.
7. Weekly Review closing flow: make the end of review turn into one next-week focus, Save to Journal, and return-to-Today handoff. Shipped as Deadline Prompt #6.
8. Journal private history: make daily reflections and saved weekly reviews easier to recognize, filter, and return to. Shipped as Deadline Prompt #7.
9. First-week experience: guide new users from the first Today loop through repeated daily loops, Weekly Review, Insights, and Journal without new storage, AI, scoring, advice, or heavy queries. Shipped as Deadline Prompt #10.
10. First-session sequencing: make Today, Tasks/Habits, Journal, Weekly Review, and later Insights the explicit first-session route order while keeping optional modules available. Shipped as Deadline Prompt #11.
11. First action completion flow: make completed tasks and habits hand off into reflection and later review using existing Today state and row copy only. Shipped as Deadline Prompt #12.
12. Domain depth pass: make Body, Mind, and Finance explain their manual context value for Weekly Review using already-loaded data only. Shipped as Deadline Prompt #20.
13. Goals/Projects execution depth: make goals and projects show connected work, next visible action, and review handoff using existing links/tasks only. Shipped as Deadline Prompt #21.
14. Private beta readiness polish: clarify first-session route order, mobile More grouping, bigger-work planning, optional context, and review timing using copy/layout only. Shipped as Deadline Prompt #22.
15. Insights v2: add 4-week trend comparisons using existing timestamps and manual logs.
16. Review v5: add user-controlled filters for current week, last week, and month, without adding new storage.

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
- Quiet-state copy stays neutral: not enough logged activity yet; quiet areas are not judgments; no AI summaries or external processing.
- 4-week trend comparisons, deeper domain-specific insights, server-side aggregates, and richer charts remain deferred until performance-aware data windows are designed.

## Deadline Prompt #5 Today Review Handoff Scope

- Added a compact `/today` handoff that explains how priorities, tasks, habits, reflection, and body/mind/finance logs become Weekly Review and Insights value.
- Handoff statuses are derived only from existing Today state: priority presence/completion, visible task or habit action, reflection presence, and optional manual context logs.
- Kept Weekly Review and Insights links compact and below the primary daily action area so Today still prioritizes daily focus, one visible action, reflection, then review payoff.
- Updated post-action feedback copy so completed tasks and habits clarify that logged actions appear in weekly rhythm/action trends.
- No new data architecture, schema changes, AI summaries, external processing, or heavy Today queries were added.

## Deadline Prompt #6 Weekly Review Closing Flow Scope

- Refined the end of `/weekly-review` into a clearer close-the-week flow after summaries, comparisons, and charts.
- Made the existing saved next-week focus reflection field central: one small focus to carry into next week, saved with the weekly review note.
- Clarified Save to Journal copy: the review saves to today&apos;s private Journal entry with the weekly review prefix and no AI summaries or external processing.
- Added post-save feedback from local UI state with links to return to Today or open Journal.
- Preserved existing save behavior, storage, queries, XP logic, and manual/private review boundaries.

## Deadline Prompt #7 Journal Private History Scope

- Refined `/journal` into a clearer private-history destination for daily reflections and saved weekly reviews.
- Detects likely saved weekly reviews from existing journal content using the `Weekly Reflection (...)` prefix written by the current Weekly Review Save to Journal flow.
- Added client-side entry type filters for All, Daily reflections, and Weekly reviews using already-loaded `journal_entries` only.
- Weekly review entries now show a recognizable label, saved-week context when available, and an optional next-week focus preview parsed from existing content.
- No new storage, schema, queries, AI summaries, advice, scoring, Journal edit/delete, or Weekly Review save behavior changes were added.

## Deadline Prompt #10 First-Week Experience Scope

- Refined `/today` from a first-loop guide into a compact first-week path: Day 1 Today loop, Days 2-3 repeat, Days 4-6 optional context, Day 7 Weekly Review and Journal.
- Reused existing Today state only: priority presence/completion, visible task or habit completion, today's reflection, and optional Body/Mind/Finance context.
- Tightened onboarding final handoff and sparse copy in Weekly Review, Insights, and Journal so new users know to start with Today and let Review/Insights become useful after a few logged days.
- No new storage, schema, AI, scoring, advice, CRUD changes, XP changes, or heavy queries were added.

## Deadline Prompt #11 First-Session Sequencing Scope

- Made the first-session route order explicit in `/today`: Today, Tasks/Habits, Journal, Weekly Review, then Insights later.
- Grouped the Today ecosystem strip into Start today, Support the loop, Review later, Optional context, and Build later so optional modules do not read as day-1 requirements.
- Kept DashboardNav route labels stable while clarifying mobile More copy and loop connector labels.
- No analytics, tracking storage, schema, new modules, CRUD behavior changes, XP changes, AI, advice, or heavy queries were added.

## Deadline Prompt #12 First Action Completion Flow Scope

- Added a compact `/today` post-action handoff when an existing visible task or habit is logged.
- Made Today&apos;s Next Best Action switch to reflection after a visible action is complete, and to Weekly Review / Journal once action and reflection are both present.
- Updated task and habit completion toasts plus completed-row copy on `/tasks` and `/habits` so logged actions point back to Today reflection and weekly rhythm.
- Reused existing completion and reflection state only; no new queries, storage, analytics, XP changes, task semantics, habit semantics, AI, advice, or automation were added.

## Deadline Prompt #20 Domain Depth Scope

- Added compact Body, Mind, and Finance context panels that explain how recent manual logs feed Weekly Review and broader patterns.
- Body context uses already-loaded body metrics, workouts, nutrition, water, latest weight, and health note props only.
- Mind context uses already-loaded mind metrics, journal entries, mind habits, and open task count only.
- Finance context uses already-loaded monthly transactions and existing analytics only; balance calculations and transaction semantics are unchanged.
- Reframed Finance notes from "Smart Insights" to review context and kept copy factual, private, and non-advisory.
- No new queries, schema, migrations, RPCs, summary tables, AI summaries, external processing, scoring, advice, CRUD changes, XP changes, or finance balance changes were added.

## Deadline Prompt #21 Goals/Projects Execution Depth Scope

- Added collapsed Goals execution context from existing goal links, milestones, tasks, and project-task relationships: connected work, next visible action, recent movement, and Weekly Review handoff.
- Improved Goals sparse state so goals with no linked work explain that one task or linked project makes the goal actionable.
- Improved Projects context using existing project tasks and goal links: next action, linked goal, open/completed task counts, and no-next-action guidance.
- Clarified Today, Weekly Review, and Insights copy so project/goal work is framed as visible action and manual review context.
- Updated focused production smoke expectations for the new execution-depth labels.
- No new queries, schema, migrations, RPCs, summary tables, AI summaries, external processing, automation, CRUD changes, task completion changes, goal/project/task linking changes, or XP changes were added.

## Deadline Prompt #22 Private Beta Readiness Scope

- Audited `/today`, mobile navigation, `/goals`, `/projects`, `/weekly-review`, and secondary routes for first-session comprehension.
- Kept Today focused on one priority, one visible action, reflection, and review later; no large tutorial or new data loading was added.
- Made mobile More non-Core because Today, Tasks, Habits, and Journal already live in the bottom bar.
- Clarified navigation and Today route-order grouping: Goals/Projects are for organizing bigger work, Body/Mind/Finance are optional context, and Weekly Review/Insights are for review after logging.
- Replaced one judgment-style Weekly Review wording instance while preserving the close-the-week flow and Save to Journal behavior.
- No schema, migrations, RPCs, storage, analytics, auth changes, CRUD changes, task/habit/goal/project semantics changes, XP changes, finance meaning changes, AI, social, payments, advice, or new product systems were added.

## Deferred From v2

- Multi-week comparisons: requires broader date windows and careful performance checks.
- Performance-aware data windows: needed before 4-week comparisons or broader historical filters.
- Rich finance trend charts: safe later, but daily money charts need more currency handling and would add clutter in this slice.
- Body trend strip: safe later, but Weekly Review already has many body/nutrition metrics and mind trends provide a clearer first depth upgrade.
- Goal/project progress history: useful later, but current data mostly shows current active/link state rather than historical change.
- Goal/project movement timelines: useful later, but per-goal or per-project history would need careful bounded query design or new data modeling.

## Safety Boundaries

- Use factual language: trend, pattern, logged activity, manual review, private context.
- Do not use diagnosis, advice, prediction, fake AI, “you should,” financial guidance, medical guidance, or therapy language.
- Keep charts read-only and based only on user-entered data.
