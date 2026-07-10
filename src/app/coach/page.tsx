"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { PulseCard } from "@/components/ui/pulse-card";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import type { CoachInsight, CoachData } from "@/lib/coach";
import {
  getCoachInsights,
  sortByPriority,
  getCategoryLabel,
  getHighestPriority,
} from "@/lib/coach";

export default function CoachPage() {
  return (
    <DashboardNav>
      <CoachContent />
    </DashboardNav>
  );
}

function toLocalDateBoundaryIso(dateString: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

function CoachContent() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const today = getTodayDateString();
      const weekStart = getWeekStartDate();
      const knowledgeWeekStart = toLocalDateBoundaryIso(weekStart, "start");
      const knowledgeWeekEnd = toLocalDateBoundaryIso(today, "end");
      const dayOfWeek = new Date().getDay();

      const [
        bodyRes, mindRes, tasksRes, goalsRes, goalLinksRes,
        journalRes, habitsRes, workoutRes,
        nutritionRes, passionsRes, sessionsRes, financeRes, financeWeekRes,
        knowledgeRes, collectionsRes, journalWeekRes, knowledgeWeekRes,
      ] = await Promise.all([
        supabase.from("body_metrics").select("id, entry_date").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", today),
        supabase.from("mind_metrics").select("id").eq("user_id", user.id).eq("entry_date", today).maybeSingle(),
        supabase.from("tasks").select("id,priority,status,realm_id").eq("user_id", user.id),
        supabase.from("goals").select("id,status").eq("user_id", user.id),
        supabase.from("goal_links").select("goal_id").eq("user_id", user.id),
        supabase.from("journal_entries").select("id").eq("user_id", user.id).eq("entry_date", today).maybeSingle(),
        supabase.from("habits").select("id").eq("user_id", user.id),
        supabase.from("workouts").select("id, duration_minutes").eq("user_id", user.id).gte("workout_date", weekStart).lte("workout_date", today),
        supabase.from("nutrition_logs").select("id, log_date").eq("user_id", user.id).gte("log_date", weekStart).lte("log_date", today),
        supabase.from("passions").select("id").eq("user_id", user.id),
        supabase.from("passion_sessions").select("id").eq("user_id", user.id).gte("session_date", weekStart),
        supabase.from("finance_transactions").select("id").eq("user_id", user.id).limit(1),
        supabase.from("finance_transactions").select("id").eq("user_id", user.id).gte("transaction_date", weekStart).lte("transaction_date", today),
        supabase.from("knowledge_items").select("id").eq("user_id", user.id).limit(1),
        supabase.from("knowledge_collections").select("id").eq("user_id", user.id).limit(1),
        supabase.from("journal_entries").select("id, entry_date").eq("user_id", user.id).gte("entry_date", weekStart).lte("entry_date", today),
        supabase.from("knowledge_items").select("id, created_at").eq("user_id", user.id).gte("created_at", knowledgeWeekStart).lte("created_at", knowledgeWeekEnd),
      ]);

      if (cancelled) return;

      const activeGoals = (goalsRes.data ?? []).filter((g: { status?: string }) => g.status === "active");
      const linkedGoalIds = new Set((goalLinksRes.data ?? []).map((link: { goal_id?: string | null }) => link.goal_id).filter(Boolean));
      const hasGoalWithoutLinks = activeGoals.length > 0 && activeGoals.some((goal: { id?: string }) => !linkedGoalIds.has(goal.id));
      const hasContent = (habitsRes.data ?? []).length > 0 || (tasksRes.data ?? []).length > 0;
      const hasHighPriorityTasks = (tasksRes.data ?? []).some(
        (t: { priority?: string; status?: string }) => t.priority === "high" && t.status === "todo"
      );
      const hasActivePassions = (passionsRes.data ?? []).length > 0;
      const bodyMetrics = (bodyRes.data ?? []) as { entry_date?: string | null }[];
      const workouts = (workoutRes.data ?? []) as { duration_minutes?: number | null }[];
      const nutritionLogs = (nutritionRes.data ?? []) as { log_date?: string | null }[];
      const nutritionDaysThisWeek = new Set(nutritionLogs.map((n) => n.log_date).filter(Boolean)).size;

      const coachData: CoachData = {
        bodyLoggedToday: bodyMetrics.some((b) => b.entry_date === today),
        mindLoggedToday: mindRes.data !== null,
        hasWorkoutThisWeek: workouts.length > 0,
        hasNutritionToday: nutritionLogs.some((n) => n.log_date === today),
        hasHighPriorityTasks,
        hasGoalWithoutLinks,
        hasJournalToday: journalRes.data !== null,
        hasContent,
        hasActivePassions,
        hasPassionSessionThisWeek: (sessionsRes.data ?? []).length > 0,
        dayOfWeek,
        hasFinanceData: (financeRes.data ?? []).length > 0,
        hasKnowledgeItems: (knowledgeRes.data ?? []).length > 0,
        hasKnowledgeCollections: (collectionsRes.data ?? []).length > 0,
        bodyCheckInsThisWeek: bodyMetrics.length,
        nutritionDaysThisWeek,
        workoutCountThisWeek: workouts.length,
        workoutMinutesThisWeek: workouts.reduce((sum, workout) => sum + (workout.duration_minutes ?? 0), 0),
        financeTransactionsThisWeek: (financeWeekRes.data ?? []).length,
        weeklyJournalEntries: (journalWeekRes.data ?? []).length,
        weeklyKnowledgeItems: (knowledgeWeekRes.data ?? []).length,
      };

      if (!cancelled) {
        setHasContent(hasContent);
        setInsights(sortByPriority(getCoachInsights(coachData)));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-5 sm:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-[var(--surface)]" />
          <div className="h-4 w-56 rounded bg-[var(--surface)] sm:w-72" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-[var(--surface)]" />
            ))}
          </div>
          <div className="h-40 rounded-lg bg-[var(--surface)]" />
          <div className="h-40 rounded-lg bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  const topPriority = getHighestPriority(insights);

  const areaBreakdowns: { label: string; icon: string; category: string }[] = [
    { label: "Body", icon: "\u{1F3CB}", category: "body" },
    { label: "Mind", icon: "\u{1F9E0}", category: "mind" },
    { label: "Tasks", icon: "\u2713", category: "tasks" },
    { label: "Goals", icon: "\u{1F3AF}", category: "goals" },
    { label: "Reflection", icon: "\u270E", category: "general" },
    { label: "Passions", icon: "\u{2B50}", category: "passions" },
    { label: "Knowledge", icon: "\u{1F4DA}", category: "knowledge" },
    { label: "Finance", icon: "\u{1F4B0}", category: "finance" },
    { label: "Weekly Review", icon: "\u21BB", category: "weekly_review" },
  ];

  const categoryHasIssues = (cat: string) => insights.some((i) => i.category === cat);

  return (
    <div className="mx-auto max-w-4xl overflow-x-hidden px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
      {/* Header */}
      <div className="mb-6 min-w-0">
        <h1 className="break-words text-2xl font-bold text-[var(--text)]">Life Pulse Coach</h1>
        <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
          Transparent, rule-based recommendations from your current Life Pulse signals.{" "}
          {topPriority && (
            <span className="text-[var(--accent)]">
              Highest priority: {topPriority}
            </span>
          )}
        </p>
      </div>

      {/* 1. Overview */}
      <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex min-h-[92px] min-w-0 flex-col justify-center p-3.5">
          <p className="break-words text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Recommendations
          </p>
          <p className="mt-1.5 break-words text-2xl font-bold text-[var(--text)]">
            {insights.length}
          </p>
        </Card>
        <Card className="flex min-h-[92px] min-w-0 flex-col justify-center p-3.5">
          <p className="break-words text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Highest priority
          </p>
          <p className="mt-1.5 break-words text-xl font-bold leading-tight text-[var(--text)] [overflow-wrap:anywhere] sm:text-2xl">
            {topPriority ?? "\u2014"}
          </p>
        </Card>
        <Card className="flex min-h-[92px] min-w-0 flex-col justify-center p-3.5">
          <p className="break-words text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Areas covered
          </p>
          <p className="mt-1.5 break-words text-2xl font-bold text-[var(--text)]">
            {new Set(insights.map((i) => i.category)).size}
          </p>
        </Card>
        <Card className="flex min-h-[92px] min-w-0 flex-col justify-center p-3.5">
          <p className="break-words text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Engine
          </p>
          <p className="mt-1.5 break-words text-lg font-bold text-[var(--accent)]">
            Rules
          </p>
        </Card>
      </div>

      <p className="mb-6 text-xs text-[var(--text-muted)]">
        Coach is currently rule-based. It checks logged activity, missing check-ins,
        weekly rhythm, and time-sensitive patterns. No AI summaries, AI memory, or
        external APIs are enabled.
      </p>

      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Connected workflow
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/today"
            className="min-h-24 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:bg-[var(--surface)]"
          >
            <p className="break-words text-sm font-semibold text-[var(--text)]">Open Today</p>
            <p className="mt-1 break-words text-xs text-[var(--text-muted)]">Turn recommendations into today&apos;s priorities.</p>
          </Link>
          <Link
            href="/weekly-review"
            className="min-h-24 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:bg-[var(--surface)]"
          >
            <p className="break-words text-sm font-semibold text-[var(--text)]">Run Weekly Review</p>
            <p className="mt-1 break-words text-xs text-[var(--text-muted)]">Reflect and choose next week&apos;s focus.</p>
          </Link>
          <Link
            href="/insights"
            className="min-h-24 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:bg-[var(--surface)]"
          >
            <p className="break-words text-sm font-semibold text-[var(--text)]">Open Insights</p>
            <p className="mt-1 break-words text-xs text-[var(--text-muted)]">See the patterns behind your recommendations.</p>
          </Link>
        </div>
      </section>

      {/* 2. Recommended Next Actions */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Recommended next actions
          </h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Start with the highest-priority action, then use Today to turn it into a concrete plan.
        </p>

        {insights.length === 0 ? (
          <Card variant="subtle" className="border-dashed border-[var(--border)]">
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <svg className="mb-3 h-10 w-10 text-[var(--success)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[var(--text-muted)]">All areas look good!</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                No recommendations right now. Review Today, run a Weekly Review, or keep logging habits, tasks, and check-ins.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <PulseCard
                key={insight.id}
                title={insight.title}
                description={getCategoryLabel(insight.category)}
                accent={
                  insight.priority === "high"
                    ? "accent"
                    : insight.priority === "medium"
                    ? "warning"
                    : "none"
                }
                action={
                  <Link
                    href={insight.actionHref}
                    className="inline-flex min-h-10 max-w-36 items-center justify-center rounded-md bg-[var(--accent)] px-3 py-2 text-center text-xs font-semibold leading-snug text-white transition-opacity hover:opacity-90 [overflow-wrap:anywhere] sm:min-h-0 sm:max-w-none sm:py-1.5"
                  >
                    {insight.actionLabel}
                  </Link>
                }
                variant="elevated"
              >
                <div className="min-w-0 px-3.5 py-3 sm:px-4">
                  <p className="break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                    {insight.message}
                  </p>
                  <p className="mt-2 break-words text-[10px] leading-relaxed text-[var(--text-muted)]">
                    Why: {insight.reason}
                  </p>
                </div>
              </PulseCard>
            ))}
          </div>
        )}
      </section>

      {/* 3. Signal Breakdown */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Signal breakdown
          </h2>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          See which parts of your ecosystem are generating recommendations.
        </p>

        {!hasContent && (
          <Card variant="subtle" className="mb-4 border-dashed border-[var(--border)]">
            <div className="p-4 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                Start by adding habits, tasks, check-ins, or a weekly review. Coach will analyze your logged data once you have some.
              </p>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {areaBreakdowns.map((area) => {
            const hasIssue = categoryHasIssues(area.category);
            const areaInsights = insights.filter((i) => i.category === area.category);
            return (
              <Card
                key={area.category}
                variant={hasIssue ? "default" : "subtle"}
                className={`min-w-0 p-4 ${!hasIssue ? "border-dashed border-[var(--border)]" : ""}`}
              >
                <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm">{area.icon}</span>
                    <span className="min-w-0 break-words text-xs font-semibold text-[var(--text)]">
                      {area.label}
                    </span>
                  </div>
                  {hasIssue ? (
                    <span className="shrink-0 rounded-full bg-[var(--warning-soft)] px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-[var(--warning)]">
                      {areaInsights.length} action{areaInsights.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[var(--success-soft)] px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-[var(--success)]">
                      On track
                    </span>
                  )}
                </div>
                {hasIssue ? (
                  <ul className="space-y-1">
                    {areaInsights.map((insight) => (
                      <li key={insight.id}>
                        <Link
                          href={insight.actionHref}
                          className="inline-block min-h-8 break-words text-xs leading-relaxed text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] sm:min-h-0"
                        >
                          {insight.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-[var(--text-muted)]">No issues detected.</p>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4. Coach Rules Transparency */}
      <section className="mb-8">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Transparent rule engine
          </h2>
        </div>
        <PulseCard title="Rule-based guidance" accent="none" variant="subtle">
          <div className="space-y-2 px-3.5 py-3 sm:px-4">
            <p className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">
              Life Pulse Coach currently uses simple rules based on your logged data.
              It checks logged activity, missing check-ins, weekly rhythm, and
              time-sensitive patterns to suggest a helpful next action.
            </p>
            <p className="break-words text-xs leading-relaxed text-[var(--text-muted)]">
              No AI summaries, AI memory, or external APIs are enabled. For now,
              everything is transparent, deterministic, and based only on your data.
            </p>
            <div className="pt-1">
              <p className="text-[10px] font-medium text-[var(--text-muted)]">
                Coach checks the following areas:
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {["Body check-in", "Mind check-in", "Workouts", "Nutrition", "Tasks",
                  "Goals", "Journal", "Passions", "Knowledge", "Finance", "Weekly rhythm"
                ].map((area) => (
                  <span
                    key={area}
                    className="inline-block min-h-7 rounded-full bg-[var(--surface)] px-2.5 py-1.5 text-[9px] leading-tight text-[var(--text-muted)]"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </PulseCard>
      </section>

      <p className="text-[10px] text-[var(--text-muted)] text-center">
        Coach does not provide medical, therapeutic, or financial advice.
      </p>
    </div>
  );
}
