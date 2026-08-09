# NEXTRON Rich Responses

Prompt 4 adds a versioned presentation layer for NEXTRON answers. Rich responses are stored inside the existing assistant `response` JSON on `nextron_messages`; no new database table or migration is required.

## Contract

- Version: `nextron-rich-response-v1`.
- Allowed blocks: `metric_strip`, `priority_list`, `entity_list`, `evidence`, `empty_state`.
- Blocks are bounded by count, item count, string length, source category, and safe internal routes.
- Unknown or malformed rich responses are ignored by the client validator.
- Rich UI is omitted for unsupported/general non-Life-Pulse prompts where a dashboard would not help the answer.

## Grounding

- Blocks are built server-side from the already-permitted `NextronEvidencePacket` and the validated NEXTRON answer.
- Block type selection is deterministic from the parsed request intent and normalized prompt; the model can influence explanation/rationale but does not choose arbitrary components.
- The model does not emit React, JSX, HTML, CSS, JavaScript, URLs, or endpoints.
- Trends and telemetry are not invented; displayed numbers come from existing packet fields.
- Rich blocks do not persist arbitrary entity IDs. Entity names and counts are bounded snapshots derived from owner-scoped evidence builders.

## Persistence And Cost

- Rich UI is attached during the existing `/api/nextron/ask` request.
- Rendering, history loading, and block expansion do not call a model.
- `modelCalls` is fixed at `0` for the rich UI builder because it is deterministic presentation over existing response data.
- Persisted rich blocks are historical snapshots of what NEXTRON showed at response time. They are not silently re-resolved against newer database state when conversation history is reopened.

## Safety Boundary

- Rich blocks are presentation only.
- Prompt 3 Action Preview remains the only mutation path.
- Rich responses do not approve, execute, cancel, or shortcut action proposals.
- Calendar and external connector behavior remains read-only.

## Deliberate Limitations

- Trend/comparison charts are not implemented in Prompt 4 because the current answer packet does not expose enough validated historical series data for trustworthy charts.
- Proactive Signals delivery is not implemented here. Attention-style rich blocks use current permitted evidence already available to the ask flow, not background monitoring.
