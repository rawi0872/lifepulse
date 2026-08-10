"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import type { LifeMapEdge, LifeMapGraph, LifeMapNode, LifeMapNodeType } from "@/lib/life-map";

const TYPE_LABELS: Record<LifeMapNodeType, string> = {
  goal: "Goal",
  project: "Project",
  task: "Task",
  habit: "Habit",
};

const TYPE_COLORS: Record<LifeMapNodeType, string> = {
  goal: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  project: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  task: "border-violet-300/25 bg-violet-300/10 text-violet-100",
  habit: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
};

const COLUMN_META: Array<{ type: LifeMapNodeType; title: string; subtitle: string }> = [
  { type: "goal", title: "Direction", subtitle: "Active and paused goals" },
  { type: "project", title: "Projects", subtitle: "Outcome containers" },
  { type: "task", title: "Visible Actions", subtitle: "Open tasks only" },
  { type: "habit", title: "Rhythms", subtitle: "Recurring support" },
];

interface LifeMapResponse { graph?: LifeMapGraph; error?: string }

function nodeHref(node: LifeMapNode) {
  if (node.type === "goal") return "/goals";
  if (node.type === "project") return "/projects";
  if (node.type === "task") return "/tasks";
  return "/habits";
}

function edgeLabel(edge: LifeMapEdge) {
  if (edge.type === "goal_project") return "Goal -> Project";
  if (edge.type === "goal_task") return "Goal -> Task";
  if (edge.type === "goal_habit") return "Goal -> Habit";
  return "Project -> Task";
}

function nodeDetail(node: LifeMapNode) {
  const details: string[] = [];
  if (node.status) details.push(node.status);
  if (node.realm) details.push(`${node.realm.icon} ${node.realm.name}`);
  if (typeof node.counts?.openTasks === "number") details.push(`${node.counts.openTasks} open task${node.counts.openTasks === 1 ? "" : "s"}`);
  if (typeof node.counts?.linkedGoals === "number" && node.counts.linkedGoals > 0) details.push(`${node.counts.linkedGoals} linked goal${node.counts.linkedGoals === 1 ? "" : "s"}`);
  return details.join(" · ");
}

