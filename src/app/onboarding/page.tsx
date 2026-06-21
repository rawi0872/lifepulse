"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LifePulseLogo } from "@/components/LifePulseLogo";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REALMS = [
  { name: "Mind", color: "#8b5cf6", icon: "🧠", description: "Learning, focus, mental clarity" },
  { name: "Body", color: "#10b981", icon: "💪", description: "Health, training, sleep" },
  { name: "Career", color: "#3b82f6", icon: "💼", description: "School, work, skills, ambition" },
  { name: "Relationships", color: "#f43f5e", icon: "❤️", description: "Family, friends, social life" },
  { name: "Finance", color: "#f59e0b", icon: "💰", description: "Money, spending, stability" },
  { name: "Faith", color: "#a855f7", icon: "🙏", description: "Values, discipline, spiritual growth" },
] as const;

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48-2.12l-2.12 2.12M12 3v3m0 12v3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    name: "Today",
    desc: "Daily command center",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
    name: "Habits",
    desc: "Track daily practices",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
    name: "Projects",
    desc: "Manage goals and work",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    name: "Finance",
    desc: "Monitor spending",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    name: "Journal",
    desc: "End-of-day reflection",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
    ),
    name: "Insights",
    desc: "See your patterns",
  },
] as const;

const DAILY_LOOP = [
  {
    step: "01",
    title: "Plan",
    desc: "Choose your priorities for today",
    color: "from-[var(--accent)]/20 to-[var(--accent)]/5",
    borderColor: "border-[var(--accent)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Capture",
    desc: "Add tasks, ideas, and notes",
    color: "from-[var(--success)]/20 to-[var(--success)]/5",
    borderColor: "border-[var(--success)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Act",
    desc: "Complete habits and track actions",
    color: "from-[var(--warning)]/20 to-[var(--warning)]/5",
    borderColor: "border-[var(--warning)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <polyline points="9,18 15,12 9,6" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Reflect",
    desc: "Close the day with a journal entry",
    color: "from-[var(--accent-strong)]/20 to-[var(--accent-strong)]/5",
    borderColor: "border-[var(--accent-strong)]/20",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
] as const;

const STEP_LABELS = ["Welcome", "Life Areas", "Daily Loop", "Start"];

const STEP_LEFT = [
  {
    title: "Build your personal operating system",
    subtitle:
      "Life Pulse turns your habits, tasks, projects, finance, and reflection into one daily command center.",
  },
  {
    title: "Choose your life areas",
    subtitle:
      "Life areas organize everything you track. Habits, tasks, and projects connect back to these areas so you can see where your energy is going.",
  },
  {
    title: "Your daily rhythm",
    subtitle:
      "After setup, your Today dashboard becomes the place you plan, act, and close the day. Here is how the daily loop works.",
  },
  {
    title: "You are all set",
    subtitle:
      "Your data stays tied to your account. You can edit your life areas and preferences later in Settings.",
  },
] as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Setup progress" className="flex flex-col gap-0">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = i < current;
        const isCurrent = i === current;
        return (
          <div key={label} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-all duration-300",
                  isCompleted && "bg-[var(--accent-soft)] text-[var(--accent)]",
                  isCurrent && "bg-[var(--accent)] text-[var(--bg)] ring-2 ring-[var(--accent)]/30",
                  !isCompleted && !isCurrent && "bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)]",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06 0L2.22 9.78a.75.75 0 011.06-1.06L5.75 11.2l6.97-6.98a.75.75 0 011.06 0z" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    "mt-1 h-8 w-px transition-all duration-300",
                    i < current ? "bg-[var(--accent)]/40" : "bg-[var(--border)]",
                  )}
                />
              )}
            </div>
            <div className="flex flex-col pt-[3px]">
              <span
                className={cn(
                  "text-sm leading-tight transition-all duration-300",
                  isCurrent && "font-medium text-[var(--text)]",
                  isCompleted && "text-[var(--text-muted)]",
                  !isCompleted && !isCurrent && "text-[var(--text-muted)]",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <div
          key={f.name}
          className="group relative flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-raised)] hover:shadow-lg hover:shadow-[var(--accent)]/6"
        >
          {/* Background glow on hover */}
          <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: "radial-gradient(160px circle at 50% 0%, var(--accent-ghost), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-ghost)] text-[var(--accent)] transition-all duration-300 group-hover:bg-[var(--accent-soft)] group-hover:shadow-sm group-hover:shadow-[var(--accent)]/10">
            <span className="transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-110">
              {f.icon}
            </span>
          </div>

          <div className="relative z-10 min-w-0">
            <p className="text-sm font-medium text-[var(--text)] transition-colors duration-300 group-hover:text-[var(--text)]">
              {f.name}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] transition-colors duration-300 group-hover:text-[var(--text-secondary)]">
              {f.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RealmCards({
  selectedRealms,
  onToggle,
}: {
  selectedRealms: Set<string>;
  onToggle: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {DEFAULT_REALMS.map((r) => {
        const selected = selectedRealms.has(r.name);
        return (
          <button
            key={r.name}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => onToggle(r.name)}
            className={cn(
              "group relative flex items-start gap-3.5 rounded-xl border p-4.5 text-left transition-all duration-300 focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
              selected
                ? "border-[var(--accent)]/30 bg-[var(--surface-raised)] shadow-lg shadow-[var(--accent)]/8"
                : "border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] hover:shadow-md hover:shadow-black/10",
            )}
            style={selected ? { borderColor: `${r.color}44` } : undefined}
          >
            {/* Background glow when selected */}
            {selected && (
              <div
                className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.06]"
                style={{ background: `radial-gradient(200px 140px at 30% 50%, ${r.color}, transparent 80%)` }}
              />
            )}

            {/* Hover glow (when not selected) */}
            <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: "radial-gradient(160px circle at 50% 0%, var(--accent-ghost), transparent 70%)",
              }}
            />

            <div
              className={cn(
                "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-lg transition-all duration-300",
                selected ? "shadow-md shadow-black/10" : "group-hover:scale-105",
              )}
              style={{
                backgroundColor: selected ? `${r.color}1a` : undefined,
                color: selected ? r.color : undefined,
              }}
            >
              <span className={cn("transition-transform duration-300", selected && "scale-105")}>
                {r.icon}
              </span>
            </div>

            <div className="relative z-10 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    selected ? "text-[var(--text)]" : "text-[var(--text-secondary)]",
                  )}
                >
                  {r.name}
                </p>

                <div
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all duration-300",
                    selected
                      ? "border-transparent"
                      : "border-[var(--border-strong)] bg-transparent",
                  )}
                  style={{
                    backgroundColor: selected ? `${r.color}` : undefined,
                  }}
                >
                  {selected && (
                    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 text-white">
                      <path d="M2.5 6L5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <p
                className={cn(
                  "mt-0.5 text-xs leading-relaxed transition-colors duration-300",
                  selected ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]",
                )}
              >
                {r.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DailyLoopGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {DAILY_LOOP.map((item, i) => (
        <div
          key={item.step}
          className="group relative"
        >
          {/* Connector line to next card (visible on larger screens) */}
          {i % 2 === 0 && i < DAILY_LOOP.length - 1 && (
            <div className="pointer-events-none absolute -right-2 top-1/2 z-20 hidden h-px w-4 bg-gradient-to-r from-[var(--border-strong)] to-transparent sm:block" />
          )}

          <div className={cn(
            "relative flex flex-col gap-3 rounded-xl border bg-[var(--surface)] p-5 transition-all duration-300",
            "hover:-translate-y-1 hover:shadow-lg hover:shadow-black/10",
            item.borderColor,
          )}>
            {/* Colored top accent */}
            <div className={cn(
              "absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r opacity-60",
              item.color,
            )} />

            {/* Background glow */}
            <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: "radial-gradient(200px circle at 50% 0%, var(--accent-ghost), transparent 70%)",
              }}
            />

            {/* Header row */}
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--accent)] transition-all duration-300 group-hover:border-[var(--accent)]/30 group-hover:bg-[var(--accent-soft)] group-hover:shadow-sm group-hover:shadow-[var(--accent)]/10">
                <span className="transition-all duration-300 group-hover:scale-110">
                  {item.icon}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-widest text-[var(--accent)]">{item.step}</span>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">{item.title}</p>
              </div>
            </div>

            {/* Description */}
            <p className="relative z-10 text-xs leading-relaxed text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors duration-300">
              {item.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FinalSummary() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { label: "6 life areas ready", desc: "Organize everything you track", icon: "🧭" },
        { label: "Daily rhythm set", desc: "Plan, act, and reflect each day", icon: "🔄" },
        { label: "Dashboard unlocked", desc: "Your personal command center", icon: "🎯" },
      ].map((item) => (
        <div
          key={item.label}
          className="group relative flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)]/25 hover:bg-[var(--surface-raised)] hover:shadow-lg hover:shadow-[var(--accent)]/6"
        >
          <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: "radial-gradient(140px circle at 50% 0%, var(--accent-ghost), transparent 70%)",
            }}
          />
          <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-ghost)] text-lg transition-all duration-300 group-hover:bg-[var(--accent-soft)] group-hover:scale-105">
            {item.icon}
          </div>
          <div className="relative z-10 min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">{item.label}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors duration-300">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selectedRealms, setSelectedRealms] = useState<Set<string>>(
    () => new Set(DEFAULT_REALMS.map((r) => r.name)),
  );
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.onboarding_completed) {
        router.push("/today");
        return;
      }

      setChecking(false);

      const { data: existing } = await supabase
        .from("realms")
        .select("name")
        .eq("user_id", user.id);

      if (existing && existing.length > 0) {
        const existingNames = new Set(existing.map((r) => r.name));
        setSelectedRealms(existingNames);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  function toggleRealm(name: string) {
    setSelectedRealms((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size <= 1) return prev;
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function handleNext() {
    setStep((s) => s + 1);
    setError(null);
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
    setError(null);
  }

  async function handleComplete() {
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Session expired. Please sign in again.");
        setSaving(false);
        return;
      }

      const { data: existing } = await supabase
        .from("realms")
        .select("name")
        .eq("user_id", user.id);

      if (!existing || existing.length === 0) {
        const realmsToInsert = DEFAULT_REALMS.filter((r) => selectedRealms.has(r.name)).map((r, i) => ({
          user_id: user.id,
          name: r.name,
          color: r.color,
          icon: r.icon,
          sort_order: i,
        }));

        if (realmsToInsert.length > 0) {
          const { error: rErr } = await supabase.from("realms").insert(realmsToInsert);
          if (rErr) {
            setError("Failed to create life areas. Please try again.");
            setSaving(false);
            return;
          }
        }
      }

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      if (pErr) {
        const { error: insErr } = await supabase
          .from("profiles")
          .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" });
        if (insErr) {
          setError("Failed to save progress. Please try again.");
          setSaving(false);
          return;
        }
      }

      router.push("/today");
    } catch {
      setError("Connection error. Please try again.");
      setSaving(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-5">
          <LifePulseLogo />
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isLastStep = step === 3;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      {/* Left panel */}
      <aside className="relative flex flex-col justify-between border-b border-[var(--border)] px-6 py-8 lg:sticky lg:top-0 lg:h-screen lg:w-[340px] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-10 lg:py-12">
        {/* Subtle decorative gradient in corner */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
        />

        <div>
          {/* Logo */}
          <div className="mb-10">
            <LifePulseLogo />
          </div>

          {/* Step content */}
          <div className="mb-8">
            <h1 className="mb-3 text-xl font-bold leading-tight text-[var(--text)] lg:text-2xl">
              {STEP_LEFT[step].title}
            </h1>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{STEP_LEFT[step].subtitle}</p>
          </div>

          {/* Step indicator - desktop */}
          <div className="hidden lg:block">
            <StepIndicator current={step} />
          </div>
        </div>

        {/* Privacy note - desktop */}
        <p className="hidden text-xs leading-relaxed text-[var(--text-muted)] lg:block">
          Your data stays tied to your account. You can change your setup later in Settings.
        </p>
      </aside>

      {/* Right panel */}
      <main
        ref={contentRef}
        className="relative flex flex-1 flex-col overflow-y-auto px-6 py-8 lg:px-12 lg:py-12"
      >
        {/* Mobile step indicator */}
        <div className="mb-8 lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium transition-all duration-300",
                    i < step && "bg-[var(--accent-soft)] text-[var(--accent)]",
                    i === step && "bg-[var(--accent)] text-[var(--bg)] ring-2 ring-[var(--accent)]/30",
                    i > step && "bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)]",
                  )}
                >
                  {i < step ? (
                    <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
                      <path d="M10.28 2.22a.75.75 0 010 1.06l-6 6a.75.75 0 01-1.06 0l-3-3a.75.75 0 011.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 011.06 0z" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={cn(
                      "mx-1 h-px flex-1 transition-colors duration-300",
                      i < step ? "bg-[var(--accent)]/40" : "bg-[var(--border)]",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[var(--text-muted)]">{STEP_LABELS[step]}</p>
        </div>

        {/* Step content */}
        <div className="flex-1">
          {step === 0 && (
            <div className="animate-fade-in flex flex-col gap-8">
              {/* Intro section */}
              <div className="max-w-2xl">
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  A complete view of what matters most — habits, tasks, projects, finance, and reflection — in one place.
                </p>
              </div>

              {/* Feature cards grid - spans full width */}
              <div>
                <FeatureGrid />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in flex flex-col gap-8">
              <div className="max-w-2xl">
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  These are the areas your progress will be organized around. You can change them later, or create new ones.
                </p>
              </div>

              <div>
                <RealmCards selectedRealms={selectedRealms} onToggle={toggleRealm} />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--text-muted)]">
                  {selectedRealms.size === 0
                    ? "Select at least one life area to continue."
                    : `${selectedRealms.size} of ${DEFAULT_REALMS.length} selected`}
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in flex flex-col gap-8">
              <div className="max-w-2xl">
                <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Each day, Life Pulse guides you through a simple rhythm — plan, capture, act, and reflect.
                </p>
              </div>

              <div>
                <DailyLoopGrid />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in flex flex-col gap-8">
              {/* Completion header */}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-lg">
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    Your life areas are ready. Your dashboard is waiting. Start with one priority and build from there.
                  </p>
                </div>

                {/* Logo treatment - completion badge */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-ghost)] ring-1 ring-[var(--accent)]/10">
                  <LifePulseLogo variant="mark" size="lg" />
                </div>
              </div>

              {/* Summary cards */}
              <div>
                <FinalSummary />
              </div>

              {/* Error + CTA */}
              <div className="flex flex-col gap-5">
                {error && (
                  <div
                    className="rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Button
                      size="lg"
                      className="w-full sm:w-auto shadow-md shadow-[var(--accent)]/15 hover:shadow-lg hover:shadow-[var(--accent)]/20 transition-all duration-200 text-base"
                      onClick={handleComplete}
                      disabled={saving}
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Setting up...
                        </span>
                      ) : (
                        "Enter my dashboard"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    You can customize your setup later in Settings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        {!isLastStep && (
          <div className="mt-10 flex items-center justify-between border-t border-[var(--border)] pt-6">
            <div>
              {step > 0 && (
                <Button variant="ghost" onClick={handleBack} disabled={saving}>
                  Back
                </Button>
              )}
            </div>
            <Button onClick={handleNext} disabled={saving || (step === 1 && selectedRealms.size === 0)}>
              {step === 1 && selectedRealms.size === 0 ? "Select an area" : "Continue"}
            </Button>
          </div>
        )}

        {/* Privacy note - mobile */}
        <p className="mt-8 text-center text-xs text-[var(--text-muted)] lg:hidden">
          Your data stays tied to your account. You can change your setup later in Settings.
        </p>
      </main>
    </div>
  );
}
