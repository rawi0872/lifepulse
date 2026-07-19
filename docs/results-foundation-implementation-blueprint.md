# Results Foundation Implementation Blueprint

## Repository Findings

### 1. Latest Migration Number
**00017_xp_totals_rpc.sql** — exact XP totals RPC (`get_xp_totals(timestamptz)`) for authenticated user.

### 2. Existing Tables Overlapping with Results

| Domain | Table | Measurement Type | Key Fields |
|--------|-------|------------------|------------|
| Body | `body_measurements` | Weight, body fat %, circumferences | `weight_kg`, `body_fat_percent`, `waist_cm`, `chest_cm`, `arms_cm`, `legs_cm`, `measurement_date` |
| Body | `body_metrics` | Daily signals | `weight_kg`, `sleep_hours`, `energy`, `steps`, `workout_minutes`, `resting_heart_rate`, `recovery_score` |
| Body | `body_profiles` | Static context | `height_cm`, `target_weight_kg`, `activity_level` |
| Mind | `mind_metrics` | Daily ratings | `mood`, `stress`, `focus`, `clarity`, `motivation` (1–5), `reflection`, `tags` |
| Finance | `finance_transactions` | Money | `amount` (numeric 12,2), `currency` (ISO-3), `type` (income/expense), `transaction_date` |
| Passions | `passion_sessions` | Time | `duration_minutes`, `focus`, `enjoyment`, `difficulty`, `session_date` |
| Passions | `passion_milestones` | Achievements | `title`, `description`, `target_date`, `completed_at` |
| Goals | `goals` + `goal_milestones` | Outcomes | `target_date`, `completed_at`, linked tasks/habits/projects |
| XP | `xp_events` | Gamification | `amount`, `source_type`, `source_id`, `created_at` |

### 3. Existing Data That Must Remain Primary
- All domain tables above — **no data migration** in Phase 1
- `body_measurements`, `body_metrics`, `mind_metrics`, `finance_transactions`, `passion_sessions`, `passion_milestones`, `goals`, `goal_milestones`, `xp_events`
- RLS policies on all tables must remain unchanged
- XP totals RPC (`get_xp_totals`) must continue working

### 4. Existing Components & Utilities Reusable
- **PulseCard** (`src/components/ui/pulse-card.tsx`) — consistent card wrapper with accent colors
- **MetricCard** (`src/components/ui/metric-card.tsx`) — single-value display with trend
- **SectionHeader** (`src/components/ui/section-header.tsx`) — section labels with optional action links
- **EmptyState** (`src/components/ui/empty-state.tsx`) — sparse state pattern
- **Streak functions** (`src/lib/streaks.ts`) — pure `getCurrentStreak`, `getBestStreak`, `getWeeklyProgress`
- **Metric summaries** (`src/lib/metricSummaries.ts`) — `avg`, `trend`, `loggedToday`, `getToday`, `scoreLabel`
- **Body metrics types** (`src/lib/bodyMetrics.ts`) — `BodyMetrics`, `BodyMetricsFormData`, `avgRecent`, `getTodayDate`
- **BodyPro types** (`src/lib/bodyPro.ts`) — `BodyMeasurement`, `NutritionLog`, `Workout`, `MeasurementFormData`
- **Finance types** (`src/components/finance/types.ts` inferred from usage) — `FinanceTransaction`, `FinanceAccount`
- **Supabase client pattern** (`src/lib/supabase/client.ts` / `server.ts`) — `createBrowserClient`, `createServerClient`
- **Date utilities** (`src/lib/utils.ts`) — `getTodayDateString`, `getWeekStartDate`, `getTodayStartISO`
- **Module registry** (`src/lib/modules.ts`) — `MODULE_REGISTRY`, `getRecommendedModules`, status enum (`available`/`preview`/`planned`)
- **Chart components** — existing lightweight SVG-based cards (no chart library yet)

### 5. Navigation Group Where Results Would Fit
In `MODULE_REGISTRY` (`src/lib/modules.ts`):
- **Category: "core"** — Today, Tasks, Habits, Journal, Goals, Projects, Insights, Settings
- **Category: "personal"** — Body, Mind, Finance, Knowledge, Passions
- **Category: "ai"** — Coach (preview), Weekly Review (preview)

**Recommendation**: Add `results` module to **"personal"** category with status `"preview"` (since it unifies data from Body, Mind, Finance, Passions). This keeps it discoverable but clearly optional.

### 6. Existing Test Patterns
- **Production smoke tests** (`scripts/*.mjs`) — Playwright-based, headless, read-only
  - `test:prod:today`, `test:prod:weekly-insights`, `test:prod:coach`, `test:prod:journal`, `test:prod:navigation`, `test:prod:mobile-tablet`, `test:prod:body-profile`, `test:prod:finance`, `test:prod:settings-modules`
- **RLS test** (`scripts/rls-smoke-test.mjs`) — verifies ownership policies
- **Network audit** (`scripts/prod-route-network-audit.mjs`) — counts REST/RPC calls
- Pattern: read-only, no data mutation, bounded queries, explicit assertions

