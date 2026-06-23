# Life Pulse — Device Pulse Architecture

**Date:** June 23, 2026
**Status:** Phase 6A — Placeholder route and architecture plan
**Implementation:** No real device integration yet

---

## 1. Purpose

Device Pulse will eventually connect wearable devices and health platforms to bring passive sensor data into Body Pulse and Mind Pulse. Its goal is to turn raw data into useful self-improvement signals — sleep quality trends, recovery scores, activity patterns, stress signals — without requiring users to remember manual entry.

Manual Body/Mind tracking already works. Device sync is designed to augment manual entry, not replace it.

---

## 2. Current State

- **Body Pulse**: Manual entry form for sleep, energy, steps, workouts, weight, heart rate, recovery (+ averages with trends). Data stored in `body_metrics` table.
- **Mind Pulse**: Manual entry form for mood, stress, focus, clarity, motivation, reflection, tags (+ averages with trends). Data stored in `mind_metrics` table.
- **Device Pulse**: Placeholder route at `/devices` exists. No device connections, no provider tokens, no sync jobs, no external APIs.
- **Schema**: 17 app tables. No device-related tables exist.
- **Route count**: 24 routes (23 previous + `/devices`).

### What does NOT exist

- No device connections table
- No device sync runs table
- No device metric samples table
- No provider OAuth tokens
- No sync cron jobs or edge functions
- No wearable/health platform API calls
- No health data import
- No external dependencies

---

## 3. Future Provider Strategy

### Order of implementation

1. **Manual entry** ✅ (Phase 4A/4B) — Body and Mind metrics forms work today
2. **CSV / manual file import** (Phase 6C candidate) — Let users upload exported health data
3. **Apple Health / HealthKit** (later phase) — Requires native iOS app wrapper or App Clip; will follow Apple's HealthKit guidelines
4. **Android Health Connect** (later phase) — Requires Android companion app or Android app; will follow Health Connect guidelines
5. **Oura or other provider APIs** (later phase) — Web API with OAuth; requires user token management
6. **Generic wearable adapter model** (later phase) — Abstract interface for any provider

### Why not direct Bluetooth / cheap smart rings first

- **Closed protocols**: Most inexpensive smart rings use proprietary BLE protocols with no public documentation.
- **Unreliable access**: BLE connections are notoriously unreliable across browsers and operating systems.
- **No public APIs**: Consumer-grade rings rarely expose raw sensor data via open APIs.
- **Privacy/security risks**: Pairing random BLE devices introduces attack surface.
- **Browser BLE limitations**: Web Bluetooth API has restricted access, requires user gesture per connection, and does not work in all browsers.
- **Support burden**: Each device model would require specific reverse-engineering and ongoing maintenance.

The project will focus on platform-level health APIs (Apple Health, Health Connect) and well-documented provider web APIs.

---

## 4. Future Data Model Proposal

No migrations will be created until Phase 6B. The following tables are proposed for discussion:

### 4.1 `device_connections`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid PK` | Primary key |
| `user_id` | `uuid FK -> auth.users` | Row owner |
| `provider` | `text` | Provider name (e.g. 'apple_health', 'oura', 'health_connect') |
| `display_name` | `text` | User-facing label |
| `status` | `text` | 'connected', 'disconnected', 'error' |
| `connected_at` | `timestamptz` | Connection timestamp |
| `last_sync_at` | `timestamptz` | Last successful sync |
| `created_at` | `timestamptz` | Row created |

**RLS**: `user_id = auth.uid()` — users can only see own connections.
**Privacy**: No tokens stored here (see `device_provider_tokens`).
**Phase**: 6B.

### 4.2 `device_sync_runs`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid PK` | Primary key |
| `user_id` | `uuid FK -> auth.users` | Row owner |
| `connection_id` | `uuid FK -> device_connections` | Which connection synced |
| `status` | `text` | 'running', 'completed', 'failed' |
| `samples_fetched` | `integer` | Count of raw samples retrieved |
| `samples_imported` | `integer` | Count of samples written to metric tables |
| `error_message` | `text` | Error detail if failed |
| `started_at` | `timestamptz` | Sync start |
| `ended_at` | `timestamptz` | Sync end |
| `created_at` | `timestamptz` | Row created |

**RLS**: `user_id = auth.uid()`.
**Privacy**: May expose how much health data is synced — acceptable.
**Phase**: 6C or later (after first real provider).

### 4.3 `device_metric_samples`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid PK` | Primary key |
| `user_id` | `uuid FK -> auth.users` | Row owner |
| `connection_id` | `uuid FK -> device_connections` | Source connection |
| `metric_type` | `text` | 'sleep_hours', 'steps', 'heart_rate', 'hrv', 'workout_minutes', 'stress', etc. |
| `value` | `numeric` | Sample value |
| `unit` | `text` | 'hours', 'steps', 'bpm', 'ms', 'minutes', 'score' |
| `recorded_at` | `timestamptz` | When the measurement was taken |
| `source` | `text` | 'apple_health', 'oura', 'manual_import', etc. |
| `raw_payload` | `jsonb` | Original provider payload (optional, for debugging) |
| `created_at` | `timestamptz` | Row created |

