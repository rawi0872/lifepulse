# Performance Roadmap

This tracks follow-up work after the Round 1 perceived-loading pass. Keep changes scoped and verify behavior on phone and desktop before shipping.

## Current State

- Core protected routes are static client shells that fetch Supabase data after auth.
- `/today` and `/insights` now render primary content before secondary module signals finish loading.
- `/insights` keeps the primary render split and hydrates bounded last-7-days trend signals after the main page appears.
- Deadline Prompt #8 stabilized focused Supabase browser client instances on core routes so client-dependent effects do not recreate fetch loops after state updates.
- `/journal` now fetches only rendered entry fields and memoizes entry classification, counts, and filtering.
- `/body` and `/mind` now show calm loading frames instead of blank screens while initial data loads.
- Deadline Prompt #9 narrowed oversized `select("*")` route reads on Today, Habits, Tasks, Body, Mind, Finance, Projects, and Goals while preserving all existing metric meanings.
- Deadline Prompt #13 moved Today project/goal context and all-history habit streak work out of the first useful render while preserving final Today meanings.
- Deadline Prompt #14 audited exact totals and full-history reads; safe fixes reduced count-only Insights payloads and Finance joined transaction payloads while preserving exact XP, streak, and balance meanings.
- Deadline Prompt #15 produced the design-only aggregate/caching plan for exact XP, streak, finance balance, and private-history performance work; no schema or production behavior changed.
- Deadline Prompt #16 added the exact XP totals RPC migration and switched Today and Insights displayed total/today XP through a safe RPC helper with client-read fallback until hosted Supabase has the function applied.
- Deadline Prompt #19 added a read-only production network audit and confirmed the live XP RPC is used by Today and Insights; remaining exact-history reads are realm XP, habit streaks, and finance balances.
- Full network idle can still be around 5 seconds because background Supabase requests continue after first useful paint.

## Deadline Prompt #8 Performance Pass 2

- Baseline phone 390x844 production timing after login: `/today` useful content around 2.1s, `/weekly-review` around 2.6s, `/insights` around 1.5s, `/journal` around 1.6s, with no horizontal overflow observed.
- Stabilized Supabase clients with local state in focused core and secondary routes/components to avoid reload loops from recreated client objects.
- Kept `/today`, `/weekly-review`, and `/insights` split-loading behavior intact so secondary context can finish after primary content where already designed.
- Improved `/weekly-review` loading copy/skeleton to explain that current-week data appears before previous-week comparison.
- Reduced Journal payload and repeated client work without changing history storage, filters, or read-only behavior.

## Deadline Prompt #9 Data Shaping And Bounded Reads

- Replaced broad route-level `select("*")` calls with explicit column lists on `/today`, `/habits`, `/tasks`, `/body`, `/mind`, `/finance`, `/projects`, and `/goals` where the rendered UI and edit forms only need known fields.
- Left Weekly Review current-week and previous-week reads unchanged because they were already bounded to the intended week windows.
- Left Insights secondary trend reads unchanged because last-7-days and current-month reads were already bounded to the visible UI meaning.
- Left exact all-time XP, realm XP, habit streak, best-ever streak, Finance account balance, Journal all-history, and editable route list reads unbounded where narrowing the date window would change metric meaning.
- Finance still reads all transactions for exact account balances and six-month/current/previous month calculations; a future aggregate or cached balance strategy is needed before this can be reduced safely.

## Deadline Prompt #13 Today-Specific Performance Pass

- `/today` first useful render now waits only for the data needed to show the header, daily focus, quick capture, visible task/habit action state, today reflection state, and XP.
- Project task suggestions, project title context, task goal context, optional goal preview details, Body/Mind/Finance context, Knowledge, Passions, and all-history habit streaks now hydrate after primary Today content appears.
- Habit completion for Today still uses today/week logs before render so due habits, times-per-week status, and visible action status keep the same meaning.
- Full habit history is still loaded to compute exact current streaks, but it no longer blocks the first useful Today screen.
- Today reflection now uses a stable Supabase client and an explicit today-entry select list to avoid repeated reload risk and oversized entry reads.
- Deferred: server aggregates, route-level loaders, caching strategy, database summary tables, cached streak summaries, cached XP totals, cached finance balances, and any deeper Today architecture rewrite.

## Deadline Prompt #14 Exact Totals And History Audit