### 7. Backward-Compatibility Risks
| Risk | Mitigation |
|------|------------|
| New unified table breaks domain meaning | Keep domain tables primary; new `metric_entries` is a *registry* with adapters |
| Finance + Body in same table → privacy leak | RLS per `domain`; separate policies; no cross-domain queries without explicit consent |
| Calculation edge cases (currency, units) | Store original unit/currency; convert on read with explicit rate |
| Breaking existing streak/XP logic | Do not change `streaks.ts`, `xpTotals.ts`, `habit_logs` |

### 8. RLS and Ownership Risks
- New tables need `user_id` + `auth.uid()` policies matching existing pattern
- `metric_entries` references `metric_definitions` → cascade delete on definition
- Cross-table ownership: `metric_entries.definition_id` → `metric_definitions.id` (user_id on both sides)
- Helper functions for FK ownership checks (see `finance_account_belongs_to_user` pattern)

### 9. Numeric Precision Risks
- `numeric(12,2)` for currency (Finance V2 standard)
- `numeric(10,2)` or `numeric(8,2)` for general measurements
- `numeric(6,2)` for percentages (0.00–100.00)
- `integer` for counts (reps, steps, minutes)
- `interval` or `integer` (minutes) for durations
- **Never** `float`/`real`/`double precision` for stored measurements
- No NaN/Infinity in UI — validate on write, default null on read

### 10. Query and Performance Risks
- Adapters read from multiple domain tables → bounded date windows (last 30/90 days)
- Memoize adapter results per request (`React.useMemo` or server-side cache)
- No unbounded `select *` — explicit column lists
- Index on `metric_entries(user_id, entry_date)`, `metric_definitions(user_id, domain)`

### 11. Mobile-Layout Risks
- 390×844 viewport must show: header, 3-step path, metric list, add-entry form
- Tap targets ≥ 44×44 CSS px
- No horizontal overflow on any route
- Forms use native inputs with custom styling (no custom spinner buttons on number inputs)

### 12. Exact Files a Future Implementation Would Likely Touch
| Area | Files |
|------|-------|
| Schema | New migration `0018_results_foundation.sql` (or next number) |
| Types | `src/lib/results/types.ts` (new) |
| Adapters | `src/lib/results/adapters.ts` (new) |
| Hooks | `src/lib/results/hooks.ts` (new) |
| Templates | `src/lib/results/templates.ts` (new, system templates) |
| UI — /results page | `src/app/results/page.tsx` (new) |
| UI — Metric list | `src/components/results/MetricList.tsx` (new) |
| UI — Metric detail | `src/components/results/MetricDetail.tsx` (new) |
| UI — Entry form | `src/components/results/EntryForm.tsx` (new) |
| UI — History list | `src/components/results/HistoryList.tsx` (new) |
| UI — Simple chart | `src/components/results/TrendSparkline.tsx` (new) |
| Weekly Review | `src/app/weekly-review/ResultsSection.tsx` (new) |
| Insights | `src/app/insights/ResultTrendsCard.tsx` (new) |
| Goals | `src/app/goals/GoalProgress.tsx` (new/modify) |
| Coach | `src/lib/coach.ts` (extend `CoachData` + rules) |
| Navigation | `src/lib/modules.ts` (add `results` module) |
| Tests | `scripts/test:prod:results.mjs` (new), adapter unit tests |

---

## Minimal Schema Blueprint (Phase 1)

### Final Decision: Two Tables Only
**Tables**: `metric_definitions`, `metric_entries`

> **No `metric_targets` table in Phase 1** — baseline and optional target live on `metric_definitions`.
> **No `result_milestones` in Phase 1** — defer to Phase 3.
> **No system templates in database** — templates are static TypeScript config in `src/lib/results/templates.ts`.

---

### `metric_definitions` — What Can Be Measured

| Column | PostgreSQL Type | Nullable | Default | Constraint | Reason |
|--------|----------------|----------|---------|------------|--------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique identifier |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE | Ownership |
| `domain` | `text` | NO | — | CHECK IN ('body','mind','finance','business','learning','skills','passions','goals','custom') | Domain grouping for RLS & UI |
| `name` | `text` | NO | — | `length(trim(name)) BETWEEN 1 AND 80` | Display name |
| `description` | `text` | YES | — | — | Optional context |
| `value_kind` | `text` | NO | — | CHECK IN ('number','count','percentage','duration','currency','rating') | Determines validation/formatting |
| `unit` | `text` | NO | — | — | Display unit (e.g., 'kg', 'min', 'USD', '%', 'reps', 'score', 'BPM', 'points', 'ILS') |
| `baseline_value` | `numeric(20,6)` | YES | — | — | Optional starting point |
| `target_value` | `numeric(20,6)` | YES | — | — | Optional desired outcome |
| `target_direction` | `text` | YES | — | CHECK IN ('increase','decrease','maintain','none') | Controls target context; 'none' = no target |
| `cadence` | `text` | YES | — | CHECK IN ('daily','weekly','monthly','quarterly','yearly','custom','none') | Suggested recording cadence |
| `archived` | `boolean` | NO | `false` | — | Soft archive; excludes from default list view |
| `created_at` | `timestamptz` | NO | `now()` | — | Audit |
| `updated_at` | `timestamptz` | NO | `now()` | — | Audit |
| **Unique** | `(user_id, domain, name)` | — | — | — | One definition per name per domain per user |

