import { Card } from "@/components/ui/card";
import { getLevelInfo } from "@/lib/levels";

interface XpDisplayProps {
  totalXp: number;
  todayXp: number;
  dueHabitCount: number;
  completedHabitCount: number;
}

export function XpDisplay({
  totalXp,
  todayXp,
  dueHabitCount,
  completedHabitCount,
}: XpDisplayProps) {
  const { level, xpIntoLevel, xpNeededForNext, progressPercent, nextLevelXp, currentLevelXp } = getLevelInfo(totalXp);
  const circumference = 2 * Math.PI * 15.5;
  const progressOffset = circumference - (progressPercent / 100) * circumference;
  const xpRange = nextLevelXp - currentLevelXp;
  const habitProgress = dueHabitCount > 0
    ? Math.round((completedHabitCount / dueHabitCount) * 100)
    : 0;

  return (
    <Card className="overflow-hidden border-[var(--border)] bg-gradient-to-b from-[var(--surface)] to-[var(--surface-soft)] p-4">
      <div className="flex items-center gap-4">
        {/* Progress ring */}
        <div className="relative flex shrink-0 items-center justify-center">
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-[var(--surface)]"
            />
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-[var(--accent)]"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease", filter: "drop-shadow(0 0 3px var(--accent))" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-base font-bold text-[var(--text)]">{level}</span>
            <span className="text-[8px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Lvl
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Total XP
              </p>
              <p className="text-lg font-bold text-[var(--text)]">{totalXp}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Today
              </p>
              <p className="text-lg font-bold text-[var(--accent)]">
                +{todayXp}
              </p>
            </div>
          </div>

          {/* Level progress bar */}
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px]">
              <span className="text-[var(--text-muted)]">Level progress</span>
              <span className="text-[var(--text-muted)]">{xpIntoLevel}/{xpRange} XP</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] shadow-sm shadow-[var(--accent)]/10 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
              Next level: {xpNeededForNext} XP away.
            </p>
          </div>

          <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
            Private momentum from completed tasks and habits. It is not a judgment score.
          </p>

          {/* Momentum label & Habit progress */}
          {dueHabitCount > 0 && (
            <div>
              <p className="flex items-center justify-between text-[9px] uppercase tracking-widest text-[var(--text-muted)] mt-1 mb-0.5">
                <span>Momentum</span>
                <span>Today</span>
              </p>
              <div className="mb-0.5 flex items-center justify-between text-[10px]">
                <span className="text-[var(--text-muted)]">Today&apos;s habits</span>
                <span className="text-[var(--text-muted)]">{completedHabitCount}/{dueHabitCount}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-all duration-300"
                  style={{ width: `${habitProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
