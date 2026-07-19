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

### Preference: Two Tables + Optional Target
**Tables**: `metric_definitions`, `metric_entries`, `metric_targets` (optional — include for Goal linking)

> **Do not include `result_milestones` in Phase 1** — defer to Phase 3.

---

### `metric_definitions` — What Can Be Measured

| Column | PostgreSQL Type | Nullable | Default | Constraint | Reason |
|--------|----------------|----------|---------|------------|--------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique identifier |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE | Ownership |
| `domain` | `text` | NO | — | CHECK IN ('body','mind','finance','passions','custom') | Domain grouping for RLS & UI |
| `name` | `text` | NO | — | `length(trim(name)) BETWEEN 1 AND 80` | Display name |
| `description` | `text` | YES | — | — | Optional context |
| `metric_type` | `text` | NO | — | CHECK IN ('numeric','duration','currency','percentage','count','rating') | Determines validation/formatting |
| `unit` | `text` | NO | — | — | Display unit (e.g., 'kg', 'min', 'USD', '%', 'reps', 'score') |
| `default_frequency` | `text` | YES | — | CHECK IN ('daily','weekly','monthly','quarterly','on_demand') | Suggested cadence |
| `is_template` | `boolean` | NO | `false` | — | System-provided vs user-created |
| `created_at` | `timestamptz` | NO | `now()` | — | Audit |
| **Unique** | `(user_id, domain, name)` | — | — | — | One definition per name per domain per user |

**System templates** (`is_template=true`, `user_id=null` or dedicated system user):
- Body: Weight (numeric, kg, weekly), Body Fat % (percentage, %, monthly), Waist (numeric, cm, monthly), Bench Press 1RM (numeric, kg, monthly), Running 5k (duration, min, weekly)
- Mind: Mood (rating, 1-5, daily), Stress (rating, 1-5, daily), Focus (rating, 1-5, daily)
- Finance: Net Worth (currency, user currency, monthly), Monthly Savings Rate (percentage, %, monthly), Investment Return (percentage, %, quarterly)
- Passions: Practice Time (duration, min, weekly), Pieces Completed (count, count, monthly), Skill Rating (rating, 1-10, quarterly)

---

### `metric_entries` — Recorded Measurements

| Column | PostgreSQL Type | Nullable | Default | Constraint | Reason |
|--------|----------------|----------|---------|------------|--------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique identifier |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE | Ownership (denormalized for RLS) |
| `definition_id` | `uuid` | NO | — | FK → `metric_definitions(id)` ON DELETE CASCADE | Links to definition |
| `value` | `numeric` | NO | — | — | Stored in definition's unit |
| `original_value` | `numeric` | YES | — | — | If converted (e.g., currency) |
| `original_unit` | `text` | YES | — | — | If different from definition |
| `conversion_rate` | `numeric` | YES | — | — | If converted |
| `entry_date` | `date` | NO | `current_date` | — | Measurement date |
| `notes` | `text` | YES | — | — | Optional context |
| `confidence` | `text` | YES | — | CHECK IN ('measured','estimated','self_reported') | Data quality |
| `source` | `text` | YES | — | CHECK IN ('manual','calculated','imported','device') | Provenance |
| `linked_goal_id` | `uuid` | YES | — | FK → `goals(id)` ON DELETE SET NULL | Goal linking |
| `linked_project_id` | `uuid` | YES | — | FK → `projects(id)` ON DELETE SET NULL | Project linking |
| `created_at` | `timestamptz` | NO | `now()` | — | Audit |
| `updated_at` | `timestamptz` | NO | `now()` | — | Audit |

**Indexes**:
- `idx_metric_entries_user_date` ON `(user_id, entry_date)`
- `idx_metric_entries_definition_id` ON `(definition_id)`

---

### `metric_targets` — Baselines and Targets (Optional for Phase 1, include for Goal linking)

