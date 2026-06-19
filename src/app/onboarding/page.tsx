"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DEFAULT_REALMS = [
  { name: "Mind", color: "#8b5cf6", icon: "🧠", description: "Learning, thinking, creativity" },
  { name: "Body", color: "#10b981", icon: "💪", description: "Health, fitness, nutrition" },
  { name: "Career", color: "#3b82f6", icon: "💼", description: "Work, skills, growth" },
  { name: "Relationships", color: "#f43f5e", icon: "❤️", description: "Family, friends, community" },
  { name: "Finance", color: "#f59e0b", icon: "💰", description: "Money, budgeting, investing" },
  { name: "Faith", color: "#a855f7", icon: "🙏", description: "Spirituality, purpose, faith" },
];

type Step = "welcome" | "habits" | "tasks" | "done";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [habitInput, setHabitInput] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [starterHabits, setStarterHabits] = useState<string[]>([]);
  const [starterTasks, setStarterTasks] = useState<string[]>([]);
  const [realmMap, setRealmMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleStart() {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from("realms")
        .select("id, name")
        .eq("user_id", user.id);

      if (existing && existing.length > 0) {
        const map: Record<string, string> = {};
        existing.forEach((r) => { map[r.name.toLowerCase()] = r.id; });
        setRealmMap(map);
        setStep("habits");
        setLoading(false);
        return;
      }

      const realmsToInsert = DEFAULT_REALMS.map((r, i) => ({
        user_id: user.id,
        name: r.name,
        color: r.color,
        icon: r.icon,
        sort_order: i,
      }));

      const { data, error: err } = await supabase
        .from("realms")
        .insert(realmsToInsert)
        .select();

      if (err) {
        setError("Failed to create realms. Please try again.");
        setLoading(false);
        return;
      }

      const map: Record<string, string> = {};
      data?.forEach((r) => { map[r.name.toLowerCase()] = r.id; });
      setRealmMap(map);
      setStep("habits");
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  function addHabit() {
    const habit = habitInput.trim();
    if (!habit || starterHabits.length >= 3) return;
    setStarterHabits([...starterHabits, habit]);
    setHabitInput("");
  }

  function addTask() {
    const task = taskInput.trim();
    if (!task || starterTasks.length >= 3) return;
    setStarterTasks([...starterTasks, task]);
    setTaskInput("");
  }

  async function finish() {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const errors: string[] = [];

      if (starterHabits.length > 0) {
        const habits = starterHabits.map((title) => ({
          user_id: user.id,
          realm_id: realmMap[title.toLowerCase()] || realmMap["mind"],
          title,
          frequency: "daily" as const,
        }));

        const { error: hErr } = await supabase.from("habits").insert(habits);
        if (hErr) errors.push("habits");
      }

      if (starterTasks.length > 0) {
        const tasks = starterTasks.map((title) => ({
          user_id: user.id,
          realm_id: realmMap["career"],
          title,
          priority: "medium" as const,
          status: "todo" as const,
        }));

        const { error: tErr } = await supabase.from("tasks").insert(tasks);
        if (tErr) errors.push("tasks");
      }

      if (errors.length > 0) {
        setError(`Failed to save: ${errors.join(", ")}. You can add them later.`);
        setLoading(false);
        return;
      }

      const { error: pErr } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      if (pErr) {
        setError("Failed to complete onboarding. Please try again.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  }

  if (step === "welcome") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-2xl font-bold text-[var(--accent)] ring-1 ring-[var(--accent-soft)]">
            LP
          </div>
          <h1 className="mb-2 text-3xl font-bold text-[var(--text)]">Welcome to Life Pulse</h1>
          <p className="mb-2 text-[var(--text-muted)]">
            Your personal command center. Let&apos;s set up your life areas.
          </p>
          <p className="mb-8 text-xs text-[var(--text-muted)]">
            Life areas (called realms) organize everything you track. Each habit and task belongs to a realm
            so you can see where you are spending your energy.
          </p>

          <Card className="mb-6 text-left">
            <h3 className="mb-3 font-semibold text-[var(--text)]">Your default life areas</h3>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_REALMS.map((r) => (
                <span
                  key={r.name}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                  style={{ backgroundColor: r.color + "20", color: r.color }}
                  title={r.description}
                >
                  {r.icon} {r.name}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              You can customize these later in Settings.
            </p>
          </Card>

          <Card className="mb-6 border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] text-left">
            <p className="text-xs text-[var(--text-muted)]">
              After setup, you will land on your <span className="text-[var(--text-secondary)]">Today</span> dashboard —
              your command center for planning, tracking, and reflecting every day.
            </p>
          </Card>

          {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

          <Button className="w-full" size="lg" onClick={handleStart} disabled={loading}>
            {loading ? "Setting up..." : "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "habits") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h1 className="mb-2 text-2xl font-bold text-[var(--text)]">Add starter habits</h1>
          <p className="mb-1 text-sm text-[var(--text-muted)]">
            Optional: add up to 3 daily habits you want to track.
          </p>
          <p className="mb-6 text-xs text-[var(--text-muted)]">
            These will appear on your Today dashboard. You can always add more later.
          </p>

          <div className="mb-4 flex gap-2">
            <input
              value={habitInput}
              onChange={(e) => setHabitInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              placeholder="e.g. Morning meditation"
              maxLength={100}
              className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 focus:outline-none"
            />
            <Button onClick={addHabit} disabled={starterHabits.length >= 3}>
              Add
            </Button>
          </div>

          {starterHabits.map((h, i) => (
            <div
              key={i}
              className="mb-2 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <span>{h}</span>
              <button
                onClick={() => setStarterHabits(starterHabits.filter((_, j) => j !== i))}
                className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep("tasks")} className="flex-1">
              Skip
            </Button>
            <Button onClick={() => setStep("tasks")} className="flex-1">
              Next
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "tasks") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h1 className="mb-2 text-2xl font-bold text-[var(--text)]">Add starter tasks</h1>
          <p className="mb-1 text-sm text-[var(--text-muted)]">
            Optional: add up to 3 tasks to get started.
          </p>
          <p className="mb-6 text-xs text-[var(--text-muted)]">
            You can manage all your tasks from the Tasks page later.
          </p>

          <div className="mb-4 flex gap-2">
            <input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="e.g. Finish project report"
              maxLength={200}
              className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 focus:outline-none"
            />
            <Button onClick={addTask} disabled={starterTasks.length >= 3}>
              Add
            </Button>
          </div>

          {starterTasks.map((t, i) => (
            <div
              key={i}
              className="mb-2 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <span>{t}</span>
              <button
                onClick={() => setStarterTasks(starterTasks.filter((_, j) => j !== i))}
                className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                ✕
              </button>
            </div>
          ))}

          {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={finish} className="flex-1" disabled={loading}>
              {loading ? "Finishing..." : "Skip for now"}
            </Button>
            <Button onClick={finish} className="flex-1" disabled={loading}>
              {loading ? "Finishing..." : "Finish setup"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
