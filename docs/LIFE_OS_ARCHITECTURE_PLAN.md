# Life Pulse — Life OS Architecture Plan

**Date:** June 23, 2026
**Status:** Phase 4D — Body/Mind Dashboard Polish & Today Metric Preview Complete
**Audience:** Developers implementing Phase 5+ features

---

## 1. Current Information Architecture Audit

### 1.1 Current Route Map

| Route | File | Lines | Purpose | Life OS Role | Overloaded? |
|-------|------|-------|---------|-------------|-------------|
| `/` | `page.tsx` | 381 | Landing page | Public marketing | No |
| `/login` | `login/page.tsx` | ~113 | Auth | Auth | No |
| `/signup` | `signup/page.tsx` | ~237 | Auth | Auth | No |
| `/forgot-password` | `forgot-password/page.tsx` | ~109 | Auth | Auth | No |
| `/reset-password` | `reset-password/page.tsx` | ~146 | Auth | Auth | No |
| `/auth/callback` | `auth/callback/route.ts` | 47 | Auth | Auth | No |
| `/onboarding` | `onboarding/page.tsx` | 823 | First-run setup | Onboarding | **Yes** — realm creation, profile, feature tour all in one |
| `/today` | `today/page.tsx` | ~820 (was 1091) | Daily command center | Today's Pulse | Phase 3A extracted 6 components, -290 lines. Phase 4D adds "Logged today" badge + energy/mood preview on Body/Mind links |
| `/habits` | `habits/page.tsx` | ~565 | Habit CRUD | Habit Pulse | Moderate — includes inline form + weekly grid |
| `/tasks` | `tasks/page.tsx` | ~547 | Task CRUD | Task management | Moderate — includes inline form + filters |
| `/projects` | `projects/page.tsx` | 454 (was 853) | Project CRUD | Project Pulse | Phase 3A extracted 4 components, -399 lines |
| `/finance` | `finance/page.tsx` | 641 (was 867) | Finance management | Money Pulse | Phase 3A extracted 5 components, -226 lines |
| `/journal` | `journal/page.tsx` | 209 | Daily journal | Journal/Reflection | No — clean, focused |
| `/insights` | `insights/page.tsx` | 524 | Analytics/reviews | Intelligence | Phase 3B extracted ~200 lines into 6 components |
| `/body` | `body/page.tsx` | ~255 | Body Pulse dashboard + manual entry | Life Domains | Phase 4A+4B+4D — body_metrics table, manual entry form, recent summary, averages card (sleep/energy/recovery/steps/workout) with trends |
| `/mind` | `mind/page.tsx` | ~250 | Mind Pulse dashboard + manual entry | Life Domains | Phase 4A+4B+4D — mind_metrics table, manual entry form, recent summary, averages card (mood/stress/focus/clarity/motivation) with trends |
| `/settings` | `settings/page.tsx` | ~510 | Profile/realms/prefs | System | Moderate — profile, realms, password, realm CRUD |
| `/privacy` | `privacy/page.tsx` | 182 | Legal | Public | No |
| `/terms` | `terms/page.tsx` | 170 | Legal | Public | No |

### 1.2 Current Navigation Structure (After Phase 4A+4B)

```
 Pulse           → Today's Pulse
 Growth          → Habits, Tasks, Projects
 Life Domains    → Body, Mind, Money
 Intelligence    → Journal, Insights
 System          → Settings
```

**Changes from Phase 3A:**
- Body and Mind added to Life Domains ✅
- 10 nav items across 5 groups (was 8 items in 5 groups) ✅
- Mobile nav derives all 10 items from nav groups (no hardcoded links) ✅

### 1.3 Current Data Ownership

| Data Domain | Primary File(s) | Also Used By | Shared Problems |
|------------|-----------------|-------------|-----------------|
| Habits | `habits/page.tsx` | `today/page.tsx` | Duplicated fetch logic |
| Tasks | `tasks/page.tsx` | `today/page.tsx`, `projects/page.tsx` | Task toggle duplicated across 3 pages |
| Projects | `projects/page.tsx` | `today/page.tsx` | Cross-referencing via project_id |
| Finance | `finance/page.tsx` | `today/page.tsx` | Today only reads net balance |
| Journal | `journal/page.tsx`, `JournalSection.tsx` | `today/page.tsx` | JournalSection embedded in Today |
| XP/Levels | `lib/levels.ts`, `lib/taskCompletion.ts` | today, habits, tasks | Utility functions only |
| Realms | `settings/page.tsx` | All pages | Realm data fetched independently everywhere |
| Profile | `settings/page.tsx` | `today/page.tsx`, `onboarding/page.tsx` | Name fetched independently |

### 1.4 Gaps (Missing Future Routes)

| Missing Route | Life OS Component | Priority | Current Workaround |
|--------------|-------------------|----------|-------------------|
| `/body` | Body Pulse | High | Body realm exists but no dedicated tracking |
| `/mind` | Mind Pulse | High | Mind realm exists + journal, but no dedicated tracking |
| `/goals` | Goal Pulse | Medium | Projects serve as proxies |
| `/devices` | Device Pulse | Low | Nothing |
| `/coach` | AI Coach | Medium | Nothing |
| `/weekly-review` | Weekly Review | Medium | Nothing |

