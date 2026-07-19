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
| Target/goal | `goals.target_value`, `passions.target_hours_per_week` | Shared `metric_targets` |
| Milestone | `passion_milestones`, (implicit in goals) | Shared `result_milestones` |
| Frequency | `habits.frequency`, `passions.target_hours_per_week` | Shared `measurement_schedule` |

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

### Core Tables

#### `metric_definitions` — What can be measured
```sql
create table public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('body', 'mind', 'finance', 'passions', 'custom')),
  name text not null check (length(trim(name)) between 1 and 80),
  metric_type text not null check (metric_type in ('numeric', 'duration', 'currency', 'percentage', 'count', 'rating')),
  unit text not null,                    -- e.g., 'kg', 'cm', 'min', 'USD', '%', 'reps', 'score'
  description text,
  default_frequency text check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'on_demand')),
  is_template boolean not null default false,  -- system-provided templates
  created_at timestamptz not null default now(),
  unique(user_id, domain, name)
);
```

**System templates (is_template=true, user_id=null or dedicated system user):**
- Body: Weight (kg), Body Fat (%), Waist (cm), Bench Press 1RM (kg), Running 5k (min)
- Mind: Mood (1-5), Stress (1-5), Focus (1-5)
- Finance: Net Worth (currency), Monthly Savings Rate (%), Investment Return (%)
- Passions: Practice Time (min), Pieces Completed (count), Skill Rating (1-10)

#### `metric_entries` — Recorded measurements
```sql
create table public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  definition_id uuid not null references public.metric_definitions(id) on delete cascade,
  value numeric not null,                 -- stored in definition's unit
  original_value numeric,                 -- if converted (e.g., currency)
  original_unit text,                     -- if different from definition
  conversion_rate numeric,                -- if converted
  entry_date date not null default current_date,
  notes text,
  confidence text check (confidence in ('measured', 'estimated', 'self_reported')),
  source text check (source in ('manual', 'calculated', 'imported', 'device')),
  linked_goal_id uuid references public.goals(id) on delete set null,
  linked_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `metric_targets` — Baselines and targets
```sql
create table public.metric_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  definition_id uuid not null references public.metric_definitions(id) on delete cascade,
  baseline_value numeric,                 -- starting point
  target_value numeric,                   -- desired outcome
  target_date date,                       -- when to achieve
  target_type text check (target_type in ('minimum', 'maximum', 'exact', 'range')),
  range_min numeric,                      -- if range
  range_max numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(definition_id) where active      -- one active target per metric
);
```

#### `result_milestones` — Achievements
```sql
create table public.result_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  definition_id uuid references public.metric_definitions(id) on delete set null,
  title text not null,
  description text,
  achieved_value numeric,
  achieved_date date not null,
  linked_goal_id uuid references public.goals(id) on delete set null,
  linked_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now()
);
```

### Adapters for Existing Tables
Instead of migrating data, create **read-only TypeScript adapters** that map existing tables into the unified shape:

```typescript
// lib/results/adapters.ts
export function adaptBodyMeasurements(measurements: BodyMeasurement[]): MetricEntry[] {
  return measurements.flatMap(m => [
    m.weight_kg ? { definition: 'body_weight', value: m.weight_kg, unit: 'kg', date: m.measurement_date, ... } : null,
    m.body_fat_percent ? { definition: 'body_fat_pct', value: m.body_fat_percent, unit: '%', date: m.measurement_date, ... } : null,
    m.waist_cm ? { definition: 'waist_cm', value: m.waist_cm, unit: 'cm', date: m.measurement_date, ... } : null,
    // ... other fields
  ]).filter(Boolean);
}

export function adaptFinanceTransactions(txns: FinanceTransaction[]): MetricEntry[] {
  return txns.map(t => ({
    definition: t.type === 'income' ? 'income' : 'expense',
    value: t.amount,
    unit: t.currency,
    date: t.transaction_date,
    ...
  }));
}
```

---

## 3. Domain Templates (Pre-defined Metric Definitions)

| Domain | Template Name | Type | Unit | Default Frequency |
|--------|---------------|------|------|-------------------|
| Body | Weight | numeric | kg | weekly |
| Body | Body Fat % | percentage | % | monthly |
| Body | Waist | numeric | cm | monthly |
| Body | Bench Press 1RM | numeric | kg | monthly |
| Body | Running 5k | duration | min | weekly |
| Mind | Mood | rating | 1-5 | daily |
| Mind | Stress | rating | 1-5 | daily |
| Mind | Focus | rating | 1-5 | daily |
| Finance | Net Worth | currency | user currency | monthly |
| Finance | Monthly Savings Rate | percentage | % | monthly |
| Finance | Investment Return | percentage | % | quarterly |
| Passions | Practice Time | duration | min | weekly |
| Passions | Pieces Completed | count | count | monthly |
| Passions | Skill Rating | rating | 1-10 | quarterly |
| Custom | (user-defined) | any | any | any |

---

## 4. Integration Points

### Weekly Review
- New section: "Results This Week" — shows metric entries for the week
- Comparison: current week vs previous week per metric
- Trend sparklines for metrics with ≥ 4 entries

### Insights
- "Result Trends" card: metrics with ≥ 8 entries show slope
- "Milestones Achieved" — links to `result_milestones`
- "Target Progress" — % to target for active `metric_targets`

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
| 0 | Create new tables (`metric_definitions`, `metric_entries`, `metric_targets`, `result_milestones`) + RLS |
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