export default function LifeMapPage() {
  const router = useRouter();
  const [graph, setGraph] = useState<LifeMapGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/life-map", { method: "GET", cache: "no-store" });
        const body = await response.json() as LifeMapResponse;
        if (cancelled) return;
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok || !body.graph) {
          setError(body.error ?? "Life Map could not be loaded.");
          return;
        }
        setGraph(body.graph);
      } catch {
        if (!cancelled) setError("Life Map could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  const nodesById = useMemo(() => {
    return (graph?.nodes ?? []).reduce<Record<string, LifeMapNode>>((map, node) => {
      map[node.id] = node;
      return map;
    }, {});
  }, [graph?.nodes]);

  const nodesByType = useMemo(() => {
    return COLUMN_META.reduce<Record<LifeMapNodeType, LifeMapNode[]>>((map, meta) => {
      map[meta.type] = (graph?.nodes ?? []).filter((node) => node.type === meta.type);
      return map;
    }, { goal: [], project: [], task: [], habit: [] });
  }, [graph?.nodes]);

  const selectedNode = selectedNodeId ? nodesById[selectedNodeId] ?? null : null;
  const selectedEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    const direct = (graph?.edges ?? []).filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId);
    if (selectedNode?.type !== "goal") return direct;
    const linkedProjectIds = direct.filter((edge) => edge.type === "goal_project").map((edge) => edge.target);
    const projectTaskEdges = (graph?.edges ?? []).filter((edge) => edge.type === "project_task" && linkedProjectIds.includes(edge.source));
    return [...direct, ...projectTaskEdges];
  }, [graph?.edges, selectedNode?.type, selectedNodeId]);

  return (
    <DashboardNav>
      <main className="mx-auto max-w-7xl px-4 py-6 animate-fade-in sm:px-6 sm:py-8">
        <header className="mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_34%),linear-gradient(135deg,rgba(244,247,251,0.045),rgba(244,247,251,0.012))] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Life Map</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-4xl">Your explicit operating graph.</h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">This map only uses relationships you created: goal links and project task assignments. No AI, embeddings, or inferred connections are used to render it.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-[var(--text-muted)]">
              <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-50/80">No background AI</span>
              <span className="rounded-full border border-white/[0.08] bg-[var(--surface-soft)] px-3 py-1.5">Explicit links only</span>
              <Link href="/goals" className="rounded-full border border-[var(--accent)]/25 px-3 py-1.5 font-semibold text-[var(--accent)] hover:border-[var(--accent)]/40">Manage links</Link>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-4">
            {COLUMN_META.map((meta) => <div key={meta.type} className="h-48 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />)}
          </div>
        ) : error ? (
          <section className="rounded-2xl border border-[var(--danger)]/25 bg-[var(--danger-soft)]/20 p-5 text-sm text-[var(--danger)]">{error}</section>
        ) : graph?.empty ? (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] p-6 text-center">
            <p className="text-sm font-semibold text-[var(--text)]">No map yet.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">Create a goal, project, task, or habit. Then link goals from the Goals page when a relationship is real.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/goals" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Open Goals</Link>
              <Link href="/projects" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)]">Open Projects</Link>
            </div>
          </section>
        ) : graph ? (
          <>
            <section aria-label="Life Map metrics" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <Metric label="Goals" value={graph.stats.goals} />
              <Metric label="Projects" value={graph.stats.projects} />
              <Metric label="Tasks" value={graph.stats.tasks} />
              <Metric label="Habits" value={graph.stats.habits} />
              <Metric label="Links" value={graph.stats.explicitLinks} />
              <Metric label="Unlinked Goals" value={graph.stats.unlinkedActiveGoals} tone={graph.stats.unlinkedActiveGoals > 0 ? "attention" : "stable"} />
              <Metric label="Projects No Task" value={graph.stats.activeProjectsWithoutOpenTask} tone={graph.stats.activeProjectsWithoutOpenTask > 0 ? "attention" : "stable"} />
            </section>

            <RelationshipPaths graph={graph} nodesById={nodesById} onFocus={setSelectedNodeId} />

            <section className="hidden gap-3 lg:grid lg:grid-cols-4" aria-label="Desktop Life Map columns">
              {COLUMN_META.map((meta) => (
                <div key={meta.type} className="min-w-0 rounded-3xl border border-white/[0.08] bg-[var(--surface-soft)]/80 p-3">
                  <div className="mb-3 px-1">
                    <h2 className="text-sm font-semibold text-[var(--text)]">{meta.title}</h2>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{meta.subtitle}</p>
                  </div>
                  <div className="space-y-2">
                    {nodesByType[meta.type].length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--border)] p-3 text-xs text-[var(--text-muted)]">Nothing visible here.</p> : nodesByType[meta.type].map((node) => (
                      <button key={node.id} onClick={() => setSelectedNodeId(node.id)} className={`w-full rounded-2xl border p-3 text-left transition-all hover:scale-[1.01] ${TYPE_COLORS[node.type]} ${selectedNodeId === node.id ? "ring-2 ring-cyan-100/35" : ""}`}>
                        <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] opacity-70">{TYPE_LABELS[node.type]}</span>
                        <span className="mt-1 block truncate text-sm font-semibold">{node.title}</span>
                        <span className="mt-1 block truncate text-[10px] opacity-70">{nodeDetail(node) || "No extra context"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-3 lg:hidden" aria-label="Mobile Life Map list">
              {COLUMN_META.map((meta) => (
                <details key={meta.type} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3" open={meta.type === "goal"}>
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">{meta.title} · {nodesByType[meta.type].length}</summary>
                  <div className="mt-3 space-y-2">
                    {nodesByType[meta.type].length === 0 ? <p className="text-xs text-[var(--text-muted)]">Nothing visible here.</p> : nodesByType[meta.type].map((node) => (
                      <button key={node.id} onClick={() => setSelectedNodeId(node.id)} className={`w-full rounded-xl border p-3 text-left ${TYPE_COLORS[node.type]}`}>
                        <span className="block text-sm font-semibold">{node.title}</span>
                        <span className="mt-1 block text-[10px] opacity-70">{nodeDetail(node) || "No extra context"}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </section>

            <section className="mt-4 rounded-3xl border border-white/[0.08] bg-[var(--surface-soft)] p-4" aria-live="polite">
              {selectedNode ? (
                <div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Focus Mode</p>
                      <h2 className="mt-1 text-xl font-semibold text-[var(--text)]">{selectedNode.title}</h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{TYPE_LABELS[selectedNode.type]} · {nodeDetail(selectedNode) || "No extra context"}</p>
                    </div>
                    <Link href={nodeHref(selectedNode)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--accent)]/25 px-3 py-2 text-xs font-semibold text-[var(--accent)]">Open source page</Link>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedEdges.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No explicit relationships for this item yet.</p> : selectedEdges.map((edge) => {
                      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const other = nodesById[otherId];
                      if (!other) return null;
                      return <div key={edge.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{edgeLabel(edge)}</p><p className="mt-1 text-sm font-semibold text-[var(--text)]">{other.title}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">Canonical explicit link</p></div>;
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">Select a node to inspect its explicit relationships.</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Accessible relationship list: {graph.edges.length === 0 ? "No explicit edges yet." : graph.edges.slice(0, 12).map((edge) => `${nodesById[edge.source]?.title ?? "Item"} ${edge.label} ${nodesById[edge.target]?.title ?? "item"}`).join("; ")}</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </DashboardNav>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "attention" | "stable" }) {
  const toneClass = tone === "attention" ? "text-amber-100" : tone === "stable" ? "text-emerald-100" : "text-[var(--text)]";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function RelationshipPaths({ graph, nodesById, onFocus }: { graph: LifeMapGraph; nodesById: Record<string, LifeMapNode>; onFocus: (id: string) => void }) {
  const goalNodes = graph.nodes.filter((node) => node.type === "goal").slice(0, 12);
  const projectTaskEdges = graph.edges.filter((edge) => edge.type === "project_task");

  if (goalNodes.length === 0) return null;

  return (
    <section className="mb-4 rounded-3xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(244,247,251,0.036),rgba(244,247,251,0.012))] p-3 sm:p-4" aria-label="Canonical relationship paths">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Connected Paths</h2>
          <p className="text-xs text-[var(--text-muted)]">Goal support paths from explicit links only.</p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/60">Goal &rarr; Project &rarr; Task · Goal &rarr; Habit</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {goalNodes.map((goal) => {
          const directEdges = graph.edges.filter((edge) => edge.source === goal.id && edge.type !== "project_task");
          const linkedProjects = directEdges.filter((edge) => edge.type === "goal_project").map((edge) => nodesById[edge.target]).filter(Boolean);
          const linkedHabits = directEdges.filter((edge) => edge.type === "goal_habit").map((edge) => nodesById[edge.target]).filter(Boolean);
          const linkedTasks = directEdges.filter((edge) => edge.type === "goal_task").map((edge) => nodesById[edge.target]).filter(Boolean);
          const isUnsupported = directEdges.length === 0;

          return (
            <article key={goal.id} className={`rounded-2xl border p-3 ${isUnsupported ? "border-amber-300/20 bg-amber-300/[0.05]" : "border-[var(--border)] bg-[var(--surface-soft)]"}`}>
              <button onClick={() => onFocus(goal.id)} className="group flex min-h-10 w-full min-w-0 items-center gap-2 text-left">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-200 shadow-[0_0_18px_rgba(252,211,77,0.55)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text)] group-hover:text-amber-100">{goal.title}</span>
                  <span className="block text-[10px] text-[var(--text-muted)]">{isUnsupported ? "No explicit support connected yet" : `${directEdges.length} explicit support link${directEdges.length === 1 ? "" : "s"}`}</span>
                </span>
              </button>

              {!isUnsupported && (
                <div className="mt-3 space-y-2 pl-3 sm:pl-4">
                  {linkedProjects.map((project) => {
                    const tasks = projectTaskEdges.filter((edge) => edge.source === project.id).map((edge) => nodesById[edge.target]).filter(Boolean).slice(0, 4);
                    return (
                      <div key={project.id} className="relative rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-2.5">
                        <span className="absolute -left-3 top-5 h-px w-3 bg-cyan-100/25" aria-hidden="true" />
                        <button onClick={() => onFocus(project.id)} className="min-h-9 w-full text-left">
                          <span className="block text-xs font-semibold text-cyan-50">Project: {project.title}</span>
                          <span className="text-[10px] text-cyan-50/55">{nodeDetail(project) || "Supports this goal"}</span>
                        </button>
                        {tasks.length > 0 && (
                          <div className="mt-2 space-y-1 border-l border-cyan-100/18 pl-3">
                            {tasks.map((task) => (
                              <button key={task.id} onClick={() => onFocus(task.id)} className="block min-h-8 w-full rounded-lg px-2 py-1 text-left text-[11px] text-violet-50/85 hover:bg-violet-300/10">
                                Task: {task.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {linkedHabits.map((habit) => (
                    <button key={habit.id} onClick={() => onFocus(habit.id)} className="relative block min-h-10 w-full rounded-xl border border-emerald-300/15 bg-emerald-300/[0.045] p-2.5 text-left">
                      <span className="absolute -left-3 top-5 h-px w-3 bg-emerald-100/25" aria-hidden="true" />
                      <span className="block text-xs font-semibold text-emerald-50">Habit: {habit.title}</span>
                      <span className="text-[10px] text-emerald-50/55">{nodeDetail(habit) || "Reinforces this goal"}</span>
                    </button>
                  ))}
                  {linkedTasks.map((task) => (
                    <button key={task.id} onClick={() => onFocus(task.id)} className="relative block min-h-10 w-full rounded-xl border border-violet-300/15 bg-violet-300/[0.045] p-2.5 text-left">
                      <span className="absolute -left-3 top-5 h-px w-3 bg-violet-100/25" aria-hidden="true" />
                      <span className="block text-xs font-semibold text-violet-50">Direct Task: {task.title}</span>
                      <span className="text-[10px] text-violet-50/55">Explicit Goal &rarr; Task link</span>
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