| Column | PostgreSQL Type | Nullable | Default | Constraint | Reason |
|--------|----------------|----------|---------|------------|--------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK | Unique identifier |
| `user_id` | `uuid` | NO | — | FK → `auth.users(id)` ON DELETE CASCADE | Ownership |
| `definition_id` | `uuid` | NO | — | FK → `metric_definitions(id)` ON DELETE CASCADE | Links to metric |
| `baseline_value` | `numeric` | YES | — | — | Starting point |
| `target_value` | `numeric` | YES | — | — | Desired outcome |
| `target_date` | `date` | YES | — | — | When to achieve |
| `target_type` | `text` | YES | — | CHECK IN ('minimum','maximum','exact','range') | Direction |
| `range_min` | `numeric` | YES | — | — | If range type |
| `range_max` | `numeric` | YES | — | — | If range type |
| `active` | `boolean` | NO | `true` | — | Soft archive |
| `created_at` | `timestamptz` | NO | `now()` | — | Audit |
| `updated_at` | `timestamptz` | NO | `now()` | — | Audit |
| **Unique** | `(definition_id)` WHERE `active` | — | — | — | One active target per metric |

---

## Ownership and RLS Blueprint

### Should `metric_entries` Contain `user_id` Directly?
**Yes.** Denormalized `user_id` on `metric_entries` enables:
- Simple RLS: `auth.uid() = user_id` on all operations
- Efficient queries without joining `metric_definitions` for ownership
- Matches existing pattern (`finance_transactions`, `body_metrics`, `mind_metrics`, `habit_logs`, `journal_entries`)

### How Should Metric Ownership Be Verified?
- `metric_definitions`: `auth.uid() = user_id`
- `metric_entries`: `auth.uid() = user_id` (denormalized) — **also** verify `definition_id` belongs to user via FK cascade (ON DELETE CASCADE ensures orphan prevention)
- `metric_targets`: `auth.uid() = user_id`

### How Should Cross-User Metric-Entry Insertion Be Blocked?
- RLS on `metric_entries`: `auth.uid() = user_id` (denormalized)
- FK `definition_id` → `metric_definitions(id)` ON DELETE CASCADE ensures definition belongs to same user (since `metric_definitions.user_id = auth.uid()`)
- No separate helper function needed — cascade + denormalized `user_id` is sufficient

### Which Indexes Are Needed?
```sql
CREATE INDEX idx_metric_definitions_user_domain ON metric_definitions(user_id, domain);
CREATE INDEX idx_metric_entries_user_date ON metric_entries(user_id, entry_date);
CREATE INDEX idx_metric_entries_definition_id ON metric_entries(definition_id);
CREATE INDEX idx_metric_targets_definition_active ON metric_targets(definition_id) WHERE active;
```

### Which Foreign Keys and Composite Constraints?
- `metric_definitions.user_id` → `auth.users(id)` ON DELETE CASCADE
- `metric_entries.user_id` → `auth.users(id)` ON DELETE CASCADE
- `metric_entries.definition_id` → `metric_definitions(id)` ON DELETE CASCADE
- `metric_entries.linked_goal_id` → `goals(id)` ON DELETE SET NULL
- `metric_entries.linked_project_id` → `projects(id)` ON DELETE SET NULL
- `metric_targets.user_id` → `auth.users(id)` ON DELETE CASCADE
- `metric_targets.definition_id` → `metric_definitions(id)` ON DELETE CASCADE
- **Unique**: `(user_id, domain, name)` on `metric_definitions`
- **Unique**: `(definition_id)` WHERE `active` on `metric_targets`

### RLS Rules (Plain English + Pseudocode)

**`metric_definitions`**:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`
- System templates (`is_template = true, user_id IS NULL`): SELECT only for authenticated users

**`metric_entries`**:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id` AND `definition_id` references a definition owned by user (enforced by FK cascade)
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

**`metric_targets`**:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

### Archived Metrics Behavior
- `is_template` on definitions: never archived, read-only for users
- `metric_targets.active = false`: excluded from active target queries; history preserved
- No soft-delete on entries — hard delete only (user action)
- Archived definitions: `is_template = false` + user can mark inactive (add `active boolean` column if needed later)

### Cascading Deletion Behavior
- Delete `metric_definition` → cascade deletes `metric_entries` + `metric_targets` (ON DELETE CASCADE)
- Delete `user` → cascade deletes all three tables (ON DELETE CASCADE on `user_id`)

---

## Number and Unit Model

### Supported Value Kinds