| Metric/read | Current route | Current reason it is heavy | Safe fix done now | Deferred fix | Risk |
| --- | --- | --- | --- | --- | --- |
| All-time XP / current level | `/today`, `/insights` | Exact total XP is calculated from every XP event. | Kept explicit `amount` / source columns only; no date window added. | Server-side XP aggregate, RPC, or cached user XP total maintained transactionally. | Client read grows with lifetime XP event history. |
| Realm XP | `/insights`, `/body`, `/mind` | Realm totals need exact XP event sums and, for Insights, source-to-realm mapping. | Preserved exact reads; kept selected columns narrow. | Realm XP aggregate keyed by user/realm, or RPC that sums without returning rows. | Insights remains sensitive to large XP histories. |
| Habit current and best streaks | `/today`, `/habits`, `/insights` | Exact current/best streaks require full habit completion history. | Today already hydrates full habit history secondarily; retained narrow `habit_id, completed_date` reads. | Cached streak summaries or streak RPC with deterministic semantics. | Large habit histories still affect network idle and Habits/Insights load. |
| Finance exact account balances | `/finance` | Balances require all account transactions plus starting balance. | Split Finance reads: exact balance math now uses lightweight all-history `account_id, amount, type`; joined transaction rows are limited to the selected six-month chart/list window. | Account balance snapshots, ledger aggregate, or balance RPC. | Balance query still grows with all transaction history, but payload is smaller. |
| Finance monthly charts/list | `/finance`, `/insights`, `/weekly-review`, `/today` | Charts need selected month, previous month, six-month, or week/month windows. | Kept route windows bounded; Finance full joined transaction read now bounded to the selected six-month range. | Server monthly aggregates if transaction volume becomes high. | Chart queries can grow within active month windows. |
| Journal lifetime history | `/journal`, `/insights` | Journal route intentionally shows private lifetime history with search/filter. | Insights lifetime/monthly journal counts now use exact count-only head queries; Journal history left exact. | Pagination/search design for Journal, not a silent limit. | Journal page can grow with private history. |
| Editable full lists | `/tasks`, `/habits`, `/projects`, `/goals` | Routes show editable all-list state and filters. | No semantic narrowing beyond existing explicit columns. | Pagination or route-level loaders when editable lists become large. | Large editable lists still load client-side. |

- Highest-impact safe fix shipped now: Finance no longer downloads all historical joined transaction rows just to compute exact balances.
- Count-only fix shipped now: Insights journal lifetime/month counts and active project count use exact head/count reads instead of returning rows.
- Intentionally preserved: all-time XP, level, realm XP, habit current/best streaks, finance balance meaning, Journal lifetime history, task/habit completion behavior, and finance CRUD behavior.
- Future database prompt should design aggregate/RPC work explicitly before implementation: XP totals, realm XP, habit streak summaries, finance account balances, and optional Journal pagination/search.

## Deadline Prompt #15 Exact Aggregates And Caching Plan

This section is design-only. Do not implement these areas together; each database change should be one focused prompt with migration review, RLS review, backfill, rollback notes, and production smoke checks.