> **System templates** are static TypeScript config in `src/lib/results/templates.ts`, not database records.

---

### `metric_entries` — Recorded Measurements

| Column | PostgreSQL Type | Nullable | Default | Constraint | Reason |
|--------|----------------|----------|---------|------------|--------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique identifier |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE | Ownership (denormalized for RLS) |
| `metric_definition_id` | `uuid` | NO | — | FK → `metric_definitions(id)` ON DELETE CASCADE | Links to definition |
| `value` | `numeric(20,6)` | NO | — | — | Stored in definition's unit |
| `recorded_at` | `timestamptz` | NO | `now()` | — | Measurement timestamp (date + time) |
| `notes` | `text` | YES | — | — | Optional context |
| `created_at` | `timestamptz` | NO | `now()` | — | Audit |
| **Composite FK** | `(metric_definition_id, user_id)` | — | — | FK → `metric_definitions(id, user_id)` ON DELETE CASCADE | Prevents cross-user entry insertion |

**Indexes**:
- `idx_metric_entries_user_recorded` ON `(user_id, recorded_at DESC)`
- `idx_metric_entries_definition` ON `(metric_definition_id)`

---

### Target and Baseline Handling (on `metric_definitions`)
- `baseline_value` + `target_value` + `target_direction` live on the definition row
- `target_direction` values: `'increase'` (higher = progress), `'decrease'` (lower = progress), `'maintain'` (stay near target), `'none'` (no target)
- No separate `metric_targets` table in Phase 1
- When `target_value` is null or `target_direction = 'none'`, target logic is disabled

---

## Ownership and RLS Blueprint

### Should `metric_entries` Contain `user_id` Directly?
**Yes.** Denormalized `user_id` on `metric_entries` enables:
- Simple RLS: `auth.uid() = user_id` on all operations
- Efficient queries without joining `metric_definitions` for ownership
- Matches existing pattern (`finance_transactions`, `body_metrics`, `mind_metrics`, `habit_logs`, `journal_entries`)

### How Should Metric Ownership Be Verified?
- `metric_definitions`: `auth.uid() = user_id`
- `metric_entries`: `auth.uid() = user_id` (denormalized) — **also** FK `(metric_definition_id, user_id)` → `metric_definitions(id, user_id)` ON DELETE CASCADE ensures definition belongs to same user
- No separate helper function needed — composite FK + cascade is sufficient

### How Should Cross-User Metric-Entry Insertion Be Blocked?
- RLS on `metric_entries`: `auth.uid() = user_id` (denormalized)
- Composite FK `(metric_definition_id, user_id)` → `metric_definitions(id, user_id)` ON DELETE CASCADE ensures definition belongs to same user
- No separate helper function needed — composite FK + cascade is sufficient

### Which Indexes Are Needed?
```sql
CREATE INDEX idx_metric_definitions_user_domain ON metric_definitions(user_id, domain);
CREATE INDEX idx_metric_entries_user_recorded ON metric_entries(user_id, recorded_at DESC);
CREATE INDEX idx_metric_entries_definition ON metric_entries(metric_definition_id);
```

### Which Foreign Keys and Composite Constraints?
- `metric_definitions.user_id` → `auth.users(id)` ON DELETE CASCADE
- `metric_entries.user_id` → `auth.users(id)` ON DELETE CASCADE
- `metric_entries.metric_definition_id` → `metric_definitions(id)` ON DELETE CASCADE
- **Composite FK**: `metric_entries(metric_definition_id, user_id)` → `metric_definitions(id, user_id)` ON DELETE CASCADE
- **Unique**: `(user_id, domain, name)` on `metric_definitions`

### RLS Rules (Plain English + Pseudocode)

**`metric_definitions`**:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`
- No system templates in DB (templates are static TS config)

**`metric_entries`**:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id` AND `metric_definition_id` references a definition owned by user (enforced by composite FK)
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

### Archived Metrics Behavior
- `archived = true` on definitions: excluded from default queries (`WHERE archived = false`); history preserved
- No soft-delete on entries — hard delete only (user action)
- Archived definitions cannot accept new entries (application enforces)

### Cascading Deletion Behavior
- Delete `metric_definition` → cascade deletes `metric_entries` (ON DELETE CASCADE)
- Delete `user` → cascade deletes all three tables (ON DELETE CASCADE on `user_id`)

---

## Number and Unit Model

### Supported Value Kinds

| Kind | PostgreSQL Type | Example Units | Precision Rules |
|------|----------------|---------------|-----------------|
| **number** | `numeric(20,6)` | kg, cm, L, units | Up to 6 decimal places |
| **count** | `integer` | reps, pieces, sessions | Whole numbers only |
| **percentage** | `numeric(6,2)` | % | 0.00–100.00, 2 decimals |
| **duration** | `integer` (minutes) | min, h | Store minutes; display h:mm |
| **currency** | `numeric(20,6)` | USD, ILS, EUR | 6 decimals for precision; ISO-3 code in unit |
| **rating** | `integer` | 1-5, 1-10, score | Whole numbers, bounded |