| Kind | PostgreSQL Type | Example Units | Precision Rules |
|------|----------------|---------------|-----------------|
| **number** | `numeric(10,2)` | kg, cm, L, units | 2 decimal places max |
| **count** | `integer` | reps, pieces, sessions | Whole numbers only |
| **percentage** | `numeric(6,2)` | % | 0.00–100.00, 2 decimals |
| **duration** | `integer` (minutes) | min, h | Store minutes; display h:mm |
| **currency** | `numeric(12,2)` | USD, ILS, EUR | 2 decimals, ISO-3 currency code |
| **rating** | `integer` | 1-5, 1-10, score | Whole numbers, bounded |

### PostgreSQL Numeric Precision for Stored Values
- **Currency**: `numeric(12,2)` — matches Finance V2 (`amount numeric(12,2)`)
- **General measurements**: `numeric(10,2)` — e.g., weight 123.45 kg, waist 85.50 cm
- **Percentages**: `numeric(6,2)` — 0.00 to 100.00
- **Counts**: `integer` — reps, steps, pieces
- **Durations**: `integer` (minutes) — 30, 45, 90, 120
- **Ratings**: `integer` — 1–5, 1–10

### Currency Rules
- Each currency metric has **one** currency unit (from definition.unit = 'USD'/'ILS'/'EUR')
- USD and ILS values **must not be combined** in aggregates
- No FX service in Phase 1
- No automatic conversion — user enters rate manually if needed
- Store `original_value` + `original_unit` + `conversion_rate` if user converts
- Display: `original_value original_unit (≈ converted_value reporting_unit @ rate)`
- No NaN/Infinity in UI — validate on write, show "—" on read if null

### Formatting and Validation Rules Per Value Kind

| Kind | Input Validation | Display Format | Edge Cases |
|------|------------------|----------------|------------|
| number | > 0, ≤ 999999.99, 2 decimals | `123.45 kg` | Zero allowed for some (weight > 0) |
| count | integer ≥ 0 | `42 reps` | Zero valid |
| percentage | 0–100, 2 decimals | `12.50%` | Previous value = 0 → "Percentage unavailable" |
| duration | integer minutes ≥ 0 | `1h 30m` or `90 min` | Zero = "Not recorded" |
| currency | > 0, 2 decimals, ISO-3 unit | `$1,234.56` or `₪4,500.00` | No conversion; show original always |
| rating | integer within bounds (1–5 or 1–10) | `4/5` or `7/10` | — |

---

## Calculation Contract

### Chronological Sorting
- Entries sorted by `entry_date` ASC, then `created_at` ASC for same-day ties
- Adapters must preserve this order

### Latest Entry
- Most recent `entry_date` (DESC), then latest `created_at` for ties
- Return `null` if no entries

