# Life Map v1

Life Map is a read-only projection of explicit Life Pulse relationships.

## Sources

- Goals, Projects, Tasks, and Habits are loaded from owner-scoped Supabase queries.
- Goal relationships come from `goal_links` only.
- Project to Task relationships come from `tasks.project_id` only.

## Non-Goals

- No AI call renders `/life-map`.
- No embeddings, vector search, Graphiti, or Supermemory are used.
- No title similarity, semantic matching, or background discovery creates relationships.
- NEXTRON receives only a bounded relationship summary, not the full graph.

## Contract

- API route: `/api/life-map`
- UI route: `/life-map`
- Version: `life-map-v1`
- `modelCalls: 0`
- Edges are marked `explicit: true` because they come from canonical user data.

## Bounds

- Goals: 80 active/paused rows.
- Projects: 120 active/paused rows.
- Habits: 120 rows.
- Open Task nodes: 80 newest open rows.
- Goal links: 500 rows.
- Project cards retain open-task counts even when not every Task is rendered as a node.

## Relationship Actions

NEXTRON can propose explicit relationship mutations through the existing Prompt 3 action framework only:

- `life_pulse.goal.link`
- `life_pulse.goal.unlink`
- `life_pulse.task.update` for Task -> Project assignment

Relationship writes require proposal creation, saved write permissions, explicit approval, server execution, and stale-state verification. Goal relationship actions require Goal write permission plus the target domain write permission (`Project`, `Task`, or `Habit`). Unlinking removes only the `goal_links` row and never deletes an entity.
