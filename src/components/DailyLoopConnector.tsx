import Link from "next/link";

type LoopStep = "today" | "action" | "reflect" | "review";

interface DailyLoopConnectorProps {
  activeStep: LoopStep;
  note: string;
}

const steps: { key: LoopStep; label: string; href: string }[] = [
  { key: "today", label: "Today", href: "/today" },
  { key: "action", label: "Action", href: "/today#daily-execution" },
  { key: "reflect", label: "Reflect", href: "/today#evening-reflection" },
  { key: "review", label: "Review", href: "/weekly-review" },
];

export function DailyLoopConnector({ activeStep, note }: DailyLoopConnectorProps) {
  return (
    <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/65 px-3.5 py-3 text-xs text-[var(--text-muted)] sm:px-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-pretty leading-relaxed">{note}</p>
        <Link href="/today" className="shrink-0 rounded-md py-1 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)] sm:py-0">
          Return to Today
        </Link>
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px]">
        {steps.map((step, index) => (
          <div key={step.key} className="flex min-w-0 items-center gap-1.5">
            <Link
              href={step.href}
              className={`rounded-full border px-2.5 py-1 transition-colors ${
                step.key === activeStep
                  ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)]/50 text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {step.label}
            </Link>
            {index < steps.length - 1 && <span className="text-[var(--text-muted)]/60">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
