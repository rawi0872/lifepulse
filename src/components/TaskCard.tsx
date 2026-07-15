import { Card } from "@/components/ui/card";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    priority: string;
    due_date?: string | null;
    status: string;
    realms?: { name: string; color: string; icon: string } | null;
  };
  onToggle: (taskId: string, isDone: boolean) => void;
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const isDone = task.status === "done";
  const dueLabel = task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  return (
    <Card
      variant={isDone ? "subtle" : "default"}
      className={`flex items-start gap-3 px-4 py-3 transition-all duration-150 ${
        isDone
          ? "border-[var(--success)]/20 bg-[var(--success-soft)]/20"
          : "hover:border-[var(--border-strong)] hover:bg-[var(--surface-active)] hover:shadow-md hover:shadow-black/15"
      }`}
    >
      <button
        onClick={() => onToggle(task.id, !isDone)}
        role="checkbox"
        aria-checked={isDone}
        aria-label={`Mark "${task.title}" as ${isDone ? "incomplete" : "complete"}`}
        className={`mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-150 ${
          isDone
            ? "border-[var(--success)]/80 bg-[var(--success)] shadow-sm shadow-[var(--success)]/15"
            : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-ghost)] hover:shadow-sm hover:shadow-[var(--accent)]/5"
        }`}
      >
        {isDone && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className={`min-w-0 text-pretty text-sm font-semibold leading-snug ${isDone ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
            {task.title}
          </p>
          {isDone && (
            <span className="shrink-0 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
              Done
            </span>
          )}
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
          {task.realms && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: task.realms.color + "20",
                color: task.realms.color,
              }}
            >
              {task.realms.icon} {task.realms.name}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
              task.priority === "high"
                ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                : task.priority === "medium"
                  ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                  : "bg-[var(--surface)] text-[var(--text-muted)]"
            }`}
          >
            {task.priority}
          </span>
          {dueLabel && (
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
              Due {dueLabel}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
