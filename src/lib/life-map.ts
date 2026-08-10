import type { SupabaseClient } from "@supabase/supabase-js";

export type LifeMapNodeType = "goal" | "project" | "task" | "habit";
export type LifeMapEdgeType = "goal_project" | "goal_task" | "goal_habit" | "project_task";

export interface LifeMapNode {
  id: string;
  type: LifeMapNodeType;
  title: string;
  status: string | null;
  realm: { name: string; color: string; icon: string } | null;
  counts?: { openTasks?: number; linkedGoals?: number };
}

export interface LifeMapEdge {
  id: string;
  type: LifeMapEdgeType;
  source: string;
  target: string;
  label: string;
  explicit: true;
}

export interface LifeMapGraph {
  version: "life-map-v1";
  modelCalls: 0;
  generatedAt: string;
  nodes: LifeMapNode[];
  edges: LifeMapEdge[];
  stats: {
    goals: number;
    projects: number;
    tasks: number;
    habits: number;
    explicitLinks: number;
    unlinkedActiveGoals: number;
    activeProjectsWithoutOpenTask: number;
  };
  empty: boolean;
}

const TASK_NODE_LIMIT = 80;

interface RealmJoin { name: string | null; color: string | null; icon: string | null }
interface GoalRow { id: string; title: string | null; status: string | null; realm_id: string | null; realms?: RealmJoin | RealmJoin[] | null }
interface ProjectRow { id: string; title: string | null; status: string | null; realm_id: string | null; realms?: RealmJoin | RealmJoin[] | null }
interface TaskRow { id: string; title: string | null; status: string | null; project_id: string | null; realm_id: string | null; realms?: RealmJoin | RealmJoin[] | null }
interface HabitRow { id: string; title: string | null; frequency: string | null; realm_id: string | null; realms?: RealmJoin | RealmJoin[] | null }
interface GoalLinkRow { id: string; goal_id: string | null; linked_type: "project" | "task" | "habit" | string | null; linked_id: string | null }

function cleanTitle(value: string | null | undefined, fallback: string) {
  const title = value?.replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 120) : fallback;
}

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function realmFrom(row: { realms?: RealmJoin | RealmJoin[] | null }) {
  const realm = firstJoin(row.realms);
  if (!realm?.name) return null;
  return {
    name: cleanTitle(realm.name, "Realm"),
    color: realm.color ?? "#6366f1",
    icon: realm.icon ?? "*",
  };
}

function nodeId(type: LifeMapNodeType, id: string) {
  return `${type}:${id}`;
}

