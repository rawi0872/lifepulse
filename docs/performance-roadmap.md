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

## Next Opportunities

- Shape route-specific query payloads so high-traffic pages fetch only fields used above the fold.
- Replace full-history reads with bounded date windows where historical totals are not required.
- Consider small server-side aggregate endpoints for expensive totals if client-side Supabase fan-out remains visible in production.
- Add lightweight route timing checks to production smoke tests only after the beta UX stabilizes.
- Deeper work deferred from Prompt #8: server-side aggregation, broader historical windows, route-level data loaders, caching strategy, and cross-route query consolidation.
- Deeper work deferred from Prompt #9: exact server aggregates for all-time XP, cached habit streak summaries, cached Finance account balances, and route-level data loaders for editable all-list pages.
