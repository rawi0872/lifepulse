# Performance Roadmap

This tracks follow-up work after the Round 1 perceived-loading pass. Keep changes scoped and verify behavior on phone and desktop before shipping.

## Current State

- Core protected routes are static client shells that fetch Supabase data after auth.
- `/today` and `/insights` now render primary content before secondary module signals finish loading.
- `/insights` keeps the primary render split and hydrates bounded last-7-days trend signals after the main page appears.
- Full network idle can still be around 5 seconds locally because background Supabase requests continue after first useful paint.

## Next Opportunities

- Shape route-specific query payloads so high-traffic pages fetch only fields used above the fold.
- Replace full-history reads with bounded date windows where historical totals are not required.
- Consider small server-side aggregate endpoints for expensive totals if client-side Supabase fan-out remains visible in production.
- Add lightweight route timing checks to production smoke tests only after the beta UX stabilizes.