export async function buildLifeMapGraph(supabase: SupabaseClient, userId: string): Promise<LifeMapGraph> {
  const [goalsRes, projectsRes, tasksRes, habitsRes, linksRes] = await Promise.all([
    supabase
      .from("goals")
      .select("id, title, status, realm_id, realms(name, color, icon)")
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("projects")
      .select("id, title, status, realm_id, realms(name, color, icon)")
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("tasks")
      .select("id, title, status, project_id, realm_id, realms(name, color, icon)")
      .eq("user_id", userId)
      .eq("status", "todo")
      .order("created_at", { ascending: false })
      .limit(TASK_NODE_LIMIT),
    supabase
      .from("habits")
      .select("id, title, frequency, realm_id, realms(name, color, icon)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("goal_links")
      .select("id, goal_id, linked_type, linked_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  if (goalsRes.error || projectsRes.error || tasksRes.error || habitsRes.error || linksRes.error) {
    throw new Error("Life Map data could not be loaded.");
  }

  const goals = (goalsRes.data ?? []) as unknown as GoalRow[];
  const projects = (projectsRes.data ?? []) as unknown as ProjectRow[];
  const tasks = (tasksRes.data ?? []) as unknown as TaskRow[];
  const habits = (habitsRes.data ?? []) as unknown as HabitRow[];
  const links = (linksRes.data ?? []) as unknown as GoalLinkRow[];
  const nodes: LifeMapNode[] = [];
  const edges: LifeMapEdge[] = [];
  const seenEdges = new Set<string>();
  const projectIds = new Set(projects.map((project) => project.id));
  const taskIds = new Set(tasks.map((task) => task.id));
  const habitIds = new Set(habits.map((habit) => habit.id));
  const goalIds = new Set(goals.map((goal) => goal.id));
  const linkedGoalIds = new Set<string>();
  const openTasksByProject = new Map<string, number>();
  const linkedGoalsByNode = new Map<string, number>();

  for (const task of tasks) {
    if (task.project_id) openTasksByProject.set(task.project_id, (openTasksByProject.get(task.project_id) ?? 0) + 1);
  }

  function addEdge(edge: LifeMapEdge) {
    const key = `${edge.type}:${edge.source}:${edge.target}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push(edge);
  }

  for (const link of links) {
    if (!link.goal_id || !link.linked_id || !goalIds.has(link.goal_id)) continue;
    const source = nodeId("goal", link.goal_id);
    linkedGoalIds.add(link.goal_id);
    if (link.linked_type === "project" && projectIds.has(link.linked_id)) {
      linkedGoalsByNode.set(nodeId("project", link.linked_id), (linkedGoalsByNode.get(nodeId("project", link.linked_id)) ?? 0) + 1);
      addEdge({ id: link.id, type: "goal_project", source, target: nodeId("project", link.linked_id), label: "supports", explicit: true });
    }
    if (link.linked_type === "task" && taskIds.has(link.linked_id)) {
      linkedGoalsByNode.set(nodeId("task", link.linked_id), (linkedGoalsByNode.get(nodeId("task", link.linked_id)) ?? 0) + 1);
      addEdge({ id: link.id, type: "goal_task", source, target: nodeId("task", link.linked_id), label: "drives", explicit: true });
    }
    if (link.linked_type === "habit" && habitIds.has(link.linked_id)) {
      linkedGoalsByNode.set(nodeId("habit", link.linked_id), (linkedGoalsByNode.get(nodeId("habit", link.linked_id)) ?? 0) + 1);
      addEdge({ id: link.id, type: "goal_habit", source, target: nodeId("habit", link.linked_id), label: "reinforced by", explicit: true });
    }
  }

  for (const task of tasks) {
    if (!task.project_id || !projectIds.has(task.project_id)) continue;
    addEdge({ id: `project-task:${task.project_id}:${task.id}`, type: "project_task", source: nodeId("project", task.project_id), target: nodeId("task", task.id), label: "contains", explicit: true });
  }

  nodes.push(...goals.map((goal) => ({ id: nodeId("goal", goal.id), type: "goal" as const, title: cleanTitle(goal.title, "Untitled goal"), status: goal.status, realm: realmFrom(goal) })));
  nodes.push(...projects.map((project) => ({ id: nodeId("project", project.id), type: "project" as const, title: cleanTitle(project.title, "Untitled project"), status: project.status, realm: realmFrom(project), counts: { openTasks: openTasksByProject.get(project.id) ?? 0, linkedGoals: linkedGoalsByNode.get(nodeId("project", project.id)) ?? 0 } })));
  nodes.push(...tasks.map((task) => ({ id: nodeId("task", task.id), type: "task" as const, title: cleanTitle(task.title, "Untitled task"), status: task.status, realm: realmFrom(task), counts: { linkedGoals: linkedGoalsByNode.get(nodeId("task", task.id)) ?? 0 } })));
  nodes.push(...habits.map((habit) => ({ id: nodeId("habit", habit.id), type: "habit" as const, title: cleanTitle(habit.title, "Untitled habit"), status: habit.frequency, realm: realmFrom(habit), counts: { linkedGoals: linkedGoalsByNode.get(nodeId("habit", habit.id)) ?? 0 } })));

  const unlinkedActiveGoals = goals.filter((goal) => goal.status === "active" && !linkedGoalIds.has(goal.id)).length;
  const activeProjectsWithoutOpenTask = projects.filter((project) => project.status === "active" && (openTasksByProject.get(project.id) ?? 0) === 0).length;

  return {
    version: "life-map-v1",
    modelCalls: 0,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    stats: {
      goals: goals.length,
      projects: projects.length,
      tasks: tasks.length,
      habits: habits.length,
      explicitLinks: edges.length,
      unlinkedActiveGoals,
      activeProjectsWithoutOpenTask,
    },
    empty: nodes.length === 0,
  };
}

export function summarizeLifeMapForNextron(graph: LifeMapGraph) {
  return {
    version: graph.version,
    modelCalls: graph.modelCalls,
    explicitLinks: graph.stats.explicitLinks,
    unlinkedActiveGoals: graph.stats.unlinkedActiveGoals,
    activeProjectsWithoutOpenTask: graph.stats.activeProjectsWithoutOpenTask,
    visibleCounts: {
      goals: graph.stats.goals,
      projects: graph.stats.projects,
      tasks: graph.stats.tasks,
      habits: graph.stats.habits,
    },
  };
}
