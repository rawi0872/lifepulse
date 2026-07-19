# Future AI Assistant Foundation — Life Pulse Assistant

## Purpose
Design the permission-controlled, evidence-based, transparent "Life Pulse Assistant" as an optional intelligence layer. It must never diagnose, advise on medical/therapy/financial/legal matters, claim causation, or shame users. It is read-only by default; writes require explicit confirmation.

---

## 1. Current Coach — Deterministic Baseline

The existing Coach (`src/lib/coach.ts`) is **deterministic, rule-based, zero-AI**:
- Inputs: `CoachData` (boolean flags, counts from last 7 days)
- Output: `CoachInsight[]` — prioritized prompts linking to existing pages
- Rules: 30+ explicit `if` conditions (body not logged, high-priority tasks, weekly review timing, etc.)
- Safety: Explicit "no AI", "no advice", "optional prompts" copy on every surface

**This remains the fallback and audit baseline.** Any AI layer must be able to explain its output by referencing the same data the deterministic coach uses.

---

## 2. Assistant Scope & Data Access

### Domain-Specific Permissions
Users grant/deny per domain. Default: **denied**.

| Domain | Data Types | Sensitivity |
|--------|------------|-------------|
| Journal | Entry content, mood, energy, tags | High |
| Finance | Transactions, balances, categories, recurring | High |
| Body | Metrics, workouts, measurements, nutrition | High |
| Mind | Mood, stress, focus, clarity, reflection | High |
| Goals | Titles, status, milestones, links | Medium |
| Projects | Names, tasks, links | Medium |
| Habits | Titles, frequency, completion dates | Medium |
| Tasks | Titles, priority, status, due dates | Medium |
| Knowledge | Saved items, collections | Low |
| Passions | Names, sessions, milestones | Low |
| Weekly Review | Saved reflections, focus areas | Medium |
| Insights | Computed trends (read-only) | Low |

### Permission Model
```typescript
interface AssistantPermissions {
  journal: boolean;
  finance: boolean;
  body: boolean;
  mind: boolean;
  goals: boolean;
  projects: boolean;
  habits: boolean;
  tasks: boolean;
  knowledge: boolean;
  passions: boolean;
  weeklyReview: boolean;
  insights: boolean;
}
```
- Stored in `profiles.assistant_permissions` (jsonb) or new `assistant_permissions` table
- Revocable at any time from Settings → Assistant
- Audit log: every grant/revoke recorded with timestamp

### Data Retrieval Boundary
- **Read-only by default** — Assistant queries Supabase via server-side function with `auth.uid()` context
- **No cross-user access** — RLS enforces ownership
- **No external API calls** in v1 — all data from Supabase
- **Bounded context** — Each request specifies `domain` + `time_window` (e.g., "last 30 days"); function enforces limits

---

## 3. Response Structure

Every assistant response follows this schema:

```typescript
interface AssistantResponse {
  // 1. What was observed (factual, cited)
  observations: {
    domain: string;
    timeWindow: string;
    dataPoints: string[];  // e.g., "Journal: 12 entries last 30 days", "Finance: $2,340 net cash flow"
    citations: string[];   // Supabase table + filters used
  }[];

  // 2. Data used & limitations
  dataUsed: {
    domains: string[];
    timeWindow: string;
    gaps: string[];  // e.g., "No finance data (permission denied)", "Journal: 3 entries only"
    confidence: 'high' | 'medium' | 'low' | 'insufficient';
  };

  // 3. Possible interpretation (not advice)
  interpretations: {
    label: string;
    basis: string;  // "Based on 12 journal entries showing mood avg 2.8/5..."
    alternative: string;  // "Could also reflect seasonal variation"
    confidence: 'low' | 'medium' | 'high';
  }[];

  // 4. Optional next actions (links to existing pages)
  suggestedActions: {
    label: string;
    href: string;
    reason: string;  // "Review journal entries to add context"
  }[];

  // 5. Explicit non-claims
  disclaimers: string[];  // "Not medical advice. Not financial advice. Correlation ≠ causation."
}
```

### Example
> **Observations:**
> - Journal: 8 entries last 14 days, mood avg 2.6/5, energy avg 2.1/5
> - Habits: "Evening walk" current streak 5, best 12
> - Finance: Permission denied
>
> **Data Used:** Journal, Habits. **Gaps:** Finance (denied), Body (no data). **Confidence:** Low.
>
> **Interpretation:** "Mood and energy trending below personal average. Evening walk streak suggests one consistent anchor."
> **Alternative:** "Could reflect work project deadline; insufficient data to attribute."
>
> **Suggested Actions:** [Open Journal] [Review Habits] [Run Weekly Review]
>
> **Disclaimers:** Not medical/therapy advice. Correlation ≠ causation. Data insufficient for conclusions.

---

## 4. Permission & Consent Flow