**RLS**: `user_id = auth.uid()`.
**Privacy**: Potential data volume concern — time-series data can grow quickly. Partitioning by `metric_type` or time range may be needed.
**Phase**: 6C or later.

### 4.4 `device_provider_tokens`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid PK` | Primary key |
| `user_id` | `uuid FK -> auth.users` | Row owner |
| `provider` | `text` | Provider name |
| `encrypted_access_token` | `text` | Encrypted token |
| `encrypted_refresh_token` | `text` | Encrypted refresh token (if applicable) |
| `token_expires_at` | `timestamptz` | Token expiry |
| `scopes` | `text[]` | Granted permissions |
| `created_at` | `timestamptz` | Row created |
| `updated_at` | `timestamptz` | Row updated |

**RLS**: Should NOT be readable by user sessions. Only server-side code (edge functions or API routes) should access this table. Consider `security barrier` or a separate private schema.
**Privacy**: HIGH — contains OAuth tokens that grant health data access.
**Phase**: 6D or later, after first real provider is chosen.
**Note**: If a serverless approach is preferred, tokens could be stored in Supabase Vault (encrypted secrets storage) instead of a raw table.

---

## 5. Provider Abstraction

Future interface (types only, no implementation):

```typescript
interface DeviceProvider {
  name: string;
  displayName: string;
  connect(userId: string): Promise<{ success: boolean; error?: string }>;
  disconnect(userId: string): Promise<void>;
  sync(userId: string, since: Date): Promise<SyncResult>;
  mapSamples(raw: unknown[]): DeviceMetricSample[];
  getStatus(userId: string): Promise<ProviderStatus>;
}

interface SyncResult {
  success: boolean;
  samplesFetched: number;
  samplesImported: number;
  error?: string;
}

interface ProviderStatus {
  connected: boolean;
  lastSyncAt: Date | null;
  error?: string;
}
```

No implementation yet. This interface will be refined when the first real provider is integrated.

---

## 6. Privacy and Security Requirements

### Principles

- **User-controlled connections**: Device sync must be opt-in, per-provider, with clear explanation of what data is accessed.
- **Ability to disconnect**: Users must be able to revoke access at any time, which deletes tokens and stops sync.
- **Ability to delete imported data**: Users must be able to delete all imported device data independently of manual entries.
- **No service role in frontend**: Token decryption and provider API calls must happen server-side (edge functions or API routes).
- **Token encryption**: Provider tokens must be encrypted at rest and only decrypted server-side.
- **Clear data provenance**: Every metric sample must be tagged with its source (`manual`, `apple_health`, `oura`, etc.) so users can distinguish imported data from manual logs.

### Auditability

- Every sync run is logged (`device_sync_runs`)
- Every imported sample is traceable to its source connection and provider
- Manual and imported data are stored in separate tables or tagged with `source` column

---

## 7. Recommended Implementation Phases

### Phase 6B — Device Pulse Schema Planning + Connection Placeholder

- Create `device_connections` table (proposal above)
- Build UI list of future providers (no real connection)
- Add "connect" button that shows "Not available yet" state
- Update `/devices` page to show connection list
- No tokens, no sync, no external APIs

### Phase 6C — CSV / Manual Import (if useful)

- Allow users to upload exported health data (CSV, JSON)
- Parse and insert into `device_metric_samples`
- Tag with source `manual_import`
- No provider OAuth yet

### Phase 6D — Choose First Real Provider

- Evaluate Oura API, Apple Health (via native app), or Health Connect
- Implement provider abstraction for one provider
- Create `device_provider_tokens` table with encrypted token storage
- Build sync flow (server-side edge function)

### Phase 6E — Provider Integration Behind Feature Flag

- First provider live behind a feature flag
- Sync scheduling (daily or on-demand)
- Error handling and retry
- User notifications for sync failures

---

## 8. Relationship to Other Systems

| System | Relationship |
|--------|-------------|
| **Body Pulse** | Device sleep, steps, HR, workouts, recovery samples feed into Body metrics and trends |
| **Mind Pulse** | Device stress/focus signals may feed into Mind metrics |
| **Insights** | Device data will enrich trend charts and pattern detection |
| **Journal** | Device data may inform reflection prompts (e.g., "Your HRV was low today — how do you feel?") |
| **Goals** | Device data may support goal tracking (e.g., "Walk 10,000 steps daily") |
| **Coach** | Device data will be a primary input for rule-based and AI recommendations |
