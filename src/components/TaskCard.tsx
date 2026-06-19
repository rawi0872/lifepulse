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

  return (
    <Card
      variant={isDone ? "subtle" : "default"}
      className={`flex items-center gap-3 px-4 py-2.5 transition-all duration-150 ${
        isDone ? "opacity-60" : "hover:border-[var(--border-strong)] hover:shadow-md hover:shadow-black/15 hover:bg-[var(--surface-active)]"
      }`}
    >
      <button
        onClick={() => onToggle(task.id, !isDone)}
        role="checkbox"
        aria-checked={isDone}
        aria-label={`Mark "${task.title}" as ${isDone ? "incomplete" : "complete"}`}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 cursor-pointer ${
          isDone
            ? "border-[var(--accent)]/80 bg-[var(--accent)] shadow-sm shadow-[var(--accent)]/15"
            : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-ghost)] hover:shadow-sm hover:shadow-[var(--accent)]/5"
        }`}
      >
        {isDone && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1">
        <p className={`text-sm font-medium ${isDone ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2">
          {task.realms && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: task.realms.color + "20",
                color: task.realms.color,
              }}
            >
              {task.realms.icon} {task.realms.name}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              task.priority === "high"
                ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                : task.priority === "medium"
                  ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                  : "bg-[var(--surface)] text-[var(--text-muted)]"
            }`}
          >
            {task.priority}
          </span>
        </div>
      </div>
    </Card>
  );
}
