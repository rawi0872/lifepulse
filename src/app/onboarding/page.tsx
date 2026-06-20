"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  { icon: "⊙", name: "Today", desc: "Daily command center" },
  { icon: "◇", name: "Habits", desc: "Track daily practices" },
  { icon: "⊞", name: "Projects", desc: "Manage goals and work" },
  { icon: "▲", name: "Finance", desc: "Monitor spending" },
  { icon: "◆", name: "Journal", desc: "End-of-day reflection" },
  { icon: "⬡", name: "Insights", desc: "See your patterns" },
] as const;

const DAILY_LOOP = [
  { step: "01", title: "Plan", desc: "Choose your priorities for today" },
  { step: "02", title: "Capture", desc: "Add tasks, ideas, and notes" },
  { step: "03", title: "Act", desc: "Complete habits and track actions" },
  { step: "04", title: "Reflect", desc: "Close the day with a journal entry" },
] as const;

const STEP_LABELS = ["Welcome", "Life Areas", "Daily Loop", "Start"];

const STEP_LEFT = [
  {
    title: "Build your personal operating system",
    subtitle:
      "Life Pulse turns your habits, tasks, projects, reflection, and money tracking into one daily command center.",
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
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all duration-200",
                  isCompleted && "bg-[var(--accent-soft)] text-[var(--accent)]",
                  isCurrent && "bg-[var(--accent)] text-[var(--bg)]",
                  !isCompleted && !isCurrent && "bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)]",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? "✓" : i + 1}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    "mt-1 h-8 w-px transition-colors duration-200",
                    i < current ? "bg-[var(--accent)]/40" : "bg-[var(--border)]",
                  )}
                />
              )}
            </div>
            <div className="flex flex-col pt-1">
              <span
                className={cn(
                  "text-sm transition-colors duration-200",
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
    <div className="grid grid-cols-2 gap-3">
      {FEATURES.map((f) => (
        <div
          key={f.name}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-all duration-150 hover:border-[var(--border-strong)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-ghost)] text-base text-[var(--accent)]">
            {f.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text)]">{f.name}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{f.desc}</p>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus:outline-none",
              selected
                ? "border-[var(--accent)]/40 bg-[var(--surface)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]",
            )}
            style={selected ? { borderColor: `${r.color}66` } : undefined}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg transition-all duration-150",
                selected ? "shadow-sm" : "",
              )}
              style={{
                backgroundColor: selected ? `${r.color}20` : undefined,
                color: selected ? r.color : undefined,
              }}
            >
              {r.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-150",
                    selected ? "text-[var(--text)]" : "text-[var(--text-secondary)]",
                  )}
                >
                  {r.name}
                </p>
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150",
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                      : "border-[var(--border-strong)] bg-transparent",
                  )}
                >
                  {selected && <span className="text-[10px] font-bold">✓</span>}
                </div>
              </div>
              <p
                className={cn(
                  "mt-0.5 text-xs leading-relaxed transition-colors duration-150",
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

function DailyLoopVisual() {
  return (
    <div className="flex flex-col gap-4">
      {DAILY_LOOP.map((item, i) => (
        <div key={item.step} className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-xs font-medium text-[var(--accent)] ring-1 ring-[var(--border)]">
            {item.step}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text)]">{item.title}</p>
            <p className="text-xs text-[var(--text-secondary)]">{item.desc}</p>
          </div>
          {i < DAILY_LOOP.length - 1 && (
            <div className="hidden sm:ml-auto sm:flex sm:items-center sm:text-[var(--text-muted)]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="rotate-90 sm:rotate-0">
                <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
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
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface)] ring-1 ring-[var(--border)]">
            <span className="text-lg font-bold text-[var(--accent)]">LP</span>
          </div>
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
      <aside className="flex flex-col justify-between border-b border-[var(--border)] px-6 py-8 lg:sticky lg:top-0 lg:h-screen lg:w-[360px] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-10 lg:py-12">
        <div>
          {/* Logo */}
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)] ring-1 ring-[var(--accent-soft)]">
              LP
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">Life Pulse</span>
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
        className="flex flex-1 flex-col overflow-y-auto px-6 py-8 lg:px-12 lg:py-12"
      >
        {/* Mobile step indicator */}
        <div className="mb-8 lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-1 items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium transition-all duration-200",
                    i < step && "bg-[var(--accent-soft)] text-[var(--accent)]",
                    i === step && "bg-[var(--accent)] text-[var(--bg)]",
                    i > step && "bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)]",
                  )}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={cn(
                      "mx-1 h-px flex-1 transition-colors duration-200",
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
            <div className="animate-fade-in max-w-lg">
              <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">
                A complete view of what matters most — habits, tasks, projects, finance, and reflection — in one place.
              </p>
              <FeatureGrid />
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in max-w-xl">
              <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">
                These are the areas your progress will be organized around. You can change them later, or create new ones.
              </p>
              <RealmCards selectedRealms={selectedRealms} onToggle={toggleRealm} />
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                {selectedRealms.size === 0
                  ? "Select at least one life area to continue."
                  : `${selectedRealms.size} of ${DEFAULT_REALMS.length} selected`}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in max-w-lg">
              <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">
                Each day, Life Pulse guides you through a simple rhythm — plan, capture, act, and reflect.
              </p>
              <DailyLoopVisual />
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in flex max-w-lg flex-col items-start">
              <p className="mb-8 text-sm leading-relaxed text-[var(--text-secondary)]">
                Your life areas are ready. Your dashboard is waiting. Start with one priority and build from there.
              </p>
              <div className="flex w-full flex-col gap-4">
                {error && (
                  <div
                    className="rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={handleComplete}
                  disabled={saving}
                >
                  {saving ? "Setting up..." : "Enter my dashboard"}
                </Button>
                <p className="text-xs text-[var(--text-muted)]">
                  You can customize your setup later in Settings.
                </p>
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
