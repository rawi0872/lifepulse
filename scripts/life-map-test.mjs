import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${message}`);
}

const graph = read("src/lib/life-map.ts");
const route = read("src/app/api/life-map/route.ts");
const page = read("src/app/life-map/page.tsx");
const evidence = read("src/lib/nextron/evidence.ts");
const rich = read("src/lib/nextron/rich-response.ts");
const nav = read("src/components/DashboardNav.tsx");
const coachPage = read("src/app/coach/page.tsx");
const actions = read("src/lib/nextron/actions.ts");
const relationshipMigration = read("supabase/migrations/00034_nextron_life_map_relationship_actions.sql");

assert(graph.includes('version: "life-map-v1"') && graph.includes("modelCalls: 0"), "Life Map contract is versioned and declares zero model calls");
assert(graph.includes('.from("goal_links")') && graph.includes('linked_type === "project"') && graph.includes('linked_type === "task"') && graph.includes('linked_type === "habit"'), "Life Map uses explicit goal_links for goal relationships");
assert(graph.includes('.from("tasks")') && graph.includes("project_id") && graph.includes('type: "project_task"'), "Life Map uses canonical task project_id for project-task edges");
assert(!graph.includes("embedding") && !graph.includes("vector") && !graph.includes("openai") && !graph.includes("anthropic") && !graph.includes("Graphiti") && !graph.includes("Supermemory"), "Life Map graph builder has no AI, vector, Graphiti, or Supermemory dependency");
assert(route.includes("auth.getUser()") && route.includes("buildLifeMapGraph(supabase, user.id)") && !route.includes("service_role"), "Life Map API is authenticated and owner scoped through Supabase RLS");
assert(page.includes('fetch("/api/life-map"') && page.includes("No AI, embeddings, or inferred connections") && page.includes("Focus Mode") && page.includes("Connected Paths"), "Life Map route renders from API data with explicit-only copy, connected paths, and focus mode");
assert(nav.includes('href: "/life-map"') && nav.includes('label: "Life Map"'), "Navigation exposes Life Map");
assert(evidence.includes("relationships") && evidence.includes("summarizeLifeMapForNextron") && evidence.includes("canLoadRelationships"), "NEXTRON gets only a bounded Life Map relationship summary");
assert(rich.includes('"/life-map"') && rich.includes("life_map") && rich.includes("explicitLinks"), "Rich responses can point to Life Map without arbitrary routes");
assert(actions.includes('"life_pulse.goal.link"') && actions.includes('"life_pulse.goal.unlink"') && actions.includes("resolveLinkable"), "NEXTRON relationship actions are typed and exact-title resolved server-side before proposal");
assert(coachPage.includes("connect|link|attach") && coachPage.includes("explicit relationship proposals"), "NEXTRON UI routes relationship verbs through Prompt 3 proposal UX");
assert(relationshipMigration.includes("nextron_relationship_target_permission_allowed") && relationshipMigration.includes("allow_project_actions") && relationshipMigration.includes("allow_habit_actions") && relationshipMigration.includes("allow_task_actions"), "Relationship execution requires Goal write plus target-domain write permission");
assert(relationshipMigration.includes("on conflict (user_id, goal_id, linked_type, linked_id) do nothing") && relationshipMigration.includes("mutation', case when v_id is null then 'existing'") && relationshipMigration.includes("mutation', case when v_id is null then 'absent'"), "Relationship link/unlink execution is duplicate-safe and absent-safe");
assert(relationshipMigration.includes("where id = v_goal_id and user_id = p_user_id") && relationshipMigration.includes("where id = v_linked_id and user_id = p_user_id"), "Relationship execution revalidates owner and target existence");
assert(graph.includes("const TASK_NODE_LIMIT = 80") && graph.includes(".limit(TASK_NODE_LIMIT)"), "Life Map task expansion has a hard node bound");

if (process.exitCode) process.exit(1);
console.log("Life Map v1 contract checks passed.");
