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
        className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-all duration-150 ${
          isCompleted ? "opacity-60" : "hover:border-[var(--border-strong)] hover:shadow-md hover:shadow-black/15 hover:bg-[var(--surface-active)]"
        }`}
        onClick={() => onToggle(habit.id, !isCompleted)}
      >
        <div
          className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
            isCompleted
              ? "border-[var(--accent)]/80 bg-[var(--accent)] shadow-sm shadow-[var(--accent)]/15"
              : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-ghost)] hover:shadow-sm hover:shadow-[var(--accent)]/5"
          }`}
        >
          {isCompleted && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${isCompleted ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
          {habit.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {habit.realms && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: habit.realms.color + "20",
                color: habit.realms.color,
              }}
            >
              {habit.realms.icon} {habit.realms.name}
            </span>
          )}
          {showStreak && streak > 0 && (
            <span className="text-xs text-[var(--accent)]/80">
              {streak}-day streak
            </span>
          )}
          {showStreak && streak === 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              No streak yet
            </span>
          )}
          {showWeekly && wp && (
            <span className="text-xs text-[var(--warning)]/80">
              {wp.completed}/{wp.target} this week
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
