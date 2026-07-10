"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyProjectStateProps {
  onFocusQuickPlan: () => void;
  onCreateManual: () => void;
}

export function EmptyProjectState({ onFocusQuickPlan, onCreateManual }: EmptyProjectStateProps) {
  return (
    <Card variant="subtle" className="border-dashed border-[var(--border)]">
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-[var(--text-muted)]">Projects are bigger outcomes made of tasks.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:py-1">Build Life Pulse</span>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:py-1">Improve guitar soloing</span>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:py-1">Finish Smartocaster</span>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:py-1">Prepare for physics exam</span>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-all duration-150 hover:bg-[var(--surface-active)] hover:text-[var(--text-secondary)] sm:py-1">Launch 3D printing business</span>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button size="sm" onClick={onFocusQuickPlan}>
            Start with Quick plan
          </Button>
          <Button variant="secondary" size="sm" onClick={onCreateManual}>
            Create manually
          </Button>
        </div>
      </div>
    </Card>
  );
}