### PostgreSQL Numeric Precision for Stored Values
- **General precision**: `numeric(20,6)` — supports currency (up to 6 decimals for crypto/fx), precise measurements, and large values
- **Percentages**: `numeric(6,2)` — 0.00 to 100.00
- **Counts**: `integer` — reps, steps, pieces
- **Durations**: `integer` (minutes) — 30, 45, 90, 120
- **Ratings**: `integer` — 1–5, 1–10

### Currency Rules
- Each currency metric has **one** currency unit (from `definition.unit` = 'USD'/'ILS'/'EUR'/etc.)
- USD and ILS values **must not be combined** in aggregates
- No FX service in Phase 1
- No automatic conversion — user enters rate manually if needed
- Store `original_value` + `original_unit` + `conversion_rate` if user converts
- Display: `original_value original_unit (≈ converted_value reporting_unit @ rate)`
- No NaN/Infinity in UI — validate on write, show "—" on read if null

### Formatting and Validation Rules Per Value Kind

| Kind | Input Validation | Display Format | Edge Cases |
|------|------------------|----------------|------------|
| number | > 0, ≤ 999999999.999999, 6 decimals | `123.456789 kg` | Zero allowed for some (weight > 0) |
| count | integer ≥ 0 | `42 reps` | Zero valid |
| percentage | 0–100, 2 decimals | `12.50%` | Previous value = 0 → "Percentage unavailable" |
| duration | integer minutes ≥ 0 | `1h 30m` or `90 min` | Zero = "Not recorded" |
| currency | > 0, 6 decimals, ISO-3 unit | `$1,234.567890` or `₪4,500.000000` | No conversion; show original always |
| rating | integer within bounds (1–5 or 1–10) | `4/5` or `7/10` | — |

---

## Calculation Contract

### Chronological Sorting
- Entries sorted by `recorded_at` ASC, then `created_at` ASC for same-timestamp ties
- Adapters must preserve this order

### Latest Entry
- Most recent `recorded_at` (DESC), then latest `created_at` for ties
- Return `null` if no entries

### Previous Entry
- Entry immediately before latest by `recorded_at` (DESC)
- If multiple entries same timestamp, use `created_at` DESC, skip the latest
- Return `null` if only one entry exists

### Absolute Change
```
latest.value - previous.value
```
- Return `null` if either is null

### Percentage Change
```
((latest - previous) / |previous|) * 100
```
- **Previous value = 0**: return `null` with reason "Percentage unavailable because previous value was zero"
- **Previous value = null**: return `null` with reason "Insufficient data for percentage change"
- Round to 2 decimal places

### Baseline Change
```
latest.value - definition.baseline_value
```
- Null if baseline not set

### Target Distance
| Target Direction | Formula |
|-----------------|---------|
| increase | `target_value - latest.value` (positive = above target) |
| decrease | `latest.value - target_value` (positive = below target) |
| maintain | `ABS(latest.value - target_value)` |
| none | null (no target logic) |

### One-Entry History
- Latest = that entry
- Previous = null
- Absolute/percentage change = null with reason "Only one entry recorded"
- Baseline change = computed if baseline exists
- Target distance = computed if target exists

### No Entries
- All calculations return `null` with reason "No entries recorded"

### Duplicate Timestamps
- Multiple entries same timestamp allowed (different `created_at`)
- Latest = most recent `created_at` on that timestamp
- Previous = next most recent `created_at` on that timestamp, or previous timestamp

### Deleted Entries
- Hard delete → removed from all calculations
- No soft-delete in Phase 1

### Archived Metrics
- Archived definitions (`archived = true`): exclude from default queries, keep history
- Archived definitions cannot accept new entries (application enforces)

### Target Direction Semantics
| Direction | "Better" Means |
|-----------|----------------|
| increase | Higher value = progress (e.g., bench press, savings) |
| decrease | Lower value = progress (e.g., weight, body fat, debt) |
| maintain | Value within ±5% of target = progress (e.g., weight maintenance) |
| none | No target logic |

**Do not assume higher is always better.** Each metric definition declares its `target_direction`.

---

## User Experience Blueprint — `/results` (Phone-First, 390×844)

### 1. Results Header
```
┌─────────────────────────────────────┐
│ Results                     [+]     │
├─────────────────────────────────────┤
│ Actions move you forward.           │
│ Results show where you actually are.│
│ Private. Manual. No AI.             │
└─────────────────────────────────────┘
```

### 2. Actions vs Outcomes Explanation (Collapsible)
> "You complete tasks, habits, and check-ins. Results are the measurable outcomes — weight, savings, practice time, mood average. They don't always move together. This page tracks outcomes only."

### 3. Create Metric Form (Inline, Expandable)
```
┌─────────────────────────────────────┐
│ Create your first metric            │
├─────────────────────────────────────┤
│ Name: [____________________]        │
│ Domain: [Body ▼]  Type: [Number ▼]  │
│ Unit: [kg ▼]   Frequency: [Weekly]  │
│ Target: [Optional ▼]                │
│ [Save Metric]                       │
└─────────────────────────────────────┘
```
- Domain select: Body, Mind, Finance, Passions, Custom
- Type select filters valid units:
  - Number → kg, cm, L, units
  - Count → reps, pieces, sessions
  - Percentage → %
  - Duration → min
  - Currency → USD, ILS, EUR
  - Rating → 1-5, 1-10