---

## 2. Proposed Future Route Map

### 2.1 Route Map (All Phases)

Phase 3 — Core restructure (next phase):
| Route | Action | Rationale |
|-------|--------|-----------|
| `/today` | Keep, refactor into sub-components | Core entry point |
| `/habits` | Keep, minor cleanup | Works well, moderate size |
| `/tasks` | Keep, minor cleanup | Works well, moderate size |
| `/projects` | Keep, refactor into sub-components | Overloaded |
| `/finance` | Keep, extract remaining inline forms | Overloaded but well-structured |
| `/journal` | Keep | Clean |
| `/insights` | Keep, minor refactor | Overloaded but well-structured |
| `/settings` | Keep | Moderate |

Phase 4 — New sections:
| Route | Action | Rationale |
|-------|--------|-----------|
| `/body` | **New** | Body Pulse tracking (sleep, workouts, steps, weight) |
| `/mind` | **New** | Mind Pulse tracking (mood, focus, meditation, reading) |

Phase 5 — Coaching and review:
| Route | Action | Rationale |
|-------|--------|-----------|
| `/goals` | **New** | Goal framework (OKR/SMART with XP alignment) |
| `/coach` | **New** | AI Coach dashboard (daily briefing, recommendations) |
| `/weekly-review` | **New** | Weekly review (narrative + stats) |

Phase 6+ — Devices:
| Route | Action | Rationale |
|-------|--------|-----------|
| `/devices` | **New** | Wearable integrations, sync status, manual entry |

### 2.2 Route Detail: Phase 4+ Proposals

#### `/body` — Body Pulse
- **Purpose:** Track physical health metrics: sleep hours/quality, workouts, steps, weight, water, energy, resting heart rate
- **Data reuse:** Body realm, XP/levels system, habit logs (if user has fitness habits)
- **New tables needed:** `body_metrics` (time-series: metric_type, value, unit, source, timestamp), `body_goals` (user_id, metric_type, target_value, period)
- **Phase:** 4
- **Risk:** Medium — needs careful schema design for time-series data

#### `/mind` — Mind Pulse
- **Purpose:** Track mental/emotional metrics: mood, stress, focus, meditation minutes, reading, reflection tags
- **Data reuse:** Journal entries (mood/energy), Mind realm, XP/levels
- **New tables needed:** `mind_sessions` (session_type, duration_minutes, notes, timestamp), `mind_mood_logs` extended or new table
- **Phase:** 4
- **Risk:** Medium — mood data already exists in journal, avoid duplication

#### `/goals` — Goal Pulse
- **Purpose:** Long-term goals with milestones, linked to projects/tasks/habits
- **Data reuse:** Projects, tasks, habits, XP, realms
- **New tables needed:** `goals` (user_id, title, description, target_date, realm_id, status), `goal_milestones` (goal_id, title, target_date, completed), `goal_links` (goal_id, project_id|task_id|habit_id)
- **Phase:** 5
- **Risk:** Medium — cross-linking to existing tables is complex

#### `/coach` — AI Coach
- **Purpose:** Daily briefing, next-best-action, pattern detection, recommendations
- **Data reuse:** All tables (read-only)
- **New tables needed:** `coach_recommendations` (cached suggestions, type, priority, dismissed), `coach_briefings` (generated daily briefings, stored for history)
- **Phase:** 5
- **Risk:** Medium-High — AI integration complexity

#### `/devices` — Device Pulse
- **Purpose:** Manage wearable integrations, view imported data, manual entry fallback
- **Data reuse:** Body metrics, health data tables
- **New tables needed:** `integrations` (user_id, provider, device_type, access_token, last_sync), `device_metrics` (normalized time-series)
- **Phase:** 6+
- **Risk:** High — OAuth, rate limits, data format normalization

#### `/weekly-review` — Weekly Review
- **Purpose:** AI-assisted or manual weekly reflection with stats
- **Data reuse:** All tables (aggregate for the week)
- **New tables needed:** `weekly_reviews` (user_id, week_start, content, ai_generated, submitted)
- **Phase:** 5
- **Risk:** Low — mostly read-only aggregation

---

## 3. Proposed Navigation Architecture

### 3.1 Recommended Nav Grouping

```
 PULSE           → Today's Pulse
 GROWTH          → Habits, Tasks, Projects
 LIFE DOMAINS    → Body, Mind, Money, Goals
 INTELLIGENCE    → Insights, Coach, Weekly Review
 SYSTEM          → Settings, Devices
```

**Rationale:**
- **Pulse** — Daily command center, the user's home base in the OS
- **Growth** — Action-oriented: what you build and do daily (habits, tasks, projects)
- **Life Domains** — The 4 core pillars of the Life OS vision (Body, Mind, Money, Goals)
- **Intelligence** — Data-driven: analytics, AI coaching, and review cycles
- **System** — Configuration: settings and device management

### 3.2 Migration Status

