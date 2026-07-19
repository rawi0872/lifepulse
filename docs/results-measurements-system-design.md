# Results and Measurements System Design

## Purpose
A reusable foundation for recording, tracking, and reviewing measurable results across Life Pulse domains. Supports numeric, duration, currency, percentage, count, and rating measurements without claiming causation.

---

## 1. Current State Audit

### What Exists and Can Be Reused
| Domain | Table | Measurement Type | Fields |
|--------|-------|------------------|--------|
| Body | `body_measurements` | Weight, body fat %, circumferences | `weight_kg`, `body_fat_percent`, `waist_cm`, `chest_cm`, `arms_cm`, `legs_cm`, `measurement_date`, `notes` |
| Body | `body_metrics` | Daily signals | `sleep_hours`, `sleep_quality`, `energy`, `steps`, `workout_minutes`, `weight_kg`, `resting_heart_rate`, `recovery_score` |
| Mind | `mind_metrics` | Daily ratings | `mood`, `stress`, `focus`, `clarity`, `motivation` (1-5), `reflection`, `tags` |
| Finance | `finance_transactions` | Money | `amount`, `currency`, `type` (income/expense), `transaction_date`, `title`, `note` |
| Passions | `passion_milestones` | Achievements | `title`, `description`, `target_date`, `completed_at` |
| Passions | `passion_sessions` | Time | `duration_minutes`, `focus`, `enjoyment`, `difficulty` |
| Goals | `goals` + `goal_links` | Outcomes | `target_value`, `current_value`, linked tasks/habits/projects |

### What Is Too Shallow
- **Streaks**: Only current/longest streak in JS; no recovery, completion rate, best week, monthly consistency
- **Progress Photos**: Not implemented; no storage bucket, no RLS, no metadata
- **Cross-domain results**: No unified way to link a body measurement to a goal, or a finance milestone to a project
- **Templates**: No domain-specific measurement templates (e.g., "Body weight", "Bench press 1RM", "Monthly revenue")
- **Charts/Trends**: Weekly Review/Insights show activity trends, not result trends

### Where Data Models Overlap
| Concept | Current Tables | Unification Opportunity |
|---------|----------------|-------------------------|
| Dated measurement | `body_measurements`, `body_metrics`, `mind_metrics`, `finance_transactions` | Shared `metric_entries` with domain + type |
| Target/goal | `goals.target_value`, `passions.target_hours_per_week` | Baseline + target on `metric_definitions` |
| Milestone | `passion_milestones`, (implicit in goals) | Deferred to Phase 3 |
| Frequency | `habits.frequency`, `passions.target_hours_per_week` | `cadence` on `metric_definitions` |

### Must Remain Backward-Compatible
- All existing tables and RLS policies must continue working
- Existing API routes and UI components must not break
- Migration path: adapters → gradual adoption → eventual deprecation (years later)

### Major Risks
| Risk | Mitigation |
|------|------------|
| Giant universal table loses domain meaning | Keep domain tables; add `metric_entries` as a *registry* with adapters |
| Privacy: finance + body in same table | RLS per `domain`; separate policies; no cross-domain queries without explicit consent |
| Calculation edge cases (currency, units) | Store original unit/currency; convert on read with explicit rate |
| Breaking existing streak/XP logic | Do not change `streaks.ts`, `xpTotals.ts`, `habit_logs` |

---

## 2. Data Model

### Core Tables (Phase 1: Two Tables Only)

**Phase 1 uses exactly two tables**: `metric_definitions` and `metric_entries`.
No `metric_targets`, no `result_milestones`, no template tables in Phase 1.
Baseline and optional target live on `metric_definitions`.
Templates are static TypeScript config in `src/lib/results/templates.ts`, not database records.

#### `metric_definitions` — What can be measured
```sql
create table public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('body','mind','finance','business','learning','skills','passions','goals','custom')),
  name text not null check (length(trim(name)) between 1 and 80),
  description text,
  value_kind text not null check (value_kind in ('number','count','percentage','duration','currency','rating')),
  unit text not null,
  baseline_value numeric(20,6),
  target_value numeric(20,6),
  target_direction text check (target_direction in ('increase','decrease','maintain','none')),
  cadence text check (cadence in ('daily','weekly','monthly','quarterly','yearly','custom','none')),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, domain, name)
);
```

#### `metric_entries` — Recorded measurements
```sql
create table public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_definition_id uuid not null references public.metric_definitions(id) on delete cascade,
  value numeric(20,6) not null,
  recorded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  -- Composite FK prevents cross-user entry insertion
  foreign key (metric_definition_id, user_id) references metric_definitions(id, user_id) on delete cascade
);

create index idx_metric_entries_user_recorded on metric_entries(user_id, recorded_at desc);
create index idx_metric_entries_definition on metric_entries(metric_definition_id);
```

> **No `metric_targets` table in Phase 1** — baseline and optional target live on `metric_definitions` (`baseline_value`, `target_value`, `target_direction`).
> **No `result_milestones` table in Phase 1** — defer to Phase 3.
> **No template records in database** — templates are static TypeScript config in `src/lib/results/templates.ts`.

### Adapters for Existing Tables
Phase 1 does **not** build adapters. Domain tables (`body_metrics`, `body_measurements`, `mind_metrics`, `finance_transactions`, `passion_sessions`, `goals`) remain primary. Adapters are Phase 3+ work.