### 4. Metrics Overview (List)
```
┌─────────────────────────────────────┐
│ Your Metrics                    [+] │
├─────────────────────────────────────┤
│ 📊 Weight              72.5 kg      │
│    ↓ 1.2 kg from last week          │
│    Target: ≤ 70 kg by 2026-12-31    │
│─────────────────────────────────────│
│ 📈 Bench Press 1RM     85 kg        │
│    ↑ 5 kg from last month           │
│─────────────────────────────────────│
│ 💰 Net Worth             $12,450    │
│    ↑ $320 from last month           │
│─────────────────────────────────────│
│ (empty state if no metrics)         │
└─────────────────────────────────────┘
```
- Each row: icon, name, latest value + unit, change indicator (↑/↓/→), target progress if active
- Tap → Metric Detail
- Long press / swipe → Archive/Delete

### 5. Metric Detail
```
┌─────────────────────────────────────┐
│ ← Weight                    [⋮]     │
├─────────────────────────────────────┤
│ Latest: 72.5 kg      (Today)        │
│ Previous: 73.7 kg   (6 days ago)    │
│ Changed by: ↓ 1.2 kg                │
│ Baseline: 78.0 kg  → ↓ 5.5 kg total │
│ Target: ≤ 70 kg by Dec 31           │
│    Distance: 2.5 kg to go           │
├─────────────────────────────────────┤
│ [+ Add Entry]                       │
├─────────────────────────────────────┤
│ 📈 Trend (last 8 entries)           │
│ ▄▄▄▅▄▄▅▅▅▆▆▇ (sparkline)            │
│ Based on manually recorded results. │
│ Correlation ≠ causation.            │
├─────────────────────────────────────┤
│ History                             │
│ 72.5 kg  Today                      │
│ 73.7 kg  6 days ago                 │
│ 74.1 kg  13 days ago                │
│ ...                                 │
└─────────────────────────────────────┘
```
- Header: metric name, domain badge, archive/delete in menu
- Key stats: latest, previous, change, baseline delta, target distance
- Add entry button prominent
- Simple SVG sparkline (no library)
- History list reverse-chronological

### 6. Add Entry Form
```
┌─────────────────────────────────────┐
│ Add Weight Entry                    │
├─────────────────────────────────────┤
│ Value: [72.5] kg                    │
│ Date: [Today ▼]                     │
│ Notes: [____________________]       │
│ Confidence: [Measured ▼]            │
│ Source: [Manual ▼]                  │
│ [Save Entry]                        │
└─────────────────────────────────────┘
```
- Value input: numeric, step per unit (0.1 for kg, 1 for count)
- Date defaults to today, picker available
- Confidence: Measured / Estimated / Self-reported
- Source: Manual / Calculated / Imported / Device

### 7. History List
- Reverse chronological
- Each row: date, value, optional note indicator
- Swipe/tap to edit/delete

### 8. Simple Chart (Trend Sparkline)
- Inline SVG, 200×60 px
- Points: last N entries (max 30)
- X: time (even spacing), Y: value (min/max bounds)
- No axes, no grid — just the line
- Tooltip on tap: date + value
- "Based on manually recorded results. Correlation ≠ causation."

### 9. Archive Flow
- Metric menu → Archive
- Confirmation: "Archived metrics hide from overview but keep all history. Restore anytime from Archived tab."
- Archived tab in overview (collapsible)

### 10. Delete Confirmation
- Two-step: Menu → Delete → Confirm dialog
- "Delete this metric and all its entries? This cannot be undone."
- No cascade to other domains

### 11. Empty States
**No metrics yet**:
> "No metrics yet. Create one to start tracking measurable outcomes — weight, savings, practice time, or anything that matters to you."
> [Create Your First Metric]

**Metric has no entries**:
> "No entries for Weight yet. Tap + to record your first measurement."

### 12. Error States
- Network error: "Couldn't load metrics. Check connection and retry."
- Save failed: "Couldn't save entry. Try again."
- Validation: "Value must be positive" / "Date cannot be in future"

### 13. Loading States
- Skeleton cards for metric list (PulseCard animate-pulse)
- Skeleton for detail stats
- No blank screens

### Safe Copy (Exact Labels)
- "Latest recorded value"
- "Previous recorded value"
- "Changed by"
- "Based on manually recorded results"
- "More entries are needed for a trend"
- "Percentage unavailable because the previous value was zero"
- "No currency conversion is applied"
- "Correlation ≠ causation. Insufficient data for conclusions."
- "Private. Manual. No AI summaries or external processing."

### Avoid
- "improving", "getting worse", "good result", "bad result"
- "success score", "failure", "you should"
- "AI insight", "diagnosis", "therapy"
- "prediction", "forecast", "optimized"

---

## Integration Boundaries — Phase 1 Only

### Include
- Manual metric definitions (create/read/update/archive)
- Manual entries (create/read/update/delete)
- Factual comparisons (latest vs previous, vs baseline, vs target)
- Basic history list
- One simple SVG sparkline per metric
- Navigation access (add `results` module to `MODULE_REGISTRY` in "personal" category, status "preview")

