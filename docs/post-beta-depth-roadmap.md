# Post-Beta Depth Roadmap

## Purpose
Phased implementation plan for the depth features identified in Tester #3 feedback and founder vision. Each phase ships independently with clear acceptance criteria, rollback strategy, and no big-bang migrations.

---

## Phase 0 — Private Beta & Evidence (Current)
**Status**: Complete — `900b76d` READY FOR CONTROLLED PRIVATE BETA
**Duration**: 3-7 day testing window, 5-10 testers

### Gate to Phase 1
- [ ] No P0/P1 blockers from beta
- [ ] Core loop confirmed: sign up → onboard → Today → act → reflect → Weekly Review → Insights
- [ ] Mobile 390x844 verified, no horizontal overflow
- [ ] Security/safety boundaries confirmed
- [ ] Performance within guardrails
- [ ] Tester #3 feedback captured as P2 opportunities (not blockers)

---

## Phase 1 — Results & Measurements Foundation
**Complexity**: Medium
**Dependencies**: Phase 0 gate passed
**Primary Value**: Users see measurable outcomes, not just completed actions

### Scope (Finalized Contract)
- **Two tables only**: `metric_definitions`, `metric_entries`
- **No `metric_targets` table in Phase 1** — baseline and optional target live on `metric_definitions` (`baseline_value`, `target_value`, `target_direction`)
- **No `result_milestones` in Phase 1** — defer to Phase 3
- **No template tables** — system templates are static TypeScript config in `src/lib/results/templates.ts`
- **Manual and independent** — No Body, Mind, Finance, Passions, Goals, or device adapters in Phase 1
- **No SWR/TanStack Query** — standard React patterns
- **Migration**: `supabase/migrations/0018_results_foundation.sql`

### Finalized Schema (Phase 1)

