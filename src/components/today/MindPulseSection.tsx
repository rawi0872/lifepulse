"use client";

import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/ui/empty-state";

interface RealmInfo {
  name: string;
  color: string;
  icon: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  realms: RealmInfo | null;
}

interface TaskExecutionContext {
  projectTitle?: string;
  goalContext?: string;
}

interface MindPulseSectionProps {
  tasks: Task[];
  doneTaskCount: number;
  tasksLength: number;
  taskContextById?: Record<string, TaskExecutionContext>;
  onToggleTask: (taskId: string, isDone: boolean) => void;
}

export function MindPulseSection({ tasks, doneTaskCount, tasksLength, taskContextById = {}, onToggleTask }: MindPulseSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--text)]">Mind Pulse</h2>
          <span className="text-xs text-[var(--text-muted)]">{doneTaskCount}/{tasksLength}</span>
        </div>
        <Link href="/tasks" className="text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]">
          Manage
        </Link>
      </div>
      {tasks.length === 0 ? (
        <EmptyState
          eyebrow="Tasks"
          title="No mind tasks for today."
          message="If nothing needs action, a private mind check-in can still add context for Today and Weekly Review."
          description="Optional manual tracking only, not clinical or medical guidance."
          compact
          action={
            <Link href="/mind" className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:min-h-0 sm:bg-transparent sm:px-0">
              Log mind check-in &rarr;
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const context = taskContextById[task.id];
            return (
              <div key={task.id} className="min-w-0 space-y-1.5 sm:space-y-1">
                <TaskCard task={task} onToggle={onToggleTask} />
                {(context?.projectTitle || context?.goalContext) && (
                  <div className="flex min-w-0 flex-wrap gap-1.5 pl-0 text-[10px] text-[var(--text-muted)] sm:pl-10">
                    {context.projectTitle && (
                      <span className="min-w-0 rounded-full bg-[var(--surface)] px-2 py-1 sm:py-0.5">Project action: {context.projectTitle}</span>
                    )}
                    {context.goalContext && (
                      <span className="min-w-0 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)] sm:py-0.5">{context.goalContext}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
