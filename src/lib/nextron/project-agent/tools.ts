import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { isNextronContextAllowed, type NextronPermissionState } from "@/lib/nextron/context";
import { PROJECT_AGENT_MAX_TOOL_CALLS, type ProjectAgentToolName } from "@/lib/nextron/project-agent/schemas";

export interface NextronToolContext {
  userId: string;
  permissions: NextronPermissionState;
  supabase: SupabaseClient;
  requestId: string;
}

interface ProjectRow { id: string; title: string | null; description: string | null; status: string | null; deadline: string | null; progress: number | null; updated_at: string | null }
interface TaskRow { title: string | null; status: string | null; priority: string | null; due_date: string | null; project_id: string | null }
interface GoalRow { title: string | null; status: string | null }
interface GoalLinkRow { goal_id: string | null; linked_id: string | null }

function safeText(value: string | null | undefined, max = 120): string | null {
  const text = value?.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>]/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return text ? text.slice(0, max) : null;
}

function requireAllowed(context: NextronToolContext, domain: "projects" | "tasks" | "goals") {
  if (!isNextronContextAllowed(context.permissions, domain)) throw new Error("PERMISSION_DENIED");
}

export function createNextronProjectAgentTools(context: NextronToolContext, trace: ProjectAgentToolName[], evidenceSink: unknown[] = []) {
  let firstProjectId: string | null = null;

  function record(tool: ProjectAgentToolName) {
    trace.push(tool);
    if (trace.length > PROJECT_AGENT_MAX_TOOL_CALLS) throw new Error("TOOL_LIMIT_EXCEEDED");
  }

  function remember<T>(output: T): T {
    evidenceSink.push(output);
    return output;
  }

  async function loadProjects(limit = 8) {
    requireAllowed(context, "projects");
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, title, description, status, deadline, progress, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("PROJECT_READ_FAILED");
    const rows = (data ?? []) as ProjectRow[];
    firstProjectId = rows[0]?.id ?? null;
    return rows.map((project, index) => {
      return {
        listPosition: index + 1,
        title: safeText(project.title, 80) ?? "Untitled project",
        status: safeText(project.status, 24) ?? "unknown",
        deadline: project.deadline,
        progress: Number.isFinite(project.progress) ? project.progress : null,
      };
    });
  }

  async function resolveProjectId(input: { projectTitle?: string }) {
    const title = safeText(input.projectTitle, 80)?.toLowerCase();
    if (!title) {
      if (firstProjectId) return firstProjectId;
      await loadProjects(1);
      return firstProjectId;
    }
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, title")
      .eq("user_id", context.userId)
      .ilike("title", `%${title.replace(/[%_]/g, "")}%`)
      .limit(5);
    if (error) throw new Error("PROJECT_READ_FAILED");
    const match = ((data ?? []) as Array<{ id: string; title: string | null }>).find((project) => safeText(project.title, 80)?.toLowerCase().includes(title));
    return match?.id ?? null;
  }

  const projectInput = z.object({ projectTitle: z.string().max(80).optional() });

  const getProjects = createTool({
    id: "getProjects",
    description: "List the authenticated user's bounded projects. Use this first when the project is unnamed or says this project.",
    inputSchema: z.object({}),
    execute: async () => {
      record("getProjects");
      return remember({ projects: await loadProjects() });
    },
  });

  const getProject = createTool({
    id: "getProject",
    description: "Read one authenticated user project by visible title, or omit title to inspect the first bounded project. Returns sanitized fields only.",
    inputSchema: projectInput,
    execute: async (input) => {
      record("getProject");
      requireAllowed(context, "projects");
      const projectId = await resolveProjectId(input);
      if (!projectId) throw new Error("PROJECT_NOT_FOUND");
      const { data, error } = await context.supabase
        .from("projects")
        .select("id, title, description, status, deadline, progress, updated_at")
        .eq("user_id", context.userId)
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw new Error("PROJECT_READ_FAILED");
      const project = data as ProjectRow | null;
      if (!project) throw new Error("PROJECT_NOT_FOUND");
      return remember({ project: { title: safeText(project.title, 80) ?? "Untitled project", description: safeText(project.description, 180), status: safeText(project.status, 24) ?? "unknown", deadline: project.deadline, progress: Number.isFinite(project.progress) ? project.progress : null } });
    },
  });

  const getProjectTasks = createTool({
    id: "getProjectTasks",
    description: "Read bounded tasks for one authenticated user project. Use this to identify blockers and next action. Read-only.",
    inputSchema: projectInput,
    execute: async (input) => {
      record("getProjectTasks");
      requireAllowed(context, "tasks");
      const projectId = await resolveProjectId(input);
      if (!projectId) throw new Error("PROJECT_NOT_FOUND");
      const { data, error } = await context.supabase
        .from("tasks")
        .select("title, status, priority, due_date, project_id")
        .eq("user_id", context.userId)
        .eq("project_id", projectId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(12);
      if (error) throw new Error("TASK_READ_FAILED");
      return remember({ tasks: ((data ?? []) as TaskRow[]).map((task) => ({ title: safeText(task.title, 80) ?? "Untitled task", status: safeText(task.status, 20) ?? "unknown", priority: safeText(task.priority, 20) ?? "medium", dueDate: task.due_date })) });
    },
  });

  const tools: Record<string, ReturnType<typeof createTool>> = { getProjects, getProject, getProjectTasks };
  if (isNextronContextAllowed(context.permissions, "goals")) {
    tools.getGoals = createTool({
      id: "getGoals",
      description: "Read active goals linked to the authenticated user's selected project. Read-only and sanitized.",
      inputSchema: projectInput,
      execute: async (input) => {
        record("getGoals");
        requireAllowed(context, "goals");
        const projectId = await resolveProjectId(input);
        if (!projectId) throw new Error("PROJECT_NOT_FOUND");
        const links = await context.supabase.from("goal_links").select("goal_id, linked_id").eq("user_id", context.userId).eq("linked_type", "project").eq("linked_id", projectId).limit(8);
        if (links.error) throw new Error("GOAL_READ_FAILED");
        const goalIds = ((links.data ?? []) as GoalLinkRow[]).map((link) => link.goal_id).filter((id): id is string => Boolean(id));
        if (goalIds.length === 0) return remember({ goals: [] });
        const goals = await context.supabase.from("goals").select("title, status").eq("user_id", context.userId).in("id", goalIds).limit(8);
        if (goals.error) throw new Error("GOAL_READ_FAILED");
        return remember({ goals: ((goals.data ?? []) as GoalRow[]).map((goal) => ({ title: safeText(goal.title, 80) ?? "Untitled goal", status: safeText(goal.status, 24) ?? "unknown" })) });
      },
    });
  }
  return tools;
}
