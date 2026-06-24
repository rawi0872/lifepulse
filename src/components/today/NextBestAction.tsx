"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";

interface NextBestActionProps {
  hasBodyLogged: boolean;
  hasMindLogged: boolean;
  hasHighPriorityTasks: boolean;
  hasGoalWithoutLinks: boolean;
  hasJournalToday: boolean;
  hasContent: boolean;
  hasWorkoutThisWeek: boolean;
  hasNutritionToday: boolean;
}

interface Action {
  type: "body" | "mind" | "task" | "goal" | "journal" | "workout" | "nutrition";
  text: string;
  href: string;
}

function getActions(props: NextBestActionProps): Action[] {
  const actions: Action[] = [];

  if (!props.hasBodyLogged) {
    actions.push({
      type: "body",
      text: "Log today\u2019s Body Pulse.",
      href: "/body",
    });
  }

  if (!props.hasMindLogged) {
    actions.push({
      type: "mind",
      text: "Check in with Mind Pulse.",
      href: "/mind",
    });
  }

  if (props.hasHighPriorityTasks) {
    actions.push({
      type: "task",
      text: "Focus on your highest priority task.",
      href: "/tasks",
    });
  }

  if (props.hasGoalWithoutLinks) {
    actions.push({
      type: "goal",
      text: "Connect your goal to a project, task, or habit.",
      href: "/goals",
    });
  }

  if (!props.hasJournalToday && props.hasContent) {
    actions.push({
      type: "journal",
      text: "Write a short reflection.",
      href: "/today",
    });
  }

  if (!props.hasWorkoutThisWeek) {
    actions.push({
      type: "workout",
      text: "Log a workout this week.",
      href: "/body",
    });
  }

  if (!props.hasNutritionToday) {
    actions.push({
      type: "nutrition",
      text: "Log today\u2019s nutrition and water.",
      href: "/body",
    });
  }

  return actions.slice(0, 2);
}

const actionIcons: Record<string, React.ReactNode> = {
  workout: (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  nutrition: (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  body: (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    </svg>
  ),
  mind: (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  ),
  task: (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  goal: (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
  journal: (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
};

export function NextBestAction(props: NextBestActionProps) {
  const actions = getActions(props);

  if (actions.length === 0) return null;

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-2.5">
        <p className="text-[10px] font-medium tracking-wider text-[var(--text-muted)]">
          <svg className="mr-1.5 inline-block h-3 w-3 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          Suggested action
        </p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {actions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] transition-all"
          >
            {actionIcons[action.type]}
            <span>{action.text}</span>
            <span className="ml-auto text-xs text-[var(--text-muted)]">&rarr;</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