---

## 3. Domain and Value Kind Candidates (Final)

Supported domains (expandable via `'custom'`):
- `body` — weight, body fat %, circumferences, lifts, cardio
- `mind` — mood, stress, focus, clarity, motivation (1–5)
- `finance` — net worth, savings rate, cash flow, revenue, profit (multi-currency, no conversion)
- `business` — revenue, profit, customers, churn
- `learning` — books read, courses completed, practice hours
- `skills` — bench press 1RM, guitar tempo (BPM), typing speed (WPM)
- `passions` — practice time, pieces completed, skill rating
- `goals` — linked outcome metrics
- `custom` — user-defined

Supported value kinds:
- `number` — `numeric(20,6)` — kg, cm, L, units
- `count` — `integer` — reps, pieces, sessions
- `percentage` — `numeric(6,2)` — 0.00–100.00
- `duration` — `integer` (minutes) — min, h
- `currency` — `numeric(20,6)` — USD, ILS, EUR (no conversion in Phase 1)
- `rating` — `integer` — 1–5, 1–10, score

Supported target directions:
- `increase` — higher = progress (bench press, savings)
- `decrease` — lower = progress (weight, body fat, debt)
- `maintain` — stay near target (weight maintenance)
- `none` — no target logic

Supported cadences:
- `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, `custom`, `none`

---

## 4. Integration Points

### Weekly Review
- New section: "Results This Week" — shows metric entries for the week
- Comparison: current week vs previous week per metric
- Trend sparklines for metrics with ≥ 4 entries

### Insights
- "Result Trends" card: metrics with ≥ 8 entries show slope
- "Milestones Achieved" — links to `result_milestones` (Phase 3)
- "Target Progress" — % to target for active targets on `metric_definitions` (Phase 3)

### Goals
- Link `metric_targets` to goals: "Lose 5 kg" → `metric_definition: body_weight`, `target: -5 kg from baseline`
- Goal progress auto-updates from `metric_entries`

### Coach / Assistant
- Deterministic rules: "No weight entry in 14 days" → prompt
- Future AI: "Weight trending down 0.3 kg/week; on track for goal"

---

## 5. Streaks & Progress (Design 3 — Separate Doc)

See `docs/streaks-and-progress-design.md` for:
- Current streak, longest-ever streak
- Completion rate, best week, monthly consistency
- Recovery after missed day
- Streak milestones (visual badges, not XP)
- XP farming risks, trivial habit risks, trust in XP meaning

---

## 6. Progress Photos (Design 4 — Separate Doc)

See `docs/progress-photos-design.md` for:
- Private Supabase Storage bucket
- User-scoped paths, RLS/storage policies
- Signed URLs, image deletion, retention
- Metadata, measurement/date association
- Photo comparison, export, account deletion
- Sensitive-image warnings, max size/compression
- Mobile upload experience

---

## 7. Migration Strategy

| Phase | Action |
|-------|--------|
| 0 | Create new tables (`metric_definitions`, `metric_entries`) + RLS |
| 1 | Build adapters (`lib/results/adapters.ts`) for all existing domain tables |
| 2 | Weekly Review: "Results This Week" section using adapters |
| 3 | Insights: "Result Trends" card using unified entries |
| 4 | Goals: link `metric_targets` to goals |
| 5 | Coach: deterministic rules using unified entries |
| 6 | Assistant: permission includes "Results & Measurements" |
| 7+ | Optional: UI for custom metric definitions, templates, CSV import |

**No data migration required** — existing tables untouched; adapters unify on read.

---

## 8. Acceptance Criteria

- [ ] Adapters produce `MetricEntry[]` for all 6 domains
- [ ] Weekly Review shows "Results This Week" with ≥ 1 metric from each domain that has data
- [ ] Insights shows trend sparkline for metrics with ≥ 8 entries
- [ ] Goals can link to `metric_target` and show progress from entries
- [ ] Coach rule "No weight entry in 14 days" works via unified entries
- [ ] All existing tests pass; new tests for adapters + unified queries
- [ ] Network audit: no new unbounded reads; `/weekly-review` and `/insights` still bounded

---

## 9. Open Questions

1. **Sub-metrics**: Should "Bench Press" have sub-metrics (1RM, 5RM, volume)? Separate definitions or JSON `metadata`?
2. **Derived metrics**: "BMI" from weight + height — computed on read or stored?
3. **Sharing**: Can a user share a metric definition with another user? (Template export/import)
4. **Devices**: Future device sync (Apple Health, etc.) → writes to `metric_entries` with `source='device'`
5. **Correlation**: "When sleep < 6h, next-day mood -0.8" — computed in Insights or Assistant?

---

## 10. Safety & Compliance

| Rule | Enforcement |
|------|-------------|
| No medical claims | UI never says "healthy weight", "normal BMI" — only "Your weight: X kg" |
| No therapy claims | Mood entries labeled "Self-reported mood (1-5)" |
| No financial advice | Finance metrics labeled "Your net worth: $X" not "You should save more" |
| Causation disclaimer | Every trend card: "Correlation ≠ causation. Insufficient data for conclusions." |
| Data ownership | All entries user-owned; export includes all metric data |

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