#### `metric_definitions`
| Column | Type | Constraints |
|--------|-------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users(id)` CASCADE |
| `domain` | `text` | CHECK IN (body,mind,finance,business,learning,skills,passions,goals,custom) |
| `name` | `text` | 1–80 chars, unique per (user_id, domain) |
| `description` | `text` | nullable |
| `value_kind` | `text` | CHECK IN (number,count,percentage,duration,currency,rating) |
| `unit` | `text` | not null |
| `baseline_value` | `numeric(20,6)` | nullable |
| `target_value` | `numeric(20,6)` | nullable |
| `target_direction` | `text` | CHECK IN (increase,decrease,maintain,none) |
| `cadence` | `text` | CHECK IN (daily,weekly,monthly,quarterly,yearly,custom,none) |
| `archived` | `boolean` | default false |
| `created_at` / `updated_at` | `timestamptz` | default now() |
| **Unique** | `(user_id, domain, name)` | |

#### `metric_entries`
| Column | Type | Constraints |
|--------|-------|-------------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `auth.users(id)` CASCADE |
| `metric_definition_id` | `uuid` | FK → `metric_definitions(id)` CASCADE |
| `value` | `numeric(20,6)` | not null |
| `recorded_at` | `timestamptz` | default now() |
| `notes` | `text` | nullable |
| `created_at` | `timestamptz` | default now() |
| **Composite FK** | `(metric_definition_id, user_id)` | → `metric_definitions(id, user_id)` CASCADE |

**Indexes**: `idx_metric_entries_user_recorded (user_id, recorded_at DESC)`, `idx_metric_entries_definition (metric_definition_id)`

### Status
**Prompt #32/33**: Implementation preparation only — contract finalized in `docs/results-foundation-implementation-blueprint.md` and `docs/results-measurements-system-design.md`. No production behavior changed. Stronger model required before migration implementation.

### Files/Tables
- `supabase/migrations/0018_results_foundation.sql`
- `src/lib/results/types.ts`, `adapters.ts`, `calculations.ts`, `hooks.ts`, `templates.ts`
- `src/app/results/page.tsx`, `src/components/results/MetricList.tsx`, `MetricDetail.tsx`, `EntryForm.tsx`, `HistoryList.tsx`, `TrendSparkline.tsx`
- `src/lib/modules.ts` (add `results` module to "personal" category, status "preview")
- `src/lib/coach.ts` (extend `CoachData` with results fields)

### Risks
- Domain meaning loss (mitigate: keep domain tables primary; new tables are registry)
- Privacy (mitigate: RLS per domain, no cross-domain queries)
- Calculation edge cases (mitigate: single precision `numeric(20,6)`, validate per `value_kind`)

### Acceptance Criteria
- [ ] `/results` loads, create metric, add entries, view history on 390×844
- [ ] Composite FK blocks cross-user entry insertion
- [ ] Archive hides from list but preserves history; new entries blocked
- [ ] Delete definition cascades entries; no soft-delete on entries
- [ ] All existing tests pass; network audit unchanged
- [ ] No unsafe language in UI ("improving", "you should", "AI insight")

### Rollback
- Drop `metric_entries`, `metric_definitions` (no data migration)
- Feature flag: `NEXT_PUBLIC_RESULTS_SYSTEM=false`

---

## Phase 2 — Finance v2 Accounts & Transactions
**Complexity**: Large
**Dependencies**: Phase 1 tables exist (for Results adapter)
**Primary Value**: Real-life multi-account, multi-currency, recurring, transfers

### Scope
- New tables: `finance_income_sources`, `finance_merchants`, `finance_recurring_rules`, `finance_reporting_currency`, `account_balances_snapshot`
- Extended `finance_transactions`: `transaction_type`, `original_amount`, `original_currency`, `conversion_rate`, `source_id`, `merchant_id`, `is_business`, `linked_project_id`, `recurring_group_id`, `transfer_pair_id`
- UI: Transfers (two-row creator), Recurring Rules ("Generate Now"), Reporting Currency selector
- Views: Transfers, Recurring Costs, Currency Exposure, Personal/Business split
- Results adapter: Finance → `metric_entries` (Net Worth, Savings Rate, Cash Flow)

### Files/Tables
- `supabase/migrations/XXX_finance_v2.sql`
- `src/components/finance/TransferDialog.tsx`, `RecurringRules.tsx`, `CurrencySelector.tsx`
- `src/components/finance/Views/` (CurrencyExposure, PersonalBusinessSplit, RecurringCosts)
- `src/lib/results/adapters/finance.ts`

### Risks
- Double-counting transfers (mitigate: `transaction_type='transfer'` excluded from income/expense)
- Silent conversion (mitigate: original always visible, rate stored per-transaction)
- Floating point (mitigate: `numeric(12,2)` everywhere)

### Acceptance Criteria
- [ ] Transfer creates two linked rows, excluded from income/expense totals
- [ ] Reporting currency shows `≈ $X` alongside original
- [ ] Recurring rule generates transaction, updates next date
- [ ] Account balance shows original + converted + "rate missing" badge
- [ ] All existing Finance tests pass; network audit ≤ 5 REST

### Rollback
- New columns nullable; ignore in UI
- Drop new tables
- Feature flag: `NEXT_PUBLIC_FINANCE_V2=false`

---

## Phase 3 — Charts, Templates & Domain Integration
**Complexity**: Medium
**Dependencies**: Phase 1 + 2
**Primary Value**: Visible trends, templates, cross-domain connections

### Scope
- Charts: Result trend sparklines (unified), Finance currency exposure, Personal/Business split
- Templates: Pre-defined `metric_definitions` (Body, Mind, Finance, Passions)
- Goals/Projects: Link `metric_targets`, show progress from entries
- Weekly Review: "What changed this week" includes result deltas
- Insights: Target progress cards, milestone timeline

### Files/Tables
- `src/components/charts/ResultTrendSparkline.tsx`
- `src/components/charts/FinanceCurrencyExposure.tsx`
- `src/app/weekly-review/ResultsComparison.tsx`
- `src/app/insights/TargetProgressCard.tsx`
- `src/lib/results/templates.ts` (system templates)

### Risks
- Chart library bundle size (mitigate: lightweight SVG or existing chart components)
- Template seeding per-user (mitigate: insert on first Results visit)

### Acceptance Criteria
- [ ] Result trend sparklines render in Weekly Review & Insights
- [ ] System templates available on first metric creation
- [ ] Goal progress auto-updates from linked metric entries
- [ ] Finance charts show currency exposure, personal/business split

### Rollback
- Remove chart components
- Feature flag: `NEXT_PUBLIC_CHARTS_TEMPLATES=false`

---

## Phase 4 — Streaks & Progress Visibility
**Complexity**: Small
**Dependencies**: Phase 0 (existing `streaks.ts`)
**Primary Value**: Clear current/longest streak, completion rate, recovery

### Scope
- UI: Current streak, longest-ever streak, completion rate, best week, monthly consistency
- Recovery: Grace period visualization, "Missed 1 day — streak preserved if completed tomorrow"
- Milestones: Visual badges (not XP) for 7/30/90/365 days
- No XP redesign — keep XP meaning stable

### Files/Tables
- `src/app/habits/StreakDashboard.tsx`
- `src/components/habits/StreakBadges.tsx`
- `src/lib/streaks.ts` (add `getCompletionRate`, `getMonthlyConsistency`, `getBestWeek`)

### Risks
- XP farming (mitigate: badges only, no XP)
- Trivial habits rewarded (mitigate: badges require meaningful streak length)
- Trust in XP (mitigate: no XP changes)

### Acceptance Criteria
- [ ] Habits page shows current/longest streak, completion rate, monthly consistency
- [ ] Badge earned at 7, 30, 90, 365 days
- [ ] No changes to `xpTotals.ts`, `xp_events`, XP calculations

### Rollback
- Remove streak UI components
- Feature flag: `NEXT_PUBLIC_STREAK_VISIBILITY=false`

---

## Phase 5 — Progress Photos (Optional, Later)
**Complexity**: Medium
**Dependencies**: Phase 1 (Results system for metadata)
**Primary Value**: Visual progress over time

### Scope
- Supabase Storage bucket: `progress-photos` (private)
- RLS: user-scoped paths, signed URLs
- Metadata: date, linked metric, notes, EXIF stripped
- Comparison: side-by-side slider, timeline gallery
- Export: ZIP with metadata CSV
- Deletion: cascade on account delete
- Compression: client-side resize < 2MB, WebP

### Files/Tables
- `supabase/migrations/XXX_progress_photos.sql` (storage policies)
- `src/components/photos/PhotoUploader.tsx`, `PhotoComparison.tsx`, `PhotoGallery.tsx`
- `src/lib/photos.ts` (compress, strip EXIF, signed URL)

### Risks
- Sensitive images (mitigate: warning, private bucket, no thumbnails in shared contexts)
- Storage cost (mitigate: compression, max 50 photos/user in v1)
- RLS complexity (mitigate: standard user-scoped path pattern)

### Acceptance Criteria
- [ ] Upload photo → stored in private bucket, signed URL works
- [ ] Gallery shows timeline, comparison slider works
- [ ] Export downloads ZIP with photos + metadata CSV
- [ ] Account deletion removes all photos

### Rollback
- Disable upload UI
- Storage bucket retained (user data not deleted)
- Feature flag: `NEXT_PUBLIC_PROGRESS_PHOTOS=false`

---

## Phase 6 — Improved Deterministic Coach (Structured Data)
**Complexity**: Small
**Dependencies**: Phase 1 + 3 (unified data available)
**Primary Value**: Coach uses Results + Finance v2 for sharper prompts

### Scope
- Coach rules read from `metric_entries` (via adapters)
- New rules: "Weight not recorded in 14 days", "Savings rate below target", "Practice time declining"
- Response format: `AssistantResponse` (prepares for Phase 7)
- Still deterministic, no AI

### Files/Tables
- `src/lib/coach.ts` (refactor to use adapters)
- `src/app/coach/CoachContent.tsx` (render `AssistantResponse`)

### Risks
- Prompt overload (mitigate: priority scoring, max 3 visible)
- False precision (mitigate: "Data insufficient" when entries < 4)

### Acceptance Criteria
- [ ] Coach shows result-based prompts (weight, savings, practice)
- [ ] Response uses `AssistantResponse` structure
- [ ] All existing Coach tests pass

### Rollback
- Revert to Phase 0 coach logic
- Feature flag: `NEXT_PUBLIC_COACH_STRUCTURED=false`

---

## Phase 7 — Life Pulse Assistant (Permission-Controlled AI)
**Complexity**: Very Large
**Dependencies**: Phase 6 (AssistantResponse structure), Phase 4 (permission model)
**Primary Value**: Optional intelligence layer with user-controlled data access

### Scope
- Permission model: per-domain grants, audit log, revocable
- Provider abstraction: deterministic fallback → LLM (single provider v1)
- Prompt injection protection: structured observations only
- Conversation retention, deletion, export
- Cost controls: token budgets, daily limits
- Safety: no advice, no causation, no shaming

### Files/Tables
- `supabase/migrations/XXX_assistant_permissions.sql`, `assistant_conversations.sql`
- `src/lib/assistant/providers.ts`, `permissions.ts`, `conversation.ts`
- `src/app/assistant/` (chat UI, permission gate, response renderer)
- `src/components/assistant/AssistantChat.tsx`, `PermissionPanel.tsx`

### Risks
- Prompt injection (mitigate: structured observations, no raw PII to model)
- Hallucination/advice (mitigate: deterministic fallback, safety tests)
- Cost (mitigate: token budgets, daily limits, provider abstraction for local models)
- Privacy (mitigate: per-domain consent, audit log, GDPR export)

### Acceptance Criteria
- [ ] Settings → Assistant: grant/revoke per domain, retention, audit log
- [ ] Chat UI renders `AssistantResponse` (observations, dataUsed, interpretations, actions, disclaimers)
- [ ] Deterministic fallback works without LLM
- [ ] LLM integration (if enabled) passes safety tests
- [ ] Conversation delete + export works
- [ ] All existing tests pass

### Rollback
- Disable Assistant page
- Deterministic Coach remains
- Feature flag: `NEXT_PUBLIC_ASSISTANT=false`

---

## Summary Table

| Phase | Complexity | Key Value | Gate |
|-------|------------|-----------|------|
| 0 | — | Beta stability | P0/P1 = 0 |
| 1 | Medium | Results foundation | 0 passed |
| 2 | Large | Finance v2 | 1 tables exist |
| 3 | Medium | Charts + templates | 1+2 |
| 4 | Small | Streak visibility | 0 |
| 5 | Medium | Progress photos | 1 |
| 6 | Small | Structured Coach | 1+3 |
| 7 | Very Large | AI Assistant | 6+4 |

---

## Testing Requirements Per Phase

| Phase | Unit | Integration | E2E | Prod Smoke |
|-------|------|-------------|-----|------------|
| 1 | Adapters, streak fns | Weekly Review results section | Create metric → see in Review | `test:prod:weekly-insights` |
| 2 | Finance utils | Transfer dialog, recurring gen | Add account → transfer → recurring | `test:prod:finance` |
| 3 | Chart components | Goal progress, result trends | Create goal → link metric → see progress | `test:prod:goals`, `weekly-insights` |
| 4 | Streak fns | Habits streak dashboard | Complete habit → see badge | `test:prod:habits` |
| 5 | Photo utils | Upload → gallery → compare | Upload 2 photos → compare | New: `test:prod:photos` |
| 6 | Coach rules | Coach prompts from results | Log weight → see prompt | `test:prod:coach` |
| 7 | Permissions, provider | Chat flow, retention | Grant finance → ask → see obs | New: `test:prod:assistant` |

---

## Rollback Strategy (All Phases)
1. **Feature flags** for every phase (`NEXT_PUBLIC_<PHASE>=false`)
2. **No destructive migrations** — new tables only, nullable columns
3. **Adapter pattern** — legacy tables untouched
4. **Prod smoke tests** run after deploy; auto-revert if critical suite fails
5. **Founder notification** for any P0 regression

---

## Highest-Risk Areas Requiring Stronger Model Review

| Area | Why | Review Focus |
|------|-----|--------------|
| Phase 2: Finance multi-currency | Floating point, conversion, double-counting | Numeric types, rate storage, transfer exclusion, authoritative snapshot |
| Phase 7: AI Assistant safety | Prompt injection, advice, hallucination, cost | Structured observations, deterministic fallback, token budgets, forbidden phrases |
| Phase 1: Results adapters | Privacy, performance, domain meaning | RLS per domain, memoization, no cross-domain queries |
| Phase 5: Progress photos | Sensitive content, storage, RLS | Private bucket, signed URLs, EXIF stripping, account delete cascade |
| Phase 4: Streak badges | XP meaning trust, trivial habit reward | No XP changes, meaningful thresholds, visual-only rewards |

---

## Deferred (Post-Phase 7)
- Duolingo-style leagues / social (explicitly rejected for Round 1)
- 2FA/MFA (after password reset stability)
- External FX rate provider (with audit trail)
- Device sync (Apple Health, Google Fit)
- Shared accountability / family view
- Tax-ready reports (Schedule C, etc.)
- Investment portfolio tracking