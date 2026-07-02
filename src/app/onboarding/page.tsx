"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LifePulseLogo } from "@/components/LifePulseLogo";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { FeatureTour } from "@/components/onboarding/FeatureTour";
import { DailyLoopGrid } from "@/components/onboarding/DailyLoopGrid";
import { FinalSummary } from "@/components/onboarding/FinalSummary";
import { INTENDED_USE_OPTIONS, type IntendedUse } from "@/lib/intendedUse";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REALMS = [
  { name: "Mind", color: "#8b5cf6", icon: "🧠", description: "Learning, focus, mental clarity" },
  { name: "Body", color: "#10b981", icon: "💪", description: "Health, training, sleep" },
  { name: "Career", color: "#3b82f6", icon: "💼", description: "School, work, skills, ambition" },
  { name: "Relationships", color: "#f43f5e", icon: "❤️", description: "Family, friends, social life" },
  { name: "Finance", color: "#f59e0b", icon: "💰", description: "Money, spending, stability" },
  { name: "Faith", color: "#a855f7", icon: "🙏", description: "Values, discipline, spiritual growth" },
] as const;

const STEP_LABELS = ["Welcome", "Setup", "Life Areas", "Daily Loop", "Start"];

const STEP_LEFT = [
  {
    title: "Build your personal operating system",
    subtitle:
      "Life Pulse turns your habits, tasks, projects, finance, and reflection into one daily command center.",
  },
  {
    title: "Personalize your starting setup",
    subtitle:
      "Choose why you are using Life Pulse so the app can emphasize the right starting experience.",
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

function IntendedUseCards({
  selected,
  onSelect,
}: {
  selected: IntendedUse | null;
  onSelect: (value: IntendedUse) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {INTENDED_USE_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.value)}
            className={cn(
              "group relative rounded-xl border p-4 text-left transition-all duration-300 focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
              isSelected
                ? "border-[var(--accent)]/50 bg-[var(--accent-ghost)] shadow-lg shadow-[var(--accent)]/8"
                : "border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] hover:shadow-md hover:shadow-black/10",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{option.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{option.description}</p>
              </div>
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                  isSelected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-strong)]",
                )}
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
            </div>
            {option.value === "team" && (
              <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Team collaboration is an early-access direction. This setup does not create shared permissions yet.
              </p>
            )}
          </button>
        );
      })}
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

// ─── Main component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selectedRealms, setSelectedRealms] = useState<Set<string>>(
    () => new Set(DEFAULT_REALMS.map((r) => r.name)),
  );
  const [intendedUse, setIntendedUse] = useState<IntendedUse | null>(null);
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
    if (step === 1 && !intendedUse) {
      setError("Choose what you are using Life Pulse for to continue.");
      return;
    }
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

      if (!intendedUse) {
        setError("Choose what you are using Life Pulse for to finish setup.");
        setSaving(false);
        return;
      }

      const { data: existing } = await supabase
        .from("realms")
        .select("name, id")
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
          const { error: rErr } = await supabase.from("realms").insert(realmsToInsert).select();
          if (rErr) {
            setError("Failed to create life areas. Please try again.");
            setSaving(false);
            return;
          }
        }
      }

      // ── Create starter data for new users (idempotent) ──────────────────────
      const { data: existingHabits } = await supabase
        .from("habits")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!existingHabits || existingHabits.length === 0) {
        const { data: realms } = await supabase
          .from("realms")
          .select("id, name")
          .eq("user_id", user.id);

        const bodyRealm = realms?.find((r) => r.name === "Body") ?? realms?.[0];
        const mindRealm = realms?.find((r) => r.name === "Mind") ?? realms?.[0];
        const careerRealm = realms?.find((r) => r.name === "Career") ?? realms?.[0];

        const starterHabits = [];
        if (bodyRealm) {
          const { data: existingLogs } = await supabase
            .from("habit_logs")
            .select("id")
            .eq("user_id", user.id)
            .limit(1);
          if (!existingLogs || existingLogs.length === 0) {
            starterHabits.push(
              { user_id: user.id, realm_id: bodyRealm.id, title: "Morning stretch", frequency: "daily" },
              { user_id: user.id, realm_id: bodyRealm.id, title: "Walk 10 minutes", frequency: "daily" },
            );
          }
        }
        if (mindRealm) {
          starterHabits.push(
            { user_id: user.id, realm_id: mindRealm.id, title: "Read 10 pages", frequency: "daily" },
          );
        }
        if (careerRealm) {
          starterHabits.push(
            { user_id: user.id, realm_id: careerRealm.id, title: "Review today's priorities", frequency: "weekdays" },
          );
        }

        if (starterHabits.length > 0) {
          await supabase.from("habits").insert(starterHabits).select();
        }

        const { data: existingTasks } = await supabase
          .from("tasks")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (!existingTasks || existingTasks.length === 0) {
          const today = new Date().toISOString().slice(0, 10);
          await supabase.from("tasks").insert([
            { user_id: user.id, title: "Explore the Today dashboard", status: "todo", priority: "high", due_date: today },
            { user_id: user.id, title: "Set up a habit on the Habits page", status: "todo", priority: "medium", due_date: today },
            { user_id: user.id, title: "Log your first Body Pulse check-in", status: "todo", priority: "medium", due_date: today },
          ]);
        }
      }

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true, intended_use: intendedUse })
        .eq("user_id", user.id);

      if (pErr) {
        const { error: insErr } = await supabase
          .from("profiles")
          .upsert({ user_id: user.id, onboarding_completed: true, intended_use: intendedUse }, { onConflict: "user_id" });
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

  const isLastStep = step === 4;

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
            <StepIndicator steps={STEP_LABELS} current={step} />
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
              <div className="max-w-2xl space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-4 shadow-lg shadow-black/5 sm:px-6 sm:py-5">
                  <div
                    className="pointer-events-none absolute -right-20 -top-24 h-44 w-44 rounded-full opacity-[0.04]"
                    style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
                  />
                  <p className="relative z-10 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    Welcome to Life Pulse
                  </p>
                  <h2 className="relative z-10 text-xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-2xl">
                    Your personal operating system for building a better life.
                  </h2>
                  <p className="relative z-10 mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                    Plan your day, track your habits, reflect on your progress, and keep your most important goals connected in one private dashboard.
                  </p>
                </div>
                <p className="px-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  This is a private beta. Your honest feedback shapes what comes next.
                </p>
              </div>

              {/* Feature cards grid - spans full width */}
              <div>
                <FeatureTour />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in flex flex-col gap-8">
              <div className="max-w-2xl space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text)]">What are you using Life Pulse for?</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Choose the starting setup that best fits why you&apos;re here. You can change this later.
                  </p>
                </div>
                <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  This only personalizes your starting experience. It does not lock your account into one mode.
                </p>
              </div>

              <IntendedUseCards selected={intendedUse} onSelect={(value) => { setIntendedUse(value); setError(null); }} />

              {error && (
                <div className="rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]" role="alert">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
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

          {step === 3 && (
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

          {step === 4 && (
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
            <Button onClick={handleNext} disabled={saving || (step === 1 && !intendedUse) || (step === 2 && selectedRealms.size === 0)}>
              {step === 1 && !intendedUse ? "Choose setup" : step === 2 && selectedRealms.size === 0 ? "Select an area" : "Continue"}
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
