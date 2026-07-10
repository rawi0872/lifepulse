"use client";

import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";
import { SectionHeader } from "@/components/ui/section-header";
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
      <SectionHeader
        label="Mind Pulse"
        count={`${doneTaskCount}/${tasksLength}`}
        accent="success"
        action={
          <Link href="/tasks" className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
            Manage
          </Link>
        }
      />
      {tasks.length === 0 ? (
        <EmptyState
          message="No tasks for today."
          compact
          action={
            <Link href="/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
              Add a task &rarr;
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
                      <span className="min-w-0 rounded-full bg-[var(--surface)] px-2 py-1 sm:py-0.5">Project: {context.projectTitle}</span>
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