### Explicitly Defer
- Weekly Review aggregation → Phase 3
- Insights aggregation → Phase 3
- Goals/Projects linking → Phase 3
- Body adapters (`body_metrics`/`body_measurements` → `metric_entries`) → not in Phase 1
- Mind adapters → Phase 3
- Finance adapters (Net Worth, Savings Rate, Cash Flow) → Phase 2 (Finance V2)
- Passions adapters → Phase 3
- Automatic metrics → Never (manual-first)
- Progress photos → Phase 5
- AI/Nextron/Assistant → Phase 7
- Reminders/notifications → Never
- XP rewards → Never
- Streak integration → Phase 4 (separate)
- Currency conversion → Phase 2 (Finance V2)
- Derived metrics (BMI, etc.) → Not in scope

### Optional Integration That Appears Tempting But Must Remain Deferred
- **Body → Results auto-sync**: "When I log weight in Body, create metric entry" — creates hidden writes, breaks manual-first principle
- **Goal progress from metrics**: Requires target linking logic — Phase 3
- **Coach rules from results**: "Weight not logged in 14 days" — Phase 6
- **Finance net worth as metric**: Requires Finance V2 multi-currency balance RPC — Phase 2

---

## Test Plan

### Database Contract
| Test | Description |
|------|-------------|
| Ownership | `metric_definitions` INSERT with another user's `user_id` fails |
| Cross-user denial | `metric_entries` INSERT with `metric_definition_id` owned by another user fails |
| Invalid values | `value` = negative for weight fails CHECK; `percentage` > 100 fails |
| Invalid enum | `value_kind` = 'invalid' fails CHECK |
| Invalid FK | `metric_definition_id` not in `metric_definitions` fails FK |
| Composite FK | `metric_entries` INSERT with valid `metric_definition_id` but different `user_id` fails composite FK |
| Archived metrics | `metric_definitions` with `archived=true` excluded from default SELECT |
| Deletion behavior | DELETE `metric_definition` cascades to `metric_entries` |
| Archive blocks entries | INSERT `metric_entries` for archived definition fails (CHECK or trigger) |

### Calculation Utilities (Pure Functions)
| Test | Input | Expected |
|------|-------|----------|
| Latest + previous | `[{recorded_at:'2026-01-10T10:00',v:72},{recorded_at:'2026-01-05T09:00',v:73.7}]` | latest=72, prev=73.7 |
| Chronological order | Mixed timestamps | Sorted by `recorded_at` ASC, `created_at` ASC |
| One entry | `[{v:72}]` | latest=72, prev=null |
| Zero previous value | latest=5, previous=0 | pct_change=null, reason="Previous value was zero" |
| Positive change | latest=80, prev=75 | abs=5, pct=+6.67% |
| Negative change | latest=70, prev=75 | abs=-5, pct=-6.67% |
| Baseline change | latest=72, baseline=78 | -6 |
| Target distance (decrease) | latest=72, target=70 (decrease) | distance=2 |
| Target distance (increase) | latest=85, target=90 (increase) | distance=5 |
| Target distance (maintain range) | latest=72, range 70-75 | distance=0 |
| Null safety | Any null input | Returns null + reason string |
| Duplicate timestamps | Two entries same timestamp, diff created_at | Latest = max created_at |

### UI Tests
| Test | Description |
|------|-------------|
| Creation form | Fill all fields → metric appears in overview |
| Entry form | Valid value + timestamp → appears in history |
| Sparse states | No metrics → empty state with CTA; metric with no entries → empty state with CTA |
| Archive | Archive metric → moves to Archived section, hidden from main list |
| Deletion | Delete metric → confirmation → metric + entries gone |
| Chart state | ≥2 entries → sparkline renders; 1 entry → "More entries needed"; 0 → "No entries" |
| Phone overflow | 390px width → no horizontal scroll on any results route |
| Protected route | Unauthenticated → redirect to /login |
| Navigation | `results` module appears in More sheet (personal category) |
| No unsafe language | Scan rendered text for forbidden phrases |

### Regression Suite (Existing Features Must Not Break)
- Today (`test:prod:today`)
- Tasks (`test:prod:tasks`)
- Habits (`test:prod:habits`)
- Journal (`test:prod:journal`)
- Weekly Review (`test:prod:weekly-insights`)
- Insights (`test:prod:insights` — check no new network calls)
- Finance (`test:prod:finance`)
- Body (`test:prod:body-profile`)
- Navigation (`test:prod:navigation`)
- Mobile/Tablet (`test:prod:mobile-tablet`)
- Network audit (`test:prod:network-audit`) — no unbounded reads
- Settings modules (`test:prod:settings-modules`)

### Likely Test Files/Scripts
- `src/lib/results/__tests__/adapters.test.ts`
- `src/lib/results/__tests__/calculations.test.ts`
- `src/lib/results/__tests__/types.test.ts`
- `scripts/test-prod-results.mjs` (new)
- `scripts/test-prod-results-weekly.mjs` (new, for Weekly Review integration)

---

## Deployment Plan

### Exact Safe Implementation Sequence