### Settings UI
```
Settings → Life Pulse Assistant
├── Status: [Enabled / Disabled]
├── Data Access:
│   ☐ Journal (private reflections, mood, energy)
│   ☐ Finance (transactions, balances, categories)
│   ☐ Body (metrics, workouts, measurements)
│   ☐ Mind (daily check-ins, tags)
│   ☐ Goals & Projects
│   ☐ Habits & Tasks
│   ☐ Knowledge & Passions
│   ☐ Weekly Reviews & Insights
├── Conversation Retention: [30 days / 90 days / 1 year / Until deleted]
├── [Revoke All] [Audit Log]
```

### First-Time Consent
- Modal on first Assistant visit: "The Assistant reads your permitted data to surface patterns. It cannot create, edit, or delete anything. You control every domain."
- No domain pre-checked.

---

## 5. Conversation & Retention

### Storage
```sql
create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  response_data jsonb,  // full AssistantResponse for assistant messages
  created_at timestamptz not null default now()
);
```
- RLS: `auth.uid() = user_id` on both tables
- User can delete individual conversations or all

### Prompt Injection Protection
- **Never** include raw user journal/finance content in the system prompt
- User content → summarized server-side → passed as structured `observations`
- Model sees only: observations, dataUsed, and user's question
- **No** raw PII, full transaction lists, or journal text sent to model

### Provider Abstraction
```typescript
interface AssistantProvider {
  name: string;
  generateResponse(observations: Observations, question: string): Promise<AssistantResponse>;
  estimateTokens(input: string): number;
}

// v1: Deterministic fallback (current Coach rules + templates)
// v2: Pluggable — OpenAI, Anthropic, local, etc.
// Cost control: max tokens per request, daily budget per user
```

---

## 6. Deterministic Fallback (v1)

**No external model in Phase 1.** The "Assistant" is the current deterministic Coach with:
- Enhanced data gathering (uses same `CoachData` + Results adapters)
- Structured `AssistantResponse` output
- Explicit "Data Used" and "Gaps" sections
- Same safety copy

This validates the permission model, UI, and response structure before any LLM integration.

---

## 7. Audit Trail

```sql
create table public.assistant_audit_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('permission_grant', 'permission_revoke', 'conversation_delete', 'data_export', 'model_call')),
  domain text,
  details jsonb,
  created_at timestamptz not null default now()
);
```
- Immutable, append-only
- Visible in Settings → Assistant → Audit Log
- Included in user data export (GDPR/CCPA)

---

## 8. Safety Checklist (Every Release)

| Check | Method |
|-------|--------|
| No medical/therapy/financial/legal advice in output | Automated test: forbidden phrases in `assistant_messages.content` |
| No causation claims | Test: "caused", "because of", "resulted in" absent from interpretations |
| No shaming language | Test: "should", "must", "failed", "bad", "wrong" absent |
| Permissions enforced | Integration test: deny finance → finance absent from observations |
| No silent writes | Code review: no `insert`/`update`/`delete` in assistant code path |
| Conversation deletable | Manual test: delete conversation → messages gone |
| Export includes audit log | Manual test: data export JSON contains `assistant_audit_log` |
| Cost control | Unit test: `estimateTokens` + daily budget enforced |

---

## 9. Future Phases

| Phase | Scope |
|-------|-------|
| 0 (Now) | Deterministic Coach in `AssistantResponse` format, permission model, audit log |
| 1 | LLM integration (single provider) with prompt injection protection, token budgets |
| 2 | Multi-provider abstraction, local model option |
| 3 | Proactive notifications (opt-in): "Your savings rate dropped 15% this month" |
| 4 | Cross-domain pattern detection: "When sleep < 6h, next-day mood avg -0.8" (with confidence) |
| 5 | User-defined "If X then notify me" rules (deterministic, not AI) |

---

## 10. Open Questions

1. **Model fine-tuning vs RAG**: Start with RAG (Supabase data → structured observations → prompt). Fine-tuning only if latency/quality demands it.
2. **Offline/local model**: Bundle quantized model for desktop PWA? Phase 2+.
3. **Shared conversations**: User shares a conversation with a partner/coach? Requires explicit export → import, not live sharing.
4. **Voice interface**: Future; same permission model applies.
5. **Cost recovery**: If LLM costs materialize, optional "Assistant Pro" tier? Keep core deterministic free.

---

## 11. Acceptance Criteria (Phase 0)

- [ ] `assistant_permissions` column on `profiles` (jsonb default `'{}'`)
- [ ] `assistant_conversations`, `assistant_messages`, `assistant_audit_log` tables + RLS
- [ ] Settings → Assistant UI: grant/revoke domains, retention, audit log, revoke all
- [ ] Coach refactored to return `AssistantResponse` (deterministic)
- [ ] Assistant page: chat UI, permission gate, structured response rendering
- [ ] No external API calls; all data from Supabase via server function
- [ ] All existing tests pass; new tests for permission enforcement + response structure
- [ ] Documentation: `docs/future-ai-assistant-foundation.md` (this file)