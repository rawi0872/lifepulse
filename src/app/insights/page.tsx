"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { getLevelInfo, getOverallTitle } from "@/lib/levels";
import { HelpPopover } from "@/components/HelpPopover";
import { getCurrentStreak, getBestStreak } from "@/lib/streaks";
import {
  RealmRadarChart,
  RealmRadarExpandedDialog,
  computeRealmScores,
  getStrongestRealm,
  getWeakestRealm,
  computeBalanceScore,
  generateSuggestion,
} from "@/components/insights/RealmRadarChart";
import { InsightSkeleton } from "@/components/insights/InsightSkeleton";
import { LevelOverviewCard } from "@/components/insights/LevelOverviewCard";
import { MomentumGrid } from "@/components/insights/MomentumGrid";
import { WeeklyConsistencyCard } from "@/components/insights/WeeklyConsistencyCard";
import { HabitStreaksCard } from "@/components/insights/HabitStreaksCard";
import { RealmLevelList } from "@/components/insights/RealmLevelList";
import { BodyProInsights } from "@/components/insights/BodyProInsights";
import { PassionsInsights } from "@/components/insights/PassionsInsights";

interface RealmXp {
  name: string;
  color: string;
  icon: string;
  xp: number;
}

export default function InsightsPage() {
  const [totalXp, setTotalXp] = useState(0);
  const [todayXp, setTodayXp] = useState(0);
  const [habitCount, setHabitCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [doneTaskCount, setDoneTaskCount] = useState(0);
  const [journalCount, setJournalCount] = useState(0);
  const [weekHabitLogs, setWeekHabitLogs] = useState(0);
  const [weekDueHabits, setWeekDueHabits] = useState(0);
  const [realmXp, setRealmXp] = useState<RealmXp[]>([]);
  const [longestStreak, setLongestStreak] = useState(0);
  const [activeStreaks, setActiveStreaks] = useState(0);
  const [bestEverStreak, setBestEverStreak] = useState(0);
  const [activeProjectCount, setActiveProjectCount] = useState(0);
  const [financeIncome, setFinanceIncome] = useState(0);
  const [financeExpense, setFinanceExpense] = useState(0);
  const [financeNet, setFinanceNet] = useState(0);
  const [financeHasData, setFinanceHasData] = useState(false);
  const [financeBudgetTotal, setFinanceBudgetTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const today = getTodayDateString();
  const weekStart = getWeekStartDate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [xpRes, todayXpRes, habitsRes, tasksRes, realmsRes, journalRes, habitLogsRes, projectsRes] = await Promise.all([
        supabase.from("xp_events").select("amount,source_type,source_id").eq("user_id", user.id),
        supabase.from("xp_events").select("amount").eq("user_id", user.id).gte("created_at", `${today}T00:00:00`),
        supabase.from("habits").select("id,frequency,days_of_week,times_per_week,realm_id").eq("user_id", user.id),
        supabase.from("tasks").select("id,status,realm_id").eq("user_id", user.id),
        supabase.from("realms").select("id,name,color,icon").eq("user_id", user.id).order("sort_order"),
        supabase.from("journal_entries").select("id").eq("user_id", user.id),
        supabase.from("habit_logs").select("id,habit_id,completed_date").eq("user_id", user.id),
        supabase.from("projects").select("status").eq("user_id", user.id),
      ]);

      if (cancelled) return;

      if (xpRes.data) {
        const total = xpRes.data.reduce((s: number, e: { amount: number }) => s + e.amount, 0);
        setTotalXp(total);
      }
      if (todayXpRes.data) setTodayXp(todayXpRes.data.reduce((s: number, e: { amount: number }) => s + e.amount, 0));
      if (journalRes.data) setJournalCount(journalRes.data.length);

      if (habitsRes.data) {
        setHabitCount(habitsRes.data.length);
        const expected = habitsRes.data.reduce((sum: number, h: { frequency: string; days_of_week: number[] | null; times_per_week: number | null }) => {
          if (h.frequency === "daily") return sum + 7;
          if (h.frequency === "weekdays") return sum + (h.days_of_week?.length ?? 0);
          if (h.frequency === "times_per_week") return sum + (h.times_per_week ?? 1);
          return sum + 7;
        }, 0);
        setWeekDueHabits(expected);
      }

      if (tasksRes.data) {
        setTaskCount(tasksRes.data.length);
        setDoneTaskCount(tasksRes.data.filter((t: { status: string }) => t.status === "done").length);
      }

      if (projectsRes.data) {
        setActiveProjectCount(projectsRes.data.filter((p: { status: string }) => p.status === "active").length);
      }

      const year = today.slice(0, 4);
      const month = today.slice(5, 7);
      const monthStart = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

      const [incomeRes, expenseRes, budgetsRes] = await Promise.all([
        supabase.from("finance_transactions").select("amount").eq("user_id", user.id).eq("type", "income")
          .gte("transaction_date", monthStart).lte("transaction_date", monthEnd),
        supabase.from("finance_transactions").select("amount").eq("user_id", user.id).eq("type", "expense")
          .gte("transaction_date", monthStart).lte("transaction_date", monthEnd),
        supabase.from("finance_budgets").select("amount")
          .eq("user_id", user.id).eq("month", `${year}-${month}-01`),
      ]);

      if (!cancelled) {
        const inc = (incomeRes.data ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
        const exp = (expenseRes.data ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
        setFinanceIncome(inc);
        setFinanceExpense(exp);
        setFinanceNet(inc - exp);
        setFinanceHasData(inc > 0 || exp > 0);
        setFinanceBudgetTotal((budgetsRes.data ?? []).reduce((s: number, b: { amount: number }) => s + Number(b.amount), 0));
      }

      if (habitLogsRes.data) {
        const thisWeek = habitLogsRes.data.filter(
          (l: { completed_date: string }) => l.completed_date >= weekStart
        );
        setWeekHabitLogs(thisWeek.length);

        if (realmsRes.data && xpRes.data && habitsRes.data && tasksRes.data) {
          const habitRealm: Record<string, string> = {};
          habitsRes.data.forEach((h: { id: string; realm_id: string }) => { habitRealm[h.id] = h.realm_id; });

          const taskRealm: Record<string, string> = {};
          tasksRes.data.forEach((t: { id: string; realm_id: string }) => { taskRealm[t.id] = t.realm_id; });

          const logHabit: Record<string, string> = {};
          habitLogsRes.data.forEach((l: { id: string; habit_id: string }) => { logHabit[l.id] = l.habit_id; });

          const realmMap: Record<string, number> = {};
          realmsRes.data.forEach((r: { id: string }) => { realmMap[r.id] = 0; });

          xpRes.data.forEach((e: { source_type: string; source_id: string; amount: number }) => {
            let realmId: string | null = null;
            if (e.source_type === "habit") {
              const hid = logHabit[e.source_id];
              if (hid) realmId = habitRealm[hid] ?? null;
            } else if (e.source_type === "task") {
              realmId = taskRealm[e.source_id] ?? null;
            }
            if (realmId && realmMap[realmId] !== undefined) {
              realmMap[realmId] += e.amount;
            }
          });

          const list = realmsRes.data.map((r: { id: string; name: string; color: string; icon: string }) => ({
            name: r.name,
            color: r.color,
            icon: r.icon,
            xp: realmMap[r.id] ?? 0,
          })).sort((a: RealmXp, b: RealmXp) => b.xp - a.xp);

          setRealmXp(list);
        }
        // Streak calculation
        if (habitsRes.data && habitLogsRes.data) {
          const logsByHabit: Record<string, string[]> = {};
          habitLogsRes.data.forEach((l: { habit_id: string; completed_date: string }) => {
            if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = [];
            logsByHabit[l.habit_id].push(l.completed_date);
          });

          let longest = 0;
          let active = 0;
          let bestEver = 0;
          habitsRes.data.forEach((h: { id: string; frequency: string; days_of_week: number[] | null }) => {
            const dates = logsByHabit[h.id] ?? [];
            const current = getCurrentStreak(dates, h.frequency, h.days_of_week);
            const best = getBestStreak(dates, h.frequency, h.days_of_week);
            if (current > 0) active++;
            if (current > longest) longest = current;
            if (best > bestEver) bestEver = best;
          });
          setLongestStreak(longest);
          setActiveStreaks(active);
          setBestEverStreak(bestEver);
        }
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const levelInfo = getLevelInfo(totalXp);
  const overallTitle = getOverallTitle(levelInfo.level);
  const taskCompletionRate = taskCount > 0 ? Math.round((doneTaskCount / taskCount) * 100) : 0;
  const weekHabitRate = weekDueHabits > 0 ? Math.round((weekHabitLogs / weekDueHabits) * 100) : null;

  // Shared scoring for both the card and the dialog
  const scoredRealms = realmXp.length > 0
    ? computeRealmScores(realmXp, (xp) => {
        const info = getLevelInfo(xp);
        return { level: info.level, progressPercent: info.progressPercent };
      })
    : [];
  const strongest = scoredRealms.length > 0 ? getStrongestRealm(scoredRealms) : null;
  const weakest = scoredRealms.length > 0 ? getWeakestRealm(scoredRealms) : null;
  const balanceScore = scoredRealms.length > 0 ? computeBalanceScore(scoredRealms) : null;
  const suggestion = generateSuggestion(strongest, weakest);

  const handleOpenDialog = useCallback(() => setDialogOpen(true), []);

  if (loading) return <InsightSkeleton />;

  return (
    <DashboardNav>
      <div className="mx-auto max-w-4xl px-5 py-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text)]">Insights</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Your progress, levels, and consistency at a glance.
          </p>
        </div>

        {/* Overview — compact level card */}
        <LevelOverviewCard
          level={levelInfo.level}
          overallTitle={overallTitle}
          progressPercent={levelInfo.progressPercent}
          xpNeededForNext={levelInfo.xpNeededForNext}
          totalXp={totalXp}
        />

        {/* Life Balance Map */}
        {(() => {
          const hasAnyXp = realmXp.some((r) => r.xp > 0);

          return (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  Life Balance Map
                  <div onClick={(e) => e.stopPropagation()}>
                    <HelpPopover title="How the map works">
                      <p>Each angle represents one of your life areas. The farther a point extends outward, the more energy that area has received through completed habits, tasks, and projects.</p>
                      <p className="mt-1.5">A balanced shape means you are spreading your attention across multiple areas. Lopsided shapes show where your focus is concentrated.</p>
                    </HelpPopover>
                  </div>
                </h2>
                <button
                  onClick={handleOpenDialog}
                  className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-label="Open Life Balance Map details"
                >
                  <span>Expand</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M4 2h6v6M10 2L2 10" />
                  </svg>
                </button>
              </div>

              {scoredRealms.length === 0 ? (
                <Card variant="subtle" className="border-dashed border-[var(--border)]">
                  <div className="flex flex-col items-center justify-center p-10 text-center">
                    <div className="mb-6 h-[140px] w-[140px] opacity-30 select-none pointer-events-none">
                      <RealmRadarChart realms={[]} />
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      Your balance map will take shape as you complete actions across your life areas.
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Complete tasks, habits, and projects connected to life areas to shape your map.
                    </p>
                  </div>
                </Card>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleOpenDialog}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenDialog();
                    }
                  }}
                  aria-label="Open Life Balance Map details"
                  className="cursor-pointer group"
                >
                  <Card className="overflow-hidden border-[var(--border-strong)] transition-all duration-200 group-hover:border-[var(--accent)]/20 group-hover:shadow-sm group-hover:shadow-[var(--accent)]/5">
                    <div className="flex flex-col gap-8 p-6 sm:flex-row sm:items-center sm:p-7">
                      {/* Chart */}
                      <div className="mx-auto w-full max-w-[260px] shrink-0 sm:mx-0 sm:max-w-[320px]">
                        <RealmRadarChart realms={scoredRealms} />
                      </div>

                      {/* Analysis panel */}
                      <div className="flex-1 min-w-0">
                        {hasAnyXp ? (
                          <div className="flex flex-col gap-4">
                            <p className="text-xs text-[var(--text-muted)]">
                              See which areas of your life are getting the most energy — and which ones need attention.
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                  Strongest
                                </p>
                                {strongest && (
                                  <div className="mt-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{strongest.icon}</span>
                                      <span className="text-sm font-semibold text-[var(--text)]">{strongest.name}</span>
                                      <span className="text-[13px] font-bold tabular-nums ml-auto" style={{ color: strongest.color }}>
                                        {Math.round(strongest.score)}%
                                      </span>
                                    </div>
                                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${strongest.score}%`, backgroundColor: strongest.color, opacity: 0.6 }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                  Needs attention
                                </p>
                                {weakest && (
                                  <div className="mt-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{weakest.icon}</span>
                                      <span className="text-sm font-semibold text-[var(--text)]">{weakest.name}</span>
                                      <span className="text-[13px] font-bold tabular-nums ml-auto text-[var(--text-muted)]">
                                        {Math.round(weakest.score)}%
                                      </span>
                                    </div>
                                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${weakest.score}%`, backgroundColor: "var(--text-muted)", opacity: 0.25 }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {balanceScore !== null && (
                              <div className="flex items-center gap-2.5 pl-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                  Balance
                                </span>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-sm font-bold tabular-nums"
                                    style={{
                                      color: balanceScore >= 70
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
                                        backgroundColor: balanceScore >= 70
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

                            {suggestion && (
                              <p className="text-xs leading-relaxed text-[var(--text-muted)] border-t border-[var(--border)] pt-3.5">
                                {suggestion}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-[var(--text-muted)]">
                              See which areas of your life are getting the most energy — and which ones need attention.
                            </p>
                            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4 text-center">
                              <p className="text-xs text-[var(--text-muted)]">
                                Complete habits and tasks to start shaping your balance map.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          );
        })()}

        {/* Momentum */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Momentum
        </h2>
        <MomentumGrid
          todayXp={todayXp}
          today={today}
          activeProjectCount={activeProjectCount}
          taskCount={taskCount}
          doneTaskCount={doneTaskCount}
          taskCompletionRate={taskCompletionRate}
          journalCount={journalCount}
        />

        {/* Finance */}
        {financeHasData && (
          <>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Finance
            </h2>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card variant="default" className="flex flex-col p-4 min-h-[100px]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Income</p>
                <p className="mt-2 text-2xl font-bold text-green-400">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "ILS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(financeIncome)}
                </p>
                <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">This month</p>
              </Card>
              <Card variant="default" className="flex flex-col p-4 min-h-[100px]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Expenses</p>
                <p className="mt-2 text-2xl font-bold text-red-400">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "ILS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(financeExpense)}
                </p>
                <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">This month</p>
              </Card>
              <Card variant="default" className="flex flex-col p-4 min-h-[100px]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Net</p>
                <p className={`mt-2 text-2xl font-bold ${financeNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "ILS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(financeNet)}
                </p>
                <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">Cashflow</p>
              </Card>
              <Card variant="default" className="flex flex-col p-4 min-h-[100px]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Budget</p>
                <p className={`mt-2 text-2xl font-bold ${financeBudgetTotal > 0 ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                  {financeBudgetTotal > 0 ? `${Math.min(100, Math.round((financeExpense / financeBudgetTotal) * 100))}%` : "\u2014"}
                </p>
                <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">
                  {financeBudgetTotal > 0 ? "Used" : "No budgets"}
                </p>
              </Card>
            </div>
          </>
        )}

        <div className="mb-6">
          <BodyProInsights />
        </div>

        <div className="mb-6">
          <PassionsInsights />
        </div>

        <div className="mb-6">
          <Link
            href="/weekly-review"
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Open Weekly Review
            </span>
            <span className="text-[var(--text-muted)]">&rarr;</span>
          </Link>
          <Link
            href="/knowledge"
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              Open Knowledge
            </span>
            <span className="text-[var(--text-muted)]">&rarr;</span>
          </Link>
        </div>

        {/* Weekly consistency */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Weekly consistency
        </h2>

        <WeeklyConsistencyCard
          habitCount={habitCount}
          weekHabitLogs={weekHabitLogs}
          weekDueHabits={weekDueHabits}
          weekHabitRate={weekHabitRate}
        />

        {/* Habit streaks */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Habit streaks
        </h2>

        <HabitStreaksCard
          habitCount={habitCount}
          longestStreak={longestStreak}
          activeStreaks={activeStreaks}
          bestEverStreak={bestEverStreak}
        />

        {/* Expanded dialog */}
        <RealmRadarExpandedDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          scoredRealms={scoredRealms}
          realmXp={realmXp}
          strongest={strongest}
          weakest={weakest}
          balanceScore={balanceScore}
          suggestion={suggestion}
        />

        {/* Life area levels — bottom section */}
        <RealmLevelList realmXp={realmXp} />
      </div>
    </DashboardNav>
  );
}