1. **Strong-model implementation review**
   - Another model reviews this blueprint + writes migration + adapters + types
   - Verify no schema conflicts, correct RLS, correct numeric types
   - Verify adapters are read-only, memoized, bounded

2. **Migration creation** (by stronger model)
   - `supabase/migrations/0018_results_foundation.sql`
   - Tables: `metric_definitions`, `metric_entries`, `metric_targets`
   - Indexes, RLS, triggers, helper functions
   - **No data migration** — new tables only

3. **Local tests**
   - `npm run lint` / `npm run build`
   - Unit tests for adapters + calculations
   - Local dev server: create metric, add entries, verify history

4. **Manual hosted SQL application**
   - Apply migration to **staging/production Supabase** via SQL editor
   - **Do not deploy application code yet**

5. **Hosted schema verification**
   - Run `npm run test:rls` against hosted
   - Verify tables exist, RLS policies active, indexes created
   - Run manual queries: `SELECT * FROM metric_definitions LIMIT 1;`

6. **Application code commit**
   - Types, adapters, hooks, UI components, navigation registration
   - `git add` scoped files only
   - `npm run lint` / `npm run build` pass

7. **Deployment**
   - Push to origin main → Vercel deploy
   - Wait for build + deploy success

8. **Production smoke test**
   - `npm run test:prod:results` (new script)
   - `npm run test:prod:mobile-tablet`
   - `npm run test:prod:navigation`
   - Verify `/results` loads, create metric, add entry, view history

9. **Network audit**
   - `npm run test:prod:network-audit`
   - Verify `/results` uses ≤ 3 REST requests (definitions, entries, targets)

10. **Rollback Process (No Destructive Production Commands)**
    - **Feature flag**: `NEXT_PUBLIC_RESULTS_SYSTEM=false` disables `/results` route + navigation entry
    - **Code rollback**: `git revert <commit>` → redeploy
    - **Schema rollback**: Only if absolutely necessary — run `DROP TABLE IF EXISTS metric_entries, metric_targets, metric_definitions;` in Supabase SQL editor (no data loss since no user data migrated)
    - **Never** run destructive commands on production data without explicit approval

### Why Application Code Must Not Deploy Before Hosted Schema Exists
- Application code imports types and calls Supabase on new tables
- If tables don't exist: 500 errors, broken routes, failed builds
- Schema-first ensures contract validity before any client code runs
- Rollback is trivial (feature flag + code revert) if schema exists but code has bugs

---

## Documentation

### Create: `docs/results-foundation-implementation-blueprint.md`
This document.

### Update: `docs/post-beta-depth-roadmap.md`
- Mark **Prompt #32** as "implementation preparation only"
- "No production behavior changed"
- "Stronger model required before migration implementation"
- Phase 1 gate: "Stronger model review passed"

### Update: `docs/private-beta-round-1-issue-log.md`
Add row:
| ID | Date | Tester | Route | Category | Severity | Summary | Decision | Status |
|----|------|--------|-------|----------|----------|---------|----------|--------|
| R1-057 | 2026-07-19 | Internal | /results (planned) | Product depth | P2 | Results foundation implementation blueprint prepared. No product code or database behavior changed. Not a release blocker. Implementation deferred to stronger-model review. | Documented in post-beta roadmap. | Blueprint complete |

---

## Final Phase 1 Contract Decision

This section documents the exact database contract for Phase 1 Results & Measurements foundation, incorporating all founder decisions.

### 1. Two-Table Decision
**Two tables only**: `metric_definitions` + `metric_entries`. No `metric_targets`, no `result_milestones`, no template tables in Phase 1.

### 2. Final Column Model

#### `metric_definitions`
| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique identifier |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE | Ownership |
| `domain` | `text` | NO | — | CHECK IN ('body','mind','finance','business','learning','skills','passions','goals','custom') | Domain grouping for RLS & UI |
| `name` | `text` | NO | — | `length(trim(name)) BETWEEN 1 AND 80` | Display name |
| `description` | `text` | YES | — | — | Optional context |
| `value_kind` | `text` | NO | — | CHECK IN ('number','count','percentage','duration','currency','rating') | Determines validation/formatting |
| `unit` | `text` | NO | — | — | Display unit (kg, min, USD, %, reps, score, BPM, points, ILS) |
| `baseline_value` | `numeric(20,6)` | YES | — | — | Optional starting point |
| `target_value` | `numeric(20,6)` | YES | — | — | Optional desired outcome |
| `target_direction` | `text` | YES | — | CHECK IN ('increase','decrease','maintain','none') | Controls target context; 'none' = no target |
| `cadence` | `text` | YES | — | CHECK IN ('daily','weekly','monthly','quarterly','yearly','custom','none') | Suggested recording cadence |
| `archived` | `boolean` | NO | `false` | — | Soft archive; excludes from default list view |
| `created_at` | `timestamptz` | NO | `now()` | — | Audit |
| `updated_at` | `timestamptz` | NO | `now()` | — | Audit |
| **Unique** | `(user_id, domain, name)` | — | — | — | One definition per name per domain per user |

