import { Card } from "@/components/ui/card";

interface HabitCardProps {
  habit: {
    id: string;
    title: string;
    description?: string | null;
    frequency: string;
    realms?: { name: string; color: string; icon: string } | null;
  };
  isCompleted: boolean;
  onToggle: (habitId: string, isCompleted: boolean) => void;
  streak?: number;
  weeklyProgress?: { completed: number; target: number } | null;
}

export function HabitCard({ habit, isCompleted, onToggle, streak, weeklyProgress }: HabitCardProps) {
  const showStreak = !isCompleted && streak !== undefined && habit.frequency !== "times_per_week";
  const wp = weeklyProgress;
  const showWeekly = !isCompleted && wp !== null && wp !== undefined && habit.frequency === "times_per_week";

  return (
      <Card
        variant={isCompleted ? "subtle" : "default"}
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={`Mark "${habit.title}" as ${isCompleted ? "incomplete" : "complete"}`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(habit.id, !isCompleted); } }}
        className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-all duration-150 ${
          isCompleted
            ? "border-[var(--success)]/20 bg-[var(--success-soft)]/20"
            : "hover:border-[var(--border-strong)] hover:bg-[var(--surface-active)] hover:shadow-md hover:shadow-black/15"
        }`}
        onClick={() => onToggle(habit.id, !isCompleted)}
      >
        <div
          className={`relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
            isCompleted
              ? "border-[var(--success)]/80 bg-[var(--success)] shadow-sm shadow-[var(--success)]/15"
              : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-ghost)] hover:shadow-sm hover:shadow-[var(--accent)]/5"
          }`}
        >
          {isCompleted && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className={`min-w-0 text-pretty text-sm font-semibold leading-snug ${isCompleted ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
            {habit.title}
          </p>
          {isCompleted && (
            <span className="shrink-0 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
              Done today
            </span>
          )}
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
          {habit.realms && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: habit.realms.color + "20",
                color: habit.realms.color,
              }}
            >
              {habit.realms.icon} {habit.realms.name}
            </span>
          )}
          {showStreak && streak > 0 && (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
              {streak}-day streak
            </span>
          )}
          {showStreak && streak === 0 && (
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
              No streak yet
            </span>
          )}
          {showWeekly && wp && (
            <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
              {wp.completed}/{wp.target} this week
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