| Area | Current bottleneck | Exact meaning to preserve | Recommended approach | Why this approach | Required schema/RPC/trigger work | Backfill requirement | RLS/security concern | Test coverage needed | Risk level | Recommended prompt number for implementation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| XP totals | `/today`, `/insights`, `/body`, and `/mind` sum `xp_events` rows for all-time, today, and realm XP. | All-time XP, current level, today XP, realm XP, and task/habit XP event meaning. | First implement exact RPC sum queries for total/today/realm XP; add summary table only if RPC latency remains visible. | RPC removes row transfer without changing write behavior; summary table/triggers add more failure modes and should come second. | RPC such as `get_xp_totals()` using authenticated user context; optional later `user_xp_totals` / `user_realm_xp_totals` plus trigger on `xp_events`. | RPC needs none; summary table needs backfill from `xp_events` grouped by user and realm/source mapping. | RPC must derive `auth.uid()` internally and never accept arbitrary user IDs from the client; summary table must have owner-only RLS if exposed. | Unit SQL fixtures for task/habit XP insert/delete, duplicate prevention, today boundary, realm mapping, and parity with current client sums. | Medium for RPC, high for trigger summaries. | #16 for XP RPC; summary table only after measuring RPC. |
| Habit streaks | `/today`, `/habits`, and `/insights` need all `habit_logs` dates to compute current and best streaks. | Current streak, best streak, today/week completion, `times_per_week` behavior, grace period for today, rest-day handling, and no fake streaks. | Implement an exact streak RPC that accepts habit IDs or returns per-user habit streaks from existing `habit_logs`; defer persisted summaries. | Current TypeScript streak logic has nuanced date semantics; RPC can centralize exact calculation without cache invalidation bugs. | SQL or PL/pgSQL RPC mirroring `getCurrentStreak`, `getBestStreak`, and `getWeeklyProgress`; optional later `habit_streak_summaries` only after parity is proven. | RPC needs none; summary table needs backfill for every habit and recalculation after historical log changes. | RPC must only return rows for `auth.uid()` habits/logs; if accepting habit IDs, enforce ownership inside the function. | Golden tests comparing JS helper outputs to RPC outputs for daily, weekdays, `times_per_week`, today toggled on/off, missed days, rest days, and best-ever streaks. | Medium-high because semantic drift is easy. | #17 after XP RPC; summary only after parity tests. |
| Finance balances | `/finance` exact balances require all transaction amounts plus account starting balances. | Current account balance, transaction count, income/expense totals where claimed, account currency separation, editable transaction list behavior, and no advice. | Implement exact balance RPC for account balances; defer balance snapshot table/triggers until transaction volume proves RPC insufficient. | RPC keeps write paths simple and handles edits/deletes exactly at read time; snapshots/triggers must handle insert/update/delete/account moves perfectly. | RPC such as `get_finance_account_balances()` summing `finance_transactions` by account with starting balances; optional later `finance_account_balances` maintained by triggers. | RPC needs none; snapshot table needs backfill per account from starting balance plus all linked transactions. | RPC must use `auth.uid()` and respect finance account ownership; no cross-user account/category leakage through joins. | SQL fixtures for insert, update amount/type/account/date, delete, null account, deleted account with `on delete set null`, mixed currencies, and parity with current client `computeAnalytics`. | Medium for RPC, high for snapshots/triggers. | #18 after streak RPC. |
| Journal and full editable lists | `/journal` and editable routes can grow because full history/list rows are needed for search, filters, and edit screens. | Private history access, no hidden data, existing search/filter expectations, and exact editable state. | Add explicit pagination/infinite-load design before implementation; start with Journal if history grows, leave editable lists full until there is real scale pressure. | Pagination is safer than aggregates for history, but it changes UI expectations and search scope if done carelessly. | No schema initially; route query changes plus UI copy for loaded/all history. Optional indexed search later. | None for simple pagination. | Owner-only RLS already protects rows; UI must avoid implying unloaded rows were searched. | Route tests for page loading, load-more behavior, filters/search scope copy, no blank states, and no data loss from edit/delete screens. | Low-medium for Journal pagination, medium for editable lists. | #19 or later; after exact aggregate bottlenecks. |

Recommended staged implementation order:

1. XP RPC first before 18/8/26 if one aggregate area is chosen, because it reduces repeated all-time XP row transfer on Today and Insights without touching task/habit write semantics.
2. Habit streak RPC second only after parity tests are written against the current JS streak helpers; this is high product-risk because streak meaning is visible and nuanced.
3. Finance balance RPC third; it is valuable but Prompt #14 already reduced payload size, and trigger/snapshot designs are too risky before the simpler exact RPC is measured.
4. Journal/private-history pagination last; it should wait for clear user-data scale or tester feedback because it can change search/filter expectations.

Before 18/8/26:

- Prefer one exact aggregate implementation prompt at a time.
- Start with XP RPC if performance still blocks perceived readiness.
- Keep summary tables/triggers out unless RPC results prove insufficient and tests are already in place.
- Keep all visible numbers exact; no estimates, fake caches, or recent-window substitutions.

After v1:

- Consider XP and finance summary tables only with transactional trigger tests and a backfill/repair script.
- Consider persisted habit streak summaries only after RPC parity is proven across real edge cases.
- Add Journal and full-list pagination/search once private history volume justifies a UI change.

Options intentionally rejected for near-term release:

- Materialized views, because refresh timing introduces stale exact metrics unless carefully managed.
- Broad route-level caching for user-specific exact totals, because invalidation after task/habit/finance writes is easy to get wrong.
- Implementing XP, streaks, and finance aggregates in one migration, because rollback and semantic QA would be too large.
- Approximate totals or recent-window replacements for metrics that imply all-time/current/exact meaning.

## Deadline Prompt #16 Exact XP RPC