#### `metric_entries`
| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique identifier |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE | Ownership (denormalized for RLS) |
| `metric_definition_id` | `uuid` | NO | — | FK → `metric_definitions(id)` ON DELETE CASCADE | Links to definition |
| `value` | `numeric(20,6)` | NO | — | — | Stored in definition's unit |
| `recorded_at` | `timestamptz` | NO | `now()` | — | Measurement timestamp (date + time) |
| `notes` | `text` | YES | — | — | Optional context |
| `created_at` | `timestamptz` | NO | `now()` | — | Audit |
| **Composite FK** | `(metric_definition_id, user_id)` | — | — | FK → `metric_definitions(id, user_id)` ON DELETE CASCADE | Prevents cross-user entry insertion |

**Indexes**:
- `idx_metric_entries_user_recorded` ON `(user_id, recorded_at DESC)`
- `idx_metric_entries_definition` ON `(metric_definition_id)`

### 3. Numeric Precision Decision
**Single precision for all stored values**: `numeric(20,6)` on `metric_entries.value`, `metric_definitions.baseline_value`, `metric_definitions.target_value`.

- Supports all value kinds without per-type columns
- 6 decimal places covers BPM (whole), kg (0.01), currency (0.01), percentage (0.0001), count (whole)
- No `float`/`real`/`double precision` ever
- Application validates per `value_kind` (e.g., count → integer, percentage → 0–100, rating → min/max bounds)
- Currency: `unit` stores ISO-3 code (USD, ILS, EUR); no conversion in Phase 1

### 4. Ownership and RLS Decision
- **Denormalized `user_id` on `metric_entries`** + **composite FK** `(metric_definition_id, user_id)` → `metric_definitions(id, user_id)`
- RLS policies:
  - `metric_definitions`: `auth.uid() = user_id` for all operations
  - `metric_entries`: `auth.uid() = user_id` for all operations; composite FK blocks cross-user inserts
- No helper functions needed — composite FK + denormalized `user_id` is sufficient

### 5. Archive and Delete Behavior
- **Archive**: `archived` boolean on definition; `true` = hidden from default list, entries still readable, **new entries blocked** (application-level or CHECK constraint)
- **Delete**: Hard delete only. Definition delete → cascades to entries. No soft-delete on entries.
- **Cascade**: Definition delete → entries deleted. User delete → all three tables cascade.

### 6. Important Constraints
- **CHECK** on `value_kind` (6 values), `domain` (9 values), `target_direction` (4 values), `cadence` (7 values)
- **Unique** on `(user_id, domain, name)` — one definition per name per domain per user
- **Composite FK** `(metric_definition_id, user_id)` on `metric_entries` → `metric_definitions(id, user_id)` — blocks cross-user entry insertion
- **Entry ordering**: `recorded_at` ASC, then `created_at` ASC for ties
- **No duplicate prevention** on (definition, recorded_at) — multiple entries per timestamp allowed
- **Archive blocks writes**: Application enforces no new entries for archived definitions

### 7. Indexes
- `idx_metric_definitions_user_domain` ON `metric_definitions(user_id, domain)`
- `idx_metric_entries_user_recorded` ON `metric_entries(user_id, recorded_at DESC)`
- `idx_metric_entries_definition` ON `metric_entries(metric_definition_id)`

### 8. RLS Behavior
| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `metric_definitions` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `metric_entries` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |

System templates: none in DB (static TypeScript config only).

### 9. Expected Query Shapes
```sql
-- List user's active definitions
SELECT * FROM metric_definitions
WHERE user_id = auth.uid() AND archived = false
ORDER BY domain, name;

-- Get entries for a definition (latest first)
SELECT * FROM metric_entries
WHERE metric_definition_id = $1 AND user_id = auth.uid()
ORDER BY recorded_at DESC, created_at DESC
LIMIT 50;

-- Latest entry for a definition
SELECT * FROM metric_entries
WHERE metric_definition_id = $1 AND user_id = auth.uid()
ORDER BY recorded_at DESC, created_at DESC
LIMIT 1;
```

---

## Threat Review

| Scenario | Prevention Mechanism |
|----------|---------------------|
| User A selects User B's definition | RLS on `metric_definitions` requires `auth.uid() = user_id` |
| User A updates User B's definition | RLS on UPDATE requires `auth.uid() = user_id` |
| User A deletes User B's definition | RLS on DELETE requires `auth.uid() = user_id` |
| User A inserts entry under User B's definition | Composite FK `(metric_definition_id, user_id)` requires definition's `user_id` = entry's `user_id` = `auth.uid()` |
| User A changes entry.user_id | RLS on UPDATE requires `auth.uid() = user_id`; no UPDATE on `user_id` column in app |
| User A changes definition ownership | No UPDATE on `metric_definitions.user_id` in app; RLS blocks |
| User A guesses UUIDs | RLS filters by `auth.uid()` — guessing yields zero rows |
| Anonymous access | No policies for `anon` role; all tables require authenticated `auth.uid()` |
| Writes to archived definitions | Application blocks INSERT on entries for archived definitions; CHECK constraint or trigger as backup |
| Cascade deletion | `ON DELETE CASCADE` on both FKs — definition delete removes entries |
| Extreme numeric values | `numeric(20,6)` bounds; app validates per `value_kind`; CHECK constraints for percentage/rating bounds |