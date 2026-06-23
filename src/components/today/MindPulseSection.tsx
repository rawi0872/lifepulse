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

interface MindPulseSectionProps {
  tasks: Task[];
  doneTaskCount: number;
  tasksLength: number;
  onToggleTask: (taskId: string, isDone: boolean) => void;
}

export function MindPulseSection({ tasks, doneTaskCount, tasksLength, onToggleTask }: MindPulseSectionProps) {
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
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggleTask} />
          ))}
        </div>
      )}
    </section>
  );
}