- Added migration `supabase/migrations/00017_xp_totals_rpc.sql` defining `public.get_xp_totals(p_today_start timestamptz)`.
- The function uses `auth.uid()` internally, runs as `security invoker`, relies on existing owner-only `xp_events` RLS, and returns exact `total_xp` plus exact `today_xp` for the local-day boundary supplied by the client.
- `/today` first load and reload paths now call `loadExactXpTotals()` for displayed total XP and today XP.
- `/insights` now calls `loadExactXpTotals()` for displayed total XP, today XP, level, and level progress, while keeping the existing `xp_events(amount, source_type, source_id)` read for realm XP mapping.
- Realm XP remains client-side because current realm totals depend on mapping task and habit-log source IDs to realm IDs; adding realm XP to this RPC would risk changing meaning without a dedicated design.
- `/body` and `/mind` realm XP reads remain client-side because they are realm-specific and not equivalent to global total/today XP.
- No summary tables, triggers, materialized views, XP write changes, level threshold changes, or XP amount changes were added.
- Production remains safe before hosted Supabase migration application because `loadExactXpTotals()` falls back to the previous exact client-side reads if the RPC is unavailable; the row-transfer performance benefit starts only after `00017_xp_totals_rpc.sql` is applied to hosted Supabase.

## Deadline Prompt #19 Production Network Audit

Read-only phone 390x844 production audit using `npm run test:prod:network-audit`:

| Route | Visible timing | Network idle | Supabase REST | Supabase RPC | XP RPC observed | Remaining exact-history signal |
| --- | --- | --- | --- | --- | --- | --- |
| `/today` | 2219ms | 8627ms | 26 | 2 | Yes | No `xp_events` REST read; deferred unbounded `habit_logs` remains for exact streaks. |
| `/insights` | 2271ms | 7454ms | 26 | 1 | Yes | One `xp_events` REST read remains for exact realm XP mapping; unbounded `habit_logs` remains for current/best streaks. |
| `/habits` | 1277ms | 7457ms | 5 | 0 | No | Unbounded `habit_logs` remains for exact current/best streaks. |
| `/finance` | 745ms | 5626ms | 5 | 0 | No | Unbounded lightweight `finance_transactions(account_id, amount, type)` remains for exact balances. |
| `/weekly-review` | 736ms | 6334ms | 24 | 0 | No | Reads are bounded to current/previous week or latest-only signals. |

- XP RPC result: `/today` no longer uses REST `xp_events` reads for displayed total/today XP; `/insights` uses the RPC for displayed total/today XP but keeps `xp_events` rows for realm XP.
- Remaining performance options: realm XP RPC, habit streak RPC, and finance balance RPC all remain possible, but each carries more semantic/parity risk than the exact total XP RPC.
- Recommendation after measurement: stop aggregate/RPC performance work for the next deadline prompt and return to domain depth or beta-readiness UX unless new tester data shows these remaining exact reads are blocking real use.
- If performance work resumes, choose only one area: habit streak RPC has the clearest repeated route impact (`/today`, `/insights`, `/habits`), but it needs strict parity tests against `src/lib/streaks.ts` before any migration.

## Next Opportunities

- Shape route-specific query payloads so high-traffic pages fetch only fields used above the fold.
- Replace full-history reads with bounded date windows where historical totals are not required.
- Consider small server-side aggregate endpoints for expensive totals if client-side Supabase fan-out remains visible in production.
- Add lightweight route timing checks to production smoke tests only after the beta UX stabilizes.
- Deeper work deferred from Prompt #8: server-side aggregation, broader historical windows, route-level data loaders, caching strategy, and cross-route query consolidation.
- Deeper work deferred from Prompt #9: exact server aggregates for all-time XP, cached habit streak summaries, cached Finance account balances, and route-level data loaders for editable all-list pages.
- Deeper work deferred from Prompt #14: exact XP/realm XP aggregate design, deterministic habit streak aggregate design, finance account balance snapshot or RPC design, and Journal pagination/search that preserves private-history meaning.
- Deeper work deferred from Prompt #15: implementing XP RPC, habit streak RPC, finance balance RPC, and Journal pagination in separate future prompts with tests and migration review.
- Deeper work deferred from Prompt #16: realm XP RPC design, habit streak RPC, finance balance RPC, and any summary-table work after exact RPC behavior is measured.
- Deeper work deferred from Prompt #19: realm XP RPC, habit streak RPC, and finance balance RPC; do not implement multiple aggregate RPCs in one prompt.