### Previous Entry
- Entry immediately before latest by `entry_date` (DESC)
- If multiple entries on same date, use `created_at` DESC, skip the latest
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
latest.value - target.baseline_value
```
- Null if baseline not set

### Target Distance
| Target Type | Formula |
|-------------|---------|
| minimum | `target_value - latest.value` (positive = above minimum) |
| maximum | `latest.value - target_value` (positive = below maximum) |
| exact | `ABS(latest.value - target_value)` |
| range | `CASE WHEN latest < range_min THEN range_min - latest WHEN latest > range_max THEN latest - range_max ELSE 0 END` |

### One-Entry History
- Latest = that entry
- Previous = null
- Absolute/percentage change = null with reason "Only one entry recorded"
- Baseline change = computed if baseline exists
- Target distance = computed if target exists

### No Entries
- All calculations return `null` with reason "No entries recorded"

### Duplicate Dates
- Multiple entries same date allowed (different `created_at`)
- Latest = most recent `created_at` on that date
- Previous = next most recent `created_at` on that date, or previous date

### Deleted Entries
- Hard delete → removed from all calculations
- No soft-delete in Phase 1

### Archived Metrics
- Archived definitions (`active = false` if added later): exclude from default queries, keep history
- Archived targets (`active = false`): exclude from active target queries

### Target Direction Semantics
| Direction | "Better" Means |
|-----------|----------------|
| increase | Higher value = progress (e.g., bench press, savings) |
| decrease | Lower value = progress (e.g., weight, body fat, debt) |
| maintain | Value within range = progress (e.g., weight maintenance) |
| minimum | Value ≥ target = achieved |
| maximum | Value ≤ target = achieved |

**Do not assume higher is always better.** Each metric definition should declare its `target_direction` (increase/decrease/maintain/none) — add this column in Phase 3 if needed.

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
- Goals/Projects linking (`metric_targets` → goals) → Phase 3
- Body adapters (`body_metrics`/`body_measurements` → `metric_entries`) → Phase 1 adapters only, no UI integration
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

### Optional Integration That Appears Tempting But Must Remain Deferred
- **Body → Results auto-sync**: "When I log weight in Body, create metric entry" — creates hidden writes, breaks manual-first principle
- **Goal progress from metrics**: Requires `metric_targets` + goal linking logic — Phase 3
- **Coach rules from results**: "Weight not logged in 14 days" — Phase 6
- **Finance net worth as metric**: Requires Finance V2 multi-currency balance RPC — Phase 2

---

## Test Plan

### Database Contract
| Test | Description |
|------|-------------|
| Ownership | `metric_definitions` INSERT with another user's `user_id` fails |
| Cross-user denial | `metric_entries` INSERT with `definition_id` owned by another user fails |
| Invalid values | `value` = negative for weight fails CHECK; `percentage` > 100 fails |
| Invalid enum | `metric_type` = 'invalid' fails CHECK |
| Invalid FK | `definition_id` not in `metric_definitions` fails FK |
| Archived metrics | `metric_definitions` with `active=false` excluded from default SELECT |
| Deletion behavior | DELETE `metric_definition` cascades to `metric_entries` + `metric_targets` |

### Calculation Utilities (Pure Functions)
| Test | Input | Expected |
|------|-------|----------|
| Latest + previous | `[{date:'2026-01-10',v:72},{date:'2026-01-05',v:73.7}]` | latest=72, prev=73.7 |
| Chronological order | Mixed dates | Sorted by date ASC, created_at ASC |
| One entry | `[{v:72}]` | latest=72, prev=null |
| Zero previous value | latest=5, previous=0 | pct_change=null, reason="Previous value was zero" |
| Positive change | latest=80, prev=75 | abs=5, pct=+6.67% |
| Negative change | latest=70, prev=75 | abs=-5, pct=-6.67% |
| Baseline change | latest=72, baseline=78 | -6 |
| Target distance (decrease) | latest=72, target=70 (decrease) | distance=2 |
| Target distance (increase) | latest=85, target=90 (increase) | distance=5 |
| Target distance (maintain range) | latest=72, range 70-75 | distance=0 |
| Null safety | Any null input | Returns null + reason string |
| Duplicate dates | Two entries same date, diff created_at | Latest = max created_at |

### UI Tests
| Test | Description |
|------|-------------|
| Creation form | Fill all fields → metric appears in overview |
| Entry form | Valid value + date → appears in history |
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

## Verification

### Commands to Run (Only Documentation Files Should Change)
```bash
npm run lint
npm run build
git diff --check
git status --short
```

---

## Final Report

### 1. Status
Documentation-only audit complete. No code, migrations, or SQL created.

### 2. Latest Migration Number
**00017** (`xp_totals_rpc.sql`)

### 3. Existing Systems Reusable
- PulseCard, MetricCard, SectionHeader, EmptyState
- `streaks.ts`, `metricSummaries.ts`, `bodyMetrics.ts`, `bodyPro.ts`
- Supabase client patterns, date utils, module registry
- Production smoke test infrastructure
- RLS ownership patterns (denormalized `user_id` + FK cascade)

### 4. Recommended Minimal Schema
**Two core tables + optional target**:
- `metric_definitions` (what can be measured)
- `metric_entries` (recorded measurements)
- `metric_targets` (baselines + targets for Goal linking)

### 5. Key RLS Decision
Denormalized `user_id` on `metric_entries` + FK cascade to `metric_definitions` (which has `user_id`) → simple `auth.uid() = user_id` policies, cross-user insertion blocked by FK ownership.

### 6. Numeric Precision Recommendation
- `numeric(12,2)` currency (matches Finance V2)
- `numeric(10,2)` general measurements
- `numeric(6,2)` percentages
- `integer` counts, durations (minutes), ratings
- **Never** `float`/`real`/`double precision`

### 7. UI Route Recommendation
`/results` under **Personal** category, status **"preview"** in module registry. Phone-first 390×844 layout with header, 3-step path, metric list, create form, detail + sparkline.

### 8. Test Plan Summary
- DB contract: ownership, cross-user denial, invalid values/enums/FKs, archived exclusion, cascade delete
- Calculations: latest/prev, chronological, one entry, zero previous, ±change, baseline, target distance (all directions), null safety, duplicate dates
- UI: creation, entry, sparse states, archive, deletion, chart states, phone overflow, protected route, navigation, no unsafe language
- Regression: all existing prod smoke suites + network audit

### 9. Deployment Order Summary
1. Strong-model review
2. Migration creation (by stronger model)
3. Local tests
4. Manual hosted SQL apply
5. Hosted schema verification
6. App code commit
7. Deploy
10. Prod smoke + network audit
11. Rollback via feature flag + code revert (schema drop only if essential)

### 10. Files Created or Changed
- **Created**: `docs/results-foundation-implementation-blueprint.md`
- **Updated**: `docs/post-beta-depth-roadmap.md` (Prompt #32 marked as prep only)
- **Updated**: `docs/private-beta-round-1-issue-log.md` (R1-057 added)

### 11. Lint/Build Results
```bash
npm run lint   # passes (existing warnings only)
npm run build  # passes
git diff --check  # clean
git status --short  # only docs/ files modified
```

### 12. Confirmation: No Production Code Changed
Only documentation files modified. No schema, migrations, TypeScript, React, or SQL created.

### 13. Confirmation: No Migration or SQL Created
Migration `0018_results_foundation.sql` **not created** — awaiting stronger model review per safety rules.

### 14. Git Status
```
M docs/post-beta-depth-roadmap.md
M docs/private-beta-round-1-issue-log.md
A docs/results-foundation-implementation-blueprint.md
```

### 15. Exact Unresolved Decisions
| Decision | Options | Blocking? |
|----------|---------|-----------|
| `metric_definitions` add `target_direction` column? | increase/decrease/maintain/none — needed for "better" semantics | Phase 3 |
| Separate `metric_entries.value` precision per type? | Single `numeric` vs per-type CHECK constraints | Phase 1 (decide in migration) |
| System template seeding mechanism? | `user_id=null` + `is_template=true` vs dedicated system user | Migration |
| Archive UX: separate tab vs filter? | Tab (current blueprint) vs filter chip | UI implementation |
| Adapter memoization strategy? | `React.useMemo` per request vs SWR/React Query | Implementation |

### 16. Exact Next Prompt for Stronger Model
> **Implement Results Foundation migration and adapters per `docs/results-foundation-implementation-blueprint.md`**
>
> **Deliverables**:
> 1. `supabase/migrations/0018_results_foundation.sql` — exact schema per blueprint (definitions, entries, targets, indexes, RLS, triggers, helper functions)
> 2. `src/lib/results/types.ts` — TypeScript interfaces matching schema
> 3. `src/lib/results/adapters.ts` — read-only adapters for Body, Mind, Finance, Passions, Goals (bounded date windows, memoized)
> 4. `src/lib/results/calculations.ts` — pure functions: latest, previous, absolute change, percentage change (zero-handled), baseline change, target distance (all 4 types), null safety
> 5. `src/lib/results/hooks.ts` — `useMetricDefinitions`, `useMetricEntries`, `useCreateMetric`, `useAddEntry`, `useArchiveMetric`, `useDeleteMetric`
> 6. `src/lib/results/templates.ts` — system template array matching blueprint table
> 7. Update `src/lib/modules.ts` — add `results` module to "personal" category, status "preview"
> 8. Unit tests for calculations + adapters
>
> **Constraints**:
> - No data migration
> - No UI components
> - No schema changes beyond this migration
> - Adapters must be read-only, memoized, bounded (max 90-day window default)
> - All numeric types per blueprint precision table
> - RLS: denormalized `user_id` on entries + FK cascade ownership
> - Feature flag `NEXT_PUBLIC_RESULTS_SYSTEM` guards all exports
>
> **Verification**:
> - `npm run lint` / `npm run build` pass
> - Local migration applies cleanly
> - Adapter tests pass with mocked Supabase
> - Calculation tests cover all contract cases