**Phase 3A (completed):**
- Renamed "Build" → "Growth" ✅
- Moved Finance from "Growth" to "Life Domains" as "Money" ✅
- Merged "Reflect" (Journal) and "Review" (Insights) into "Intelligence" ✅
- Added Settings to nav groups as "System" (was sidebar footer) ✅
- Mobile nav derives all items from nav groups (no hardcoded links) ✅

Phase 4:
- Add Body and Mind to Life Domains
- Add Coach placeholder to Intelligence

Phase 5:
- Add Goals to Life Domains
- Add Weekly Review to Intelligence
- Add Coach (live) to Intelligence

Phase 6+:
- Add Devices to System

### 3.3 Mobile Nav Considerations

Mobile bottom nav currently holds: Today, Habits, Projects, Tasks, Journal, Insights + Settings.

Proposed mobile evolution:
- Phase 3: Keep 6 items + Settings. Shorten labels ("Today", "Tasks", "Growth", "Money", "Reflect", "Data")
- Phase 4+: Introduce a "More" overflow menu for less-frequented routes
- Never exceed 6 primary mobile nav items

---

## 4. Oversized Page Split — Technical Plan

### 4.1 Status (After Phase 3A)

| Order | Page | Original Lines | Current Lines | Diff | Status |
|-------|------|---------------|---------------|------|--------|
| 1 | **Finance** | 867 | 641 | -226 | ✅ Complete — 5 components extracted |
| 2 | **Projects** | 853 | 454 | -399 | ✅ Complete — 4 components extracted |
| 3 | **Today** | 1091 | 801 | -290 | ✅ Complete — 6 components extracted |
| 4 | **Insights** | 679 | 727 | +48 | ⏳ Not started (page grew during development) |
| 5 | **Onboarding** | 751 | 823 | +72 | ⏳ Not started (page grew during development) |

### 4.2 Original Plan (Reference, Phase 3A Implemented)

The sections below document the original extraction plan. Phase 3A successfully executed Finance, Projects, and Today extractions. Insights and Onboarding remain pending for Phase 3B.

### 4.2 Finance Page (867→641 lines — ✅ DONE Phase 3A)

**Completed extraction:** SimpleSelect, TransactionForm, BudgetForm, AccountForm, BudgetHealthList in `src/components/finance/`. 13 files total (including pre-existing types, utils, charts).

**Still inline (~400 lines of boilerplate):**
- Tab state + render switching
- Data fetching logic
- Modal open/close state

### 4.3 Projects Page (853→454 lines — ✅ DONE Phase 3A)

**Completed extraction:** QuickDraftWizard, ProjectForm, ProjectCard, EmptyProjectState in `src/components/projects/`.

**Still inline (~200 lines of boilerplate):**
- Project CRUD functions (save, remove, reloadAll)
- Data fetching logic
- Modal open/close state

### 4.4 Today Page (1091→801 lines — ✅ DONE Phase 3A)

**Completed extraction:** TodaysPulseHeader, CommandStrip, MissionControl, BodyPulseSection, MindPulseSection, FinanceOverview in `src/components/today/`.

**Still inline (~350 lines of boilerplate):**
- Data loading functions + state declarations
- Suggested task card, all-done banner, welcome empty state
- Habit toggle + task toggle event handlers

### 4.5 Insights Page (727 lines)

**Already extracted:** RealmRadarChart, RealmRadarExpandedDialog, computeRealmScores, getStrongestRealm, getWeakestRealm, computeBalanceScore, generateSuggestion

**Still inline:**
- Data loading (fetch XP events, realms, habits, logs)
- RealmXp computation (mapping XP events to realms)
- InsightSkeleton component (lines 29-53)
- Non-radar insight cards (balance score, strongest/weakest, suggestions)
- Summary stats section
- Expanded dialog trigger + state management

**Proposed extraction:**
```
src/components/insights/
├── InsightSkeleton.tsx     ← extract skeleton
├── InsightSummary.tsx      ← extract balance score + stats cards
└── InsightSuggestions.tsx  ← extract suggestion cards

src/hooks/
└── useInsightsData.ts      ← extract data fetching + RealmXp computation
```

**Estimated reduction:** 727 → ~200 lines

**Risk:** Low — insights already has excellent component separation

### 4.6 Onboarding Page (823 lines)

**Already extracted:** Nothing (inline only)

**Still inline:**
- DEFAULT_REALMS constant + FEATURES constant
- Step 1: Profile creation (first name, last name, birth date)
- Step 2: Realm selection (6 default realms with color/icon)
- Step 3: Feature tour carousel
- Step 4: Completion
- All styles inline (no ui primitives used)
- All state + transitions in one component

**Proposed extraction:**
```
src/components/onboarding/
├── OnboardingProfileStep.tsx    ← name + birth date form
├── OnboardingRealmsStep.tsx     ← realm selection + display
├── OnboardingFeatureTour.tsx    ← carousel
├── OnboardingCompleteStep.tsx   ← completion CTA
└── OnboardingProgress.tsx       ← step indicator bar
```

**Estimated reduction:** 823 → ~100 lines (parent orchestrator)

**Risk:** Medium — onboarding has tight state coupling between steps

### 4.7 Extraction Safety Checklist

For each extraction:
- [ ] Does the extracted component accept only the props it needs (no full page state)?
- [ ] Are data-fetching hooks separated from rendering components?
- [ ] Is the extracted component buildable in isolation?
- [ ] Does the parent page still work when the component is extracted?
- [ ] Are inline styles migrated to CSS classes or component props?
- [ ] Are toast calls inside extracted components (not leaking to parent)?

---

## 5. Data Layer and Caching Plan

### 5.1 Current State Assessment

- All data fetching: `useEffect` + `supabase.from().select()` inline in each page
- No caching, no deduplication, no stale-while-revalidate
- Each page fetches independently — navigating from Today to Habits re-fetches all habits
- No React Server Components for dashboard data
- No data fetching hooks library

### 5.2 Options Comparison

| Approach | Complexity | Bundle Impact | Maintainability | Caching | SSR Support | Recommendation |
|----------|-----------|--------------|-----------------|---------|-------------|---------------|
| **Keep current** | None | None | Poor | None | No | Not recommended |
| **Custom hooks only** (e.g., `useHabits()`) | Low | None | Good | Manual only | No | **Phase 3 — immediate** |
| **Custom hooks + lightweight cache** (e.g., Map-based) | Low | ~1KB | Good | Basic (session) | No | **Phase 3 — if needed** |
| **SWR** | Medium | ~8KB | Excellent | Built-in | No | **Phase 3 — recommended after hooks** |
| **TanStack Query** | Medium | ~14KB | Excellent | Built-in | Partial | Phase 3 — alternative to SWR |
| **React Server Components** | High | None (server) | Excellent | Built-in | Yes | Phase 4+ — after page extraction |

### 5.3 Recommended Path (Conservative)

**Phase 3 (immediate, after page splits):**
1. Extract data fetching into custom hooks per domain:
   - `src/hooks/useHabits.ts` — `useHabits(userId)` → `{ habits, loading, error, refetch }`
   - `src/hooks/useTasks.ts` — `useTasks(userId, filters?)` → `{ tasks, loading, error, refetch }`
   - `src/hooks/useProjects.ts` — `useProjects(userId)` → `{ projects, tasks, loading, error, refetch }`
   - `src/hooks/useFinance.ts` — `useFinance(userId, monthRange)` → `{ accounts, transactions, budgets, loading, error }`
   - `src/hooks/useJournal.ts` — `useJournal(userId, date)` → `{ entry, loading, error, save }`
   - `src/hooks/useRealm.ts` — `useRealm(userId)` → `{ realms }` (shared)
   - `src/hooks/useTodayData.ts` — aggregates all of the above for the Today page
2. Each hook returns `{ data, loading, error, refetch }` — consistent API
3. Mutations (create/update/delete) call `refetch` after success, or optimistically update local state

**Phase 4 (after sections stabilize):**
4. Evaluate adding SWR or TanStack Query if stale data issues emerge during testing
5. SWR recommended over TanStack Query for this app's use case (read-heavy, simple mutations):

**Phase 5+ (after domain pages exist):**
6. Consider React Server Components for initial data load on domain pages
7. Server actions for mutations instead of client-side supabase calls

### 5.4 Hook Pattern Template

```typescript
// src/hooks/useHabits.ts
export function useHabits(userId: string) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("habits")
      .select("*, realms(name, color, icon)")
      .eq("user_id", userId)
      .order("created_at");
    if (err) { setError(err.message); } else { setHabits(data ?? []); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { habits, loading, error, refetch: fetch };
}
```

### 5.5 Cache Helper (Optional, Minimal)

```typescript
// src/lib/simpleCache.ts
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 30_000; // 30 seconds

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T;
  cache.delete(key);
  return null;
}

export function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}
```

---

## 6. Future Schema Planning

### 6.1 Body Pulse Tables (Proposed)

```sql
-- Phase 4: Body metric types (enum-like, defined in app or lookup table)
CREATE TABLE body_metric_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,        -- e.g. "sleep_hours", "workout_minutes", "steps", "weight_kg", "water_glasses"
  unit        TEXT NOT NULL,        -- e.g. "hours", "minutes", "count", "kg", "glasses"
  category    TEXT NOT NULL,        -- "sleep", "exercise", "nutrition", "vitals"
  source      TEXT DEFAULT 'manual' -- "manual", "apple_health", "oura", "whoop"
);

-- Phase 4: Time-series body metric logs
CREATE TABLE body_metric_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type_id  UUID NOT NULL REFERENCES body_metric_types(id),
  value           NUMERIC NOT NULL,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source          TEXT DEFAULT 'manual',  -- "manual", "apple_health", "oura", "whoop"
  notes           TEXT,
  UNIQUE(user_id, metric_type_id, logged_at)
);

-- RLS: user_id = auth.uid()
```

**Relationship to existing data:**
- Body realm (existing in `realms` table) — Body Pulse contributes XP to this realm
- Habits (existing) — "Workout 30min" habit is a habit, not a body metric; body metrics are the *outcome* of habits
- No direct FK to existing tables — independent tracking

**Privacy/Security:**
- Health data is highly sensitive — RLS must be strictly user-scoped
- No sharing features in v1
- Data export should be available in Settings

### 6.2 Mind Pulse Tables (Proposed)

```sql
-- Phase 4: Mind session types
CREATE TABLE mind_session_types (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE  -- "meditation", "reading", "focus_session", "therapy", "gratitude"
);

-- Phase 4: Mind session logs
CREATE TABLE mind_session_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type_id   UUID NOT NULL REFERENCES mind_session_types(id),
  duration_minutes  INT,
  notes             TEXT,
  mood_before       INT CHECK (mood_before BETWEEN 1 AND 5),
  mood_after        INT CHECK (mood_after BETWEEN 1 AND 5),
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: user_id = auth.uid()
```

**Relationship to existing data:**
- Mind realm (existing) — Mind Pulse contributes XP to this realm
- Journal entries (existing `journal_entries`) — mood/energy already tracked, Mind Pulse extends with structured session tracking
- Could add `journal_entry_id` FK to link mind sessions to journal entries

### 6.3 Goals Tables (Proposed)

```sql
-- Phase 5: Goals
CREATE TABLE goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  realm_id     UUID REFERENCES realms(id) ON DELETE SET NULL,
  target_date  DATE,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Phase 5: Goal milestones
CREATE TABLE goal_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  target_date  DATE,
  completed    BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order   INT DEFAULT 0
);

-- Phase 5: Goal links (polymorphic links to existing data)
CREATE TABLE goal_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  linked_type  TEXT NOT NULL CHECK (linked_type IN ('project', 'task', 'habit')),
  linked_id    UUID NOT NULL,
  UNIQUE(goal_id, linked_type, linked_id)
);

-- RLS: user_id = auth.uid() on goals; cascade to milestones and links
```

**Relationship to existing data:**
- Projects (existing) — goals can link to multiple projects as milestones
- Tasks (existing) — goals can link to specific tasks
- Habits (existing) — goals can link to supporting habits
- Realms (existing) — each goal belongs to a life realm

### 6.4 Devices / Integrations Tables (Proposed)

```sql
-- Phase 6+: Integration providers
CREATE TABLE integration_providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,  -- "apple_health", "google_fit", "oura", "whoop", "garmin"
  type        TEXT NOT NULL,         -- "health", "wearable", "fitness"
  auth_type   TEXT NOT NULL          -- "oauth2", "api_key", "none"
);

-- Phase 6+: User integrations
CREATE TABLE user_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id     UUID NOT NULL REFERENCES integration_providers(id),
  device_name     TEXT,
  access_token    TEXT,   -- encrypted at rest
  refresh_token   TEXT,   -- encrypted at rest
  token_expires   TIMESTAMPTZ,
  last_sync       TIMESTAMPTZ,
  enabled         BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: user_id = auth.uid()
```

**Privacy/Security:**
- Access tokens must be encrypted at rest (use Supabase Vault or app-level encryption)
- Token refresh handled server-side only
- Never expose tokens to client — create proxy API routes for data fetching

### 6.5 Coach Tables (Proposed)

```sql
-- Phase 5: Cached coach recommendations
CREATE TABLE coach_recommendations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,          -- "habit_suggestion", "task_priority", "body_reminder", "journal_prompt"
  title       TEXT NOT NULL,
  description TEXT,
  priority    INT DEFAULT 0,          -- higher = more important
  dismissed   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Phase 5: Generated weekly reviews
CREATE TABLE weekly_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  content      JSONB,                   -- structured AI-generated review
  submitted    BOOLEAN DEFAULT FALSE,   -- user confirmed/reviewed
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);
```

---

## 7. Wearable Integration Architecture Plan

### 7.1 Why NOT Direct Random Cheap Smart Ring Bluetooth Integration

- **No standard protocol** — Every device uses proprietary BLE/GATT services
- **Cost-to-value ratio** — A cheap smart ring's data is unreliable; a quality device (Oura, Ultrahuman) has a well-documented API
- **Security risk** — BLE connections from a web app require Web Bluetooth API, which has limited browser support and security concerns
- **Maintenance burden** — Each BLE device requires custom firmware-level integration
- **Better approach** — Use the device's official cloud API (Oura API, Apple HealthKit, Google Fit) which handles the BLE complexity

### 7.2 Integration Roadmap

**Phase 4 — Manual entry first:**
- Users manually log sleep, workouts, steps, weight in Body Pulse UI
- No device connections needed
- Data model supports `source = 'manual'`
- Builds the habit of tracking before automation

**Phase 5 — Structured manual entry with templates:**
- Quick-log templates ("I worked out for 30 min", "Slept 7 hours")
- Batch entry for past days
- CSV/JSON import for data migration

**Phase 6 — Apple Health / Health Connect:**
- Apple HealthKit via Health Connect API or Apple's Health Records API
- Android Health Connect for Wear OS / Google Fit
- Read-only first (import steps, sleep, HR, workouts)
- Write-only later (export Life Pulse habits to Health as mindful minutes)

**Phase 7 — Oura / Premium APIs:**
- Oura Ring API v2 (sleep, readiness, activity, HRV, temperature)
- Whoop API (strain, recovery, sleep)
- Ultrahuman Ring API
- Requires OAuth2 flow and Token storage

**Phase 8 — Generic wearable data model:**
- Normalize all provider data into `device_metrics` table
- Provider abstraction layer:
```
WearableDataSource (interface)
├── authenticate()
├── fetchSleep(from, to) → SleepData[]
├── fetchSteps(from, to) → StepsData[]
├── fetchHeartRate(from, to) → HRData[]
└── fetchWorkouts(from, to) → WorkoutData[]
```

### 7.3 Safe Provider Abstraction (Future)

```typescript
interface WearableProvider {
  id: string;
  name: string;
  type: 'health' | 'ring' | 'watch';
  authenticate(): Promise<void>;
  isConnected(): boolean;
  sync(from: Date, to: Date): Promise<SyncResult>;
  fetchMetric(metric: MetricType, from: Date, to: Date): Promise<MetricDataPoint[]>;
}

class OuraProvider implements WearableProvider { ... }
class AppleHealthProvider implements WearableProvider { ... }
class HealthConnectProvider implements WearableProvider { ... }
```

---

## 8. AI Coach Architecture Plan

### 8.1 Principles

- **User-controlled** — All recommendations are suggestions, never automatic actions
- **Transparent** — User can see why a recommendation was made
- **Private** — All data stays on the user's device/Supabase; no external AI API calls without consent
- **Progressive** — Start simple (rule-based), add ML later
- **Opt-in** — Coach features are enabled/disabled per-recommendation-type

### 8.2 What the Coach Should Read

| Data Source | What It Tells the Coach | Privacy Level |
|------------|------------------------|---------------|
| Habits + logs | Streaks, completion rate, missing days | Low |
| Tasks | Due dates, priorities, overdue count | Low |
| Projects | Progress, stalled projects, deadlines | Low |
| Journal entries | Mood trends, keywords, skipping pattern | Medium |
| XP/Levels | Which realms are neglected | Low |
| Finance | Overspending alerts, budget health | Medium |
| Body metrics (future) | Sleep debt, activity gaps, weight trend | High |
| Mind sessions (future) | Meditation streak, focus time trend | Medium |
| Goals (future) | Milestone progress, at-risk goals | Low |

### 8.3 What the Coach Should NOT Do Automatically

- ❌ Reschedule tasks without user approval
- ❌ Create habits without user confirmation
- ❌ Spend money (no auto-transactions)
- ❌ Share data with any third party
- ❌ Make health/medical recommendations
- ❌ Change user's profile or settings

### 8.4 Recommendation Types (by Phase)

**Phase 5 — Rule-based (no AI API):**
```
- "You haven't journaled in 3 days. Take 2 minutes to reflect."
- "Your Body realm XP is your lowest. Consider a 10-minute walk."
- "You have 5 overdue tasks. Review your priorities."
- "Your meditation streak is at 7 days! Keep it going."
- "Your sleep average is 5.5 hours — try going to bed 30 min earlier."
```

**Phase 7 — LLM-assisted summaries (opt-in, API key configurable):**
```
- Weekly review narrative: "This week you focused on Career (+120 XP) but Body lagged..."
- Journal sentiment analysis: "Your mood has been trending up since you started working out."
- Goal decomposition: "Break 'Get fit' into monthly milestones linked to your Body realm."
```

### 8.5 Architecture

```
Phase 5 — Simple:
  coach/recommend → read all tables → apply rule engine → insert coach_recommendations → display on Today / /coach

Phase 7 — AI-assisted:
  coach/briefing → read all tables → build context prompt → call LLM API → parse response → store in coach_briefings → display on /coach

Phase 8 — Proactive:
  Coach runs on a schedule (Vercel Cron or Supabase pg_cron) → generates daily briefing → user sees it on Today
```

### 8.6 Route /coach Layout (Future)

- Top: Daily briefing / "Good morning" summary
- Middle: Recommended next actions (sorted by priority)
- Bottom: Pattern insights ("You work best between 10am-12pm")
- Sidebar: Coach settings (which modules are active, API key config)

---

## 9. Optional Placeholder Routes (Not Implemented)

Decision: **Do not add placeholder routes in Phase 2B.**

Rationale:
- Placeholder routes require proxy.ts updates (adding to protected routes or handling specially)
- They would create 404-style pages that may confuse beta testers
- Better to add routes when the feature is being actively built
- The architecture plan document serves as the reference for what comes next

Recommendation: Add placeholder routes at the start of Phase 4 (Body/Mind) or Phase 5 (Coach/Goals).

---

## 10. Phase 3 Implementation — Actual vs Planned

### Phase 3A Completed (June 23, 2026)

What was done:
1. ✅ **Finance extraction** — 867→641 lines, 5 components: SimpleSelect, TransactionForm, BudgetForm, AccountForm, BudgetHealthList
2. ✅ **Projects extraction** — 853→454 lines, 4 components: QuickDraftWizard, ProjectForm, ProjectCard, EmptyProjectState
3. ✅ **Today extraction** — 1091→801 lines, 6 components: TodaysPulseHeader, CommandStrip, MissionControl, BodyPulseSection, MindPulseSection, FinanceOverview
4. ✅ **DashboardNav Life OS grouping** — Pulse, Growth, Life Domains, Intelligence, System
5. ✅ **Build + lint passing** after each step

What was deferred to Phase 3B:
- ✅ **Insights extraction** (727→524 lines, 6 components) — **completed**
- ✅ **Onboarding extraction** (823→526 lines, 4 components) — **completed**
- ⏳ Shared data hooks (useHabits, useTasks, useProjects, useFinance, useJournal)
- ⏳ Input CSS migration continuation
- ⏳ Simple cache helper (optional)

### Phase 3B Recommended Prompt

See Phase 3A closeout for the recommended Phase 3B prompt.

---

## 13. Phase 3B Completion Note (June 23, 2026)

### What Changed
- **Insights extraction** (727→524 lines): 6 components in `src/components/insights/` — InsightSkeleton, LevelOverviewCard, MomentumGrid, WeeklyConsistencyCard, HabitStreaksCard, RealmLevelList
- **Onboarding extraction** (823→526 lines): 4 components in `src/components/onboarding/` — StepIndicator, FeatureTour, DailyLoopGrid, FinalSummary
- **10 total component files** used/created, ~500 lines of inline JSX extracted from pages

### Final Line Counts

| Page | Lines |
|------|-------|
| Insights | 524 |
| Onboarding | 526 |
| Settings | 500 |
| Habits | 542 |
| Tasks | 522 |
| Journal | 209 |

### Build Verification
- `npm run lint` ✅ — 0 errors, 2 warnings (pre-existing)
- `npm run build` ✅ — Compiled successfully
- No `typecheck` or `test` scripts exist (build covers TS; only `test:rls` available)

### Remaining Risks
1. Settings/Habits/Tasks/Journal still 500–542 lines (not extracted, but below threshold)
2. Life Balance Map left inline in Insights
3. RealmCards left inline in Onboarding
4. Finance default categories missing (pre-existing)
5. 2 pre-existing lint warnings (cosmetic)
6. No test suite beyond RLS smoke test

### ADRs Updated
- **ADR-002**: Page splits before new features — all 5 target pages done ✅

### Phase 4A Prompt (archived — now completed)

Phase 4A was recommended to add Body Pulse and Mind Pulse foundation. This has been implemented — see Phase 4A Completion Note below.

---

## 14. Phase 4A Completion Note (June 23, 2026)

### What Changed
- **2 new routes**: /body (Body Pulse), /mind (Mind Pulse)
- **12 new component files** — 6 components (3 body, 3 mind), 6 route files (page, loading, error each)
- **Navigation update**: Life Domains now includes Body, Mind, Money
- **Route protection**: /body and /mind added to proxy middleware
- **Today page integration**: Preview cards linking to /body and /mind

### Data Sources Used
| Page | Tables | Key Fields |
|------|--------|------------|
| Body Pulse | habits, tasks, journal_entries, xp_events, habit_logs | realm associations, energy, XP, streaks |
| Mind Pulse | journal_entries, habits, tasks, xp_events | mood, energy, content, reflection_prompt |

### Build Verification
- `npm run lint` ✅ — 0 errors, 2 warnings (pre-existing)
- `npm run build` ✅ — 22 routes generated
- No schema changes, no external dependencies, no wearable integration

### ADRs Updated
- **ADR-004**: Manual Entry Before Wearable Integration — Phase 4A implements manual data from existing tables ✅
- **ADR-006**: No Placeholder Routes — /body and /mind now have real content ✅

### Previously Noted Risks (Now Addressed by Phase 4B)
1. ✅ **Dedicated Body/Mind metrics schema added** — `body_metrics` and `mind_metrics` tables with RLS
2. ⚠️ Pages show empty states for users without Body/Mind realm habits/tasks — unchanged, acceptable for v1
3. Focus habit detection uses heuristic keyword matching — unchanged, acceptable for v1
4. 2 pre-existing lint warnings — unchanged

---

## 15. Phase 4B Completion Note (June 23, 2026)

### What Changed
- **New migration**: `00008_body_mind_metrics.sql` — adds `body_metrics` and `mind_metrics` tables with RLS policies, indexes, and updated_at triggers
- **Body Pulse page** (`/body`): Added `BodyMetricsForm` component (manual entry for sleep, steps, workouts, weight, HR, recovery, energy, notes) + `BodyMetricsSummary` showing last 7 days. Integrated with `body_metrics` table for CRUD via supabase client.
- **Mind Pulse page** (`/mind`): Added `MindMetricsForm` (mood, stress, focus, clarity, motivation, reflection, tags) + `MindMetricsSummary` showing last 7 days. Integrated with `mind_metrics` table.
- **4 new component files** created:
  - `src/components/body/BodyMetricsForm.tsx` — manual entry form with rating rows + numeric inputs
  - `src/components/body/BodyMetricsSummary.tsx` — recent entries list with "Today" badge
  - `src/components/mind/MindMetricsForm.tsx` — manual entry form with rating rows + tags + reflection
  - `src/components/mind/MindMetricsSummary.tsx` — recent entries list with mood/focus/stress preview
- **3 new lib files**: `src/lib/bodyMetrics.ts`, `src/lib/mindMetrics.ts`, and `src/lib/metricSummaries.ts` — TypeScript types + helpers (`getTodayDate`, `avgRecent`, `avg`, `trend`, `loggedToday`, `getToday`, `scoreLabel`)
- **Body/Mind pages reduced** (previously imports only): Body page now 253 lines (was 223 + form logic), Mind page now 247 lines (was 226 + form logic)

### Database Schema Added
```sql
-- body_metrics
sleep_hours numeric(4,2), sleep_quality int(1-5), energy int(1-5),
steps int, workout_minutes int, weight_kg numeric(6,2),
resting_heart_rate int, recovery_score int(0-100), notes text
unique(user_id, entry_date)

-- mind_metrics
mood int(1-5), stress int(1-5), focus int(1-5),
clarity int(1-5), motivation int(1-5),
reflection text, tags text[]
unique(user_id, entry_date)
```

### Build Verification
- `npm run lint` ✅ — 0 errors, 2 warnings (pre-existing)
- `npm run build` ✅ — 25 routes generated (was 22)

### ADRs Updated
- **ADR-004**: Manual entry implemented — body_metrics + mind_metrics tables with manual forms ✅
- **ADR-006**: /body and /mind now have real content with schema backing ✅

### Remaining Risks
1. Pages show empty states for users without Body/Mind realm habits/tasks
2. Focus habit detection uses heuristic keyword matching
3. 2 pre-existing lint warnings

---

## 11. Architecture Decision Records

### ADR-001: Navigation Grouping
**Status:** Accepted (Phase 3)
**Decision:** Pulse → Growth → Life Domains → Intelligence → System
**Rationale:** Clear separation of command center, daily actions, life pillars, analytics, and config.
**Risk:** None — label change only.

### ADR-002: Page Splits Before New Features
**Status:** Accepted (Phase 3)
**Decision:** Extract oversized pages before adding new routes
**Rationale:** Today, finance, projects, insights cannot sustainably grow. Splitting first ensures new features have clean homes.
**Risk:** Medium — extraction must not break existing flows.

### ADR-003: Custom Hooks Before Caching Library
**Status:** Accepted (Phase 3)
**Decision:** Extract domain-specific hooks (useHabits, useTasks, etc.) before evaluating SWR/React Query
**Rationale:** Hooks provide a clean API regardless of caching strategy. Adding a library later is a mechanical refactor if hooks already exist.
**Risk:** Low.

### ADR-004: Manual Entry Before Wearable Integration
**Status:** Accepted (Phase 4+)
**Decision:** Build Body/Mind Pulse with manual entry first; add device integration 1-2 phases later
**Rationale:** Builds the habit of tracking, validates data models, and avoids device API complexity during early user testing.
**Risk:** Low.

### ADR-005: Rule-Based Coach Before LLM Coach
**Status:** Accepted (Phase 5+)
**Decision:** Implement simple rule-based recommendations before adding LLM-powered features
**Rationale:** Rule-based coach adds immediate value with zero cost, no API dependencies, and full privacy.
**Risk:** Low.

### ADR-006: No Placeholder Routes in Phase 2B
**Status:** Accepted
**Decision:** Do not add /body, /mind, /goals, /devices, /coach routes yet
**Rationale:** Placeholder routes suggest readiness that doesn't exist. Add when actively building.
**Risk:** None.

---

## 12. Phase 3A Completion Note (June 23, 2026)

### What Changed
- **Finance extraction** (867→641 lines): 5 new components in `src/components/finance/` — SimpleSelect, TransactionForm, BudgetForm, AccountForm, BudgetHealthList
- **Projects extraction** (853→454 lines): 4 new components in `src/components/projects/` — QuickDraftWizard, ProjectForm, ProjectCard, EmptyProjectState
- **Today extraction** (1091→801 lines): 6 new components in `src/components/today/` — TodaysPulseHeader, CommandStrip, MissionControl, BodyPulseSection, MindPulseSection, FinanceOverview
- **DashboardNav**: Life OS grouping deployed — Pulse, Growth (Habits, Tasks, Projects), Life Domains (Money), Intelligence (Journal, Insights), System (Settings). Mobile nav fully derived from nav groups.
- **15 total component files** created, ~1044 lines of inline JSX extracted from pages

### What Was Deferred
- Insights extraction (727 lines) — next target
- Onboarding extraction (823 lines) — requires careful state decoupling
- Shared data hooks (useHabits, useTasks, useProjects, useFinance, useJournal, useRealm)
- Input CSS migration continuation
- Simple cache helper

### Build Verification
- `npm run lint` ✅ — 0 errors, 2 warnings (pre-existing)
- `npm run build` ✅ — Compiled successfully
- No `typecheck` or `test` scripts exist (build covers TS; only `test:rls` available)

### ADRs Updated
- **ADR-001**: Navigation grouping — implemented ✅
- **ADR-002**: Page splits before new features — partially implemented (3 of 5 pages done)
- **ADR-003**: Custom hooks before caching library — deferred to Phase 3B
