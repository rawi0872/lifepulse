"use client";

import { useEffect, useRef, useCallback } from "react";
import { RealmRadarChart, type RealmRadarEntry } from "./RealmRadarChart";
import { getLevelInfo, getRealmTitle } from "@/lib/levels";

// ─── Types ─────────────────────────────────────────────────────────────────

interface RealmDetail {
  name: string;
  color: string;
  icon: string;
  xp: number;
  level: number;
  title: string;
  score: number;
  status: "Empty" | "Needs attention" | "Growing" | "Strong";
}

interface RealmXpInput {
  name: string;
  color: string;
  icon: string;
  xp: number;
}

interface RealmRadarExpandedDialogProps {
  open: boolean;
  onClose: () => void;
  scoredRealms: RealmRadarEntry[];
  realmXp: RealmXpInput[];
  strongest: RealmRadarEntry | null;
  weakest: RealmRadarEntry | null;
  balanceScore: number | null;
  suggestion: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getStatus(score: number): RealmDetail["status"] {
  if (score === 0) return "Empty";
  if (score < 30) return "Needs attention";
  if (score < 60) return "Growing";
  return "Strong";
}

function getStatusColor(status: RealmDetail["status"]): string {
  switch (status) {
    case "Strong":
      return "var(--success)";
    case "Growing":
      return "var(--accent)";
    case "Needs attention":
      return "var(--warning)";
    case "Empty":
      return "var(--text-muted)";
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RealmRadarExpandedDialog({
  open,
  onClose,
  scoredRealms,
  realmXp,
  strongest,
  weakest,
  balanceScore,
  suggestion,
}: RealmRadarExpandedDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  // Focus trap / return
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, handleKeyDown]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const hasData = scoredRealms.length > 0 && scoredRealms.some((r) => r.score > 0);

  // Build realm details for breakdown list
  const realmDetails: RealmDetail[] = realmXp
    .map((r) => {
      const info = getLevelInfo(r.xp);
      const title = getRealmTitle(r.name, info.level);
      const scored = scoredRealms.find((s) => s.name === r.name);
      const score = scored?.score ?? 0;
      return {
        name: r.name,
        color: r.color,
        icon: r.icon,
        xp: r.xp,
        level: info.level,
        title,
        score,
        status: getStatus(score),
      };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Life Balance Map — detailed view"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--bg)] shadow-2xl outline-none"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors sm:right-4 sm:top-4"
          aria-label="Close detailed view"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="12" y2="12" />
            <line x1="12" y1="2" x2="2" y2="12" />
          </svg>
        </button>

        {/* ── Top section: Chart + Analysis ── */}
        <div className="flex flex-col gap-6 p-5 pt-12 sm:p-7 sm:pt-12 lg:flex-row lg:gap-8 lg:p-8 lg:pt-14">
          {/* Chart */}
          <div className="flex shrink-0 items-center justify-center lg:w-[400px]">
            <div className="w-full max-w-[300px] sm:max-w-[360px] lg:max-w-none">
              <RealmRadarChart realms={scoredRealms} />
            </div>
          </div>

          {/* Analysis */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[var(--text)] mb-1">
              Life Balance Map
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {hasData
                ? "Your life areas at a glance — which are thriving and which could use more attention."
                : "Your map fills in as you complete actions connected to each life area."}
            </p>

            {hasData ? (
              <div className="flex flex-col gap-3.5">
                {/* Strongest */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Strongest
                  </p>
                  {strongest && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-sm">{strongest.icon}</span>
                      <span className="text-sm font-semibold text-[var(--text)]">{strongest.name}</span>
                      <span className="text-[13px] font-bold tabular-nums ml-auto" style={{ color: strongest.color }}>
                        {Math.round(strongest.score)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Needs attention */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Needs attention
                  </p>
                  {weakest && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-sm">{weakest.icon}</span>
                      <span className="text-sm font-semibold text-[var(--text)]">{weakest.name}</span>
                      <span className="text-[13px] font-bold tabular-nums ml-auto text-[var(--text-muted)]">
                        {Math.round(weakest.score)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Balance score */}
                {balanceScore !== null && (
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      Balance
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{
                          color:
                            balanceScore >= 70
                              ? "var(--success)"
                              : balanceScore >= 40
                                ? "var(--warning)"
                                : "var(--text-secondary)",
                        }}
                      >
                        {balanceScore}%
                      </span>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface-soft)] sm:w-28">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${balanceScore}%`,
                            backgroundColor:
                              balanceScore >= 70
                                ? "var(--success)"
                                : balanceScore >= 40
                                  ? "var(--warning)"
                                  : "var(--text-secondary)",
                            opacity: 0.55,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestion */}
                {suggestion && (
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] border-t border-[var(--border)] pt-3">
                    {suggestion}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4 text-center">
                <p className="text-xs text-[var(--text-muted)]">
                  Complete habits and tasks connected to life areas to shape your balance map.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Realm breakdown ── */}
        {realmDetails.length > 0 && (
          <div className="border-t border-[var(--border)] px-5 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6 lg:px-8 lg:pb-8">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-4">
              Area breakdown
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {realmDetails.map((r) => (
                <div
                  key={r.name}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{r.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate leading-tight">
                          {r.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate leading-tight">
                          {r.title}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-sm font-bold tabular-nums"
                        style={{ color: r.color }}
                      >
                        {Math.round(r.score)}%
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Lv.{r.level}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${r.score}%`, backgroundColor: r.color, opacity: 0.6 }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: getStatusColor(r.status) }}
                    >
                      {r.status}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{r.xp} XP</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
