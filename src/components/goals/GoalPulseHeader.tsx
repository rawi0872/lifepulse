"use client";

interface Props {
  activeCount: number;
  completedCount: number;
  milestoneCount: number;
  upcomingCount: number;
}

export function GoalPulseHeader({ activeCount, completedCount, milestoneCount, upcomingCount }: Props) {
  return (
    <div className="mb-6 min-w-0">
      <div className="mb-1 flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
          <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-[var(--text)]">Goal Pulse</h1>
          <p className="text-pretty text-xs text-[var(--text-muted)]">Long-term outcomes that matter</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-center sm:py-2">
          <p className="text-lg font-bold text-[var(--accent)]">{activeCount}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Active Goals</p>
        </div>
        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-center sm:py-2">
          <p className="text-lg font-bold text-[var(--success)]">{completedCount}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Completed</p>
        </div>
        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-center sm:py-2">
          <p className="text-lg font-bold text-[var(--warning)]">{milestoneCount}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Milestones Done</p>
        </div>
        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-center sm:py-2">
          <p className="text-lg font-bold text-[var(--text)]">{upcomingCount}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Upcoming Dates</p>
        </div>
      </div>
    </div>
  );
}
