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
      const dayOfWeek = new Date().getDay();

      const [
        bodyRes, mindRes, tasksRes, goalsRes, goalMsRes,
        journalRes, habitsRes, workoutRes,
        nutritionRes, passionsRes, sessionsRes, financeRes,
        knowledgeRes, collectionsRes,
      ] = await Promise.all([
        supabase.from("body_metrics").select("id").eq("user_id", user.id).eq("entry_date", today).maybeSingle(),
        supabase.from("mind_metrics").select("id").eq("user_id", user.id).eq("entry_date", today).maybeSingle(),
        supabase.from("tasks").select("id,priority,status,realm_id").eq("user_id", user.id),
        supabase.from("goals").select("id,status").eq("user_id", user.id),
        supabase.from("goal_milestones").select("goal_id,completed_at").eq("user_id", user.id),
        supabase.from("journal_entries").select("id").eq("user_id", user.id).eq("entry_date", today).maybeSingle(),
        supabase.from("habits").select("id").eq("user_id", user.id),
        supabase.from("workouts").select("id").eq("user_id", user.id).gte("workout_date", weekStart),
        supabase.from("nutrition_logs").select("id").eq("user_id", user.id).eq("log_date", today),
        supabase.from("passions").select("id").eq("user_id", user.id),
        supabase.from("passion_sessions").select("id").eq("user_id", user.id).gte("session_date", weekStart),
        supabase.from("finance_transactions").select("id").eq("user_id", user.id).limit(1),
        supabase.from("knowledge_items").select("id").eq("user_id", user.id).limit(1),
        supabase.from("knowledge_collections").select("id").eq("user_id", user.id).limit(1),
      ]);

      if (cancelled) return;

      const hasGoals = (goalsRes.data ?? []).length > 0;
      const hasMilestones = (goalMsRes.data ?? []).length > 0;
      const hasGoalWithoutLinks = hasGoals && !hasMilestones;
      const hasContent = (habitsRes.data ?? []).length > 0 || (tasksRes.data ?? []).length > 0;
      const hasHighPriorityTasks = (tasksRes.data ?? []).some(
        (t: { priority?: string; status?: string }) => t.priority === "high" && t.status === "todo"
      );
      const hasActivePassions = (passionsRes.data ?? []).length > 0;

      const coachData: CoachData = {
        bodyLoggedToday: bodyRes.data !== null,
        mindLoggedToday: mindRes.data !== null,
        hasWorkoutThisWeek: (workoutRes.data ?? []).length > 0,
        hasNutritionToday: (nutritionRes.data ?? []).length > 0,
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
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-[var(--surface)]" />
          <div className="h-4 w-72 rounded bg-[var(--surface)]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
    <div className="mx-auto max-w-4xl px-5 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Life Pulse Coach</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Transparent, rule-based recommendations from your current Life Pulse signals.{" "}
          {topPriority && (
            <span className="text-[var(--accent)]">
              Highest priority: {topPriority}
            </span>
          )}
        </p>
      </div>

      {/* 1. Overview */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Recommendations
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text)]">
            {insights.length}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Highest priority
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text)]">
            {topPriority ?? "\u2014"}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Areas covered
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--text)]">
            {new Set(insights.map((i) => i.category)).size}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Engine
          </p>
          <p className="mt-1.5 text-lg font-bold text-[var(--accent)]">
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
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Connected workflow
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/today"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:bg-[var(--surface)]"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Open Today</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Turn recommendations into today&apos;s priorities.</p>
          </Link>
          <Link
            href="/weekly-review"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:bg-[var(--surface)]"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Run Weekly Review</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Reflect and choose next week&apos;s focus.</p>
          </Link>
          <Link
            href="/insights"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:bg-[var(--surface)]"
          >
            <p className="text-sm font-semibold text-[var(--text)]">Open Insights</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">See the patterns behind your recommendations.</p>
          </Link>
        </div>
      </section>

      {/* 2. Recommended Next Actions */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
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
                    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    {insight.actionLabel}
                  </Link>
                }
                variant="elevated"
              >
                <div className="px-4 py-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    {insight.message}
                  </p>
                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">
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
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
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
                className={`p-4 ${!hasIssue ? "border-dashed border-[var(--border)]" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{area.icon}</span>
                    <span className="text-xs font-semibold text-[var(--text)]">
                      {area.label}
                    </span>
                  </div>
                  {hasIssue ? (
                    <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--warning)]">
                      {areaInsights.length} action{areaInsights.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--success)]">
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
                          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
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
        <div className="mb-3 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Transparent rule engine
          </h2>
        </div>
        <PulseCard title="Rule-based guidance" accent="none" variant="subtle">
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-[var(--text-secondary)]">
              Life Pulse Coach currently uses simple rules based on your logged data.
              It checks logged activity, missing check-ins, weekly rhythm, and
              time-sensitive patterns to suggest a helpful next action.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
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
                    className="inline-block rounded-full bg-[var(--surface)] px-2 py-0.5 text-[9px] text-[var(--text-muted)]"
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
