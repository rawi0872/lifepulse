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

## Next Opportunities

- Shape route-specific query payloads so high-traffic pages fetch only fields used above the fold.
- Replace full-history reads with bounded date windows where historical totals are not required.
- Consider small server-side aggregate endpoints for expensive totals if client-side Supabase fan-out remains visible in production.
- Add lightweight route timing checks to production smoke tests only after the beta UX stabilizes.
- Deeper work deferred from Prompt #8: server-side aggregation, broader historical windows, route-level data loaders, caching strategy, and cross-route query consolidation.
- Deeper work deferred from Prompt #9: exact server aggregates for all-time XP, cached habit streak summaries, cached Finance account balances, and route-level data loaders for editable all-list pages.
- Deeper work deferred from Prompt #14: exact XP/realm XP aggregate design, deterministic habit streak aggregate design, finance account balance snapshot or RPC design, and Journal pagination/search that preserves private-history meaning.
