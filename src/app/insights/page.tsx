"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { getLevelInfo, getOverallTitle } from "@/lib/levels";
import { formatMoney } from "@/lib/config";
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
  const [activeGoalsCount, setActiveGoalsCount] = useState(0);
  const [linkedGoalsCount, setLinkedGoalsCount] = useState(0);
  const [unlinkedGoalsCount, setUnlinkedGoalsCount] = useState(0);
  const [projectLinksCount, setProjectLinksCount] = useState(0);
  const [taskLinksCount, setTaskLinksCount] = useState(0);
  const [habitLinksCount, setHabitLinksCount] = useState(0);
  const [financeIncome, setFinanceIncome] = useState(0);
  const [financeExpense, setFinanceExpense] = useState(0);
  const [financeNet, setFinanceNet] = useState(0);
  const [financeTransactionCount, setFinanceTransactionCount] = useState(0);
  const [financeCurrency, setFinanceCurrency] = useState<string | null>(null);
  const [financeHasMixedCurrencies, setFinanceHasMixedCurrencies] = useState(false);
  const [financeHasData, setFinanceHasData] = useState(false);
  const [journalEntriesThisMonth, setJournalEntriesThisMonth] = useState(0);
  const [knowledgeItemsThisMonth, setKnowledgeItemsThisMonth] = useState(0);
  const [latestKnowledgeTitle, setLatestKnowledgeTitle] = useState<string | null>(null);
  const [latestKnowledgeType, setLatestKnowledgeType] = useState<string | null>(null);
  const [topKnowledgeType, setTopKnowledgeType] = useState<string | null>(null);
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

      const year = today.slice(0, 4);
      const month = today.slice(5, 7);
      const monthStart = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      const knowledgeMonthStart = toLocalDateBoundaryIso(monthStart, "start");
      const knowledgeMonthEnd = toLocalDateBoundaryIso(monthEnd, "end");

      const [xpRes, todayXpRes, habitsRes, tasksRes, realmsRes, journalRes, habitLogsRes, projectsRes, goalsRes, goalLinksRes] = await Promise.all([
        supabase.from("xp_events").select("amount,source_type,source_id").eq("user_id", user.id),
        supabase.from("xp_events").select("amount").eq("user_id", user.id).gte("created_at", `${today}T00:00:00`),
        supabase.from("habits").select("id,frequency,days_of_week,times_per_week,realm_id").eq("user_id", user.id),
        supabase.from("tasks").select("id,status,realm_id").eq("user_id", user.id),
        supabase.from("realms").select("id,name,color,icon").eq("user_id", user.id).order("sort_order"),
        supabase.from("journal_entries").select("id").eq("user_id", user.id),
        supabase.from("habit_logs").select("id,habit_id,completed_date").eq("user_id", user.id),
        supabase.from("projects").select("status").eq("user_id", user.id),
        supabase.from("goals").select("id,status").eq("user_id", user.id),
        supabase.from("goal_links").select("goal_id, linked_type").eq("user_id", user.id),
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

      if (goalsRes.data) {
        const activeGoals = goalsRes.data.filter((goal: { status?: string }) => goal.status === "active") as { id: string }[];
        const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));
        const activeGoalLinks = ((goalLinksRes.data ?? []) as { goal_id?: string | null; linked_type?: string | null }[])
          .filter((link) => link.goal_id && activeGoalIds.has(link.goal_id));
        const linkedGoalIds = new Set(activeGoalLinks.map((link) => link.goal_id).filter(Boolean));

        setActiveGoalsCount(activeGoals.length);
        setLinkedGoalsCount(linkedGoalIds.size);
        setUnlinkedGoalsCount(activeGoals.length - linkedGoalIds.size);
        setProjectLinksCount(activeGoalLinks.filter((link) => link.linked_type === "project").length);
        setTaskLinksCount(activeGoalLinks.filter((link) => link.linked_type === "task").length);
        setHabitLinksCount(activeGoalLinks.filter((link) => link.linked_type === "habit").length);
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

      try {
        const [financeRes, journalMemoryRes, knowledgeMemoryRes] = await Promise.all([
          supabase.from("finance_transactions")
            .select("amount, type, transaction_date, account_id, finance_accounts(currency)")
            .eq("user_id", user.id)
            .gte("transaction_date", monthStart)
            .lte("transaction_date", monthEnd),
          supabase.from("journal_entries")
            .select("id, entry_date, mood, energy")
            .eq("user_id", user.id)
            .gte("entry_date", monthStart)
            .lte("entry_date", monthEnd),
          supabase.from("knowledge_items")
            .select("id, title, type, category, created_at")
            .eq("user_id", user.id)
            .gte("created_at", knowledgeMonthStart)
            .lte("created_at", knowledgeMonthEnd)
            .order("created_at", { ascending: false }),
        ]);

        if (!cancelled) {
          const financeTransactions = (financeRes.data ?? []) as {
            amount?: number | string | null;
            type?: string | null;
            finance_accounts?: { currency?: string | null } | { currency?: string | null }[] | null;
          }[];
          let inc = 0;
          let exp = 0;
          const currencies = new Set<string>();

          for (const tx of financeTransactions) {
            const amount = Number(tx.amount);
            if (!Number.isFinite(amount)) continue;

            if (tx.type === "income") inc += amount;
            if (tx.type === "expense") exp += amount;

            const account = Array.isArray(tx.finance_accounts) ? tx.finance_accounts[0] : tx.finance_accounts;
            if (account?.currency) currencies.add(account.currency);
          }

          const currencyList = Array.from(currencies);
          setFinanceIncome(inc);
          setFinanceExpense(exp);
          setFinanceNet(inc - exp);
          setFinanceTransactionCount(financeTransactions.length);
          setFinanceCurrency(currencyList.length === 1 ? currencyList[0] : null);
          setFinanceHasMixedCurrencies(currencyList.length > 1);
          setFinanceHasData(financeTransactions.length > 0);

          const journalMemoryEntries = (journalMemoryRes.data ?? []) as { id: string; entry_date?: string | null; mood?: string | null; energy?: number | null }[];
          const knowledgeMemoryItems = (knowledgeMemoryRes.data ?? []) as { title?: string | null; type?: string | null; category?: string | null }[];
          const latestKnowledge = knowledgeMemoryItems[0];

          setJournalEntriesThisMonth(journalMemoryEntries.length);
          setKnowledgeItemsThisMonth(knowledgeMemoryItems.length);
          setLatestKnowledgeTitle(makeMemoryLabel(latestKnowledge?.title ?? null));
          setLatestKnowledgeType(makeMemoryLabel(latestKnowledge?.type ?? null));
          setTopKnowledgeType(getTopValue(knowledgeMemoryItems.map((item) => item.type ?? null)));
        }
      } catch (secondaryError) {
        console.warn("Failed to load secondary Insights signals", secondaryError);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const levelInfo = getLevelInfo(totalXp);
  const overallTitle = getOverallTitle(levelInfo.level);
  const taskCompletionRate = taskCount > 0 ? Math.round((doneTaskCount / taskCount) * 100) : 0;
  const weekHabitRate = weekDueHabits > 0 ? Math.round((weekHabitLogs / weekDueHabits) * 100) : null;
  const insightSignalCount = totalXp + journalEntriesThisMonth + knowledgeItemsThisMonth + financeTransactionCount + weekHabitLogs;
  const hasSparseSignals = insightSignalCount === 0;

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
      <div className="mx-auto max-w-4xl overflow-x-hidden px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-8 min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
            Patterns from logged actions
          </p>
          <h1 className="break-words text-2xl font-bold text-[var(--text)]">Life Pulse Insights</h1>
          <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
            Patterns across your activity, consistency, and active life areas.
          </p>
          <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
            Insights are based on tasks, habits, reflections, and manual logs you add. Sparse data means fewer signals; more logged days make the picture clearer.
          </p>
        </div>

        {hasSparseSignals && (
          <Card variant="subtle" className="mb-8 border-dashed border-[var(--border)] bg-black/10">
            <div className="p-4 text-center sm:p-5">
              <p className="text-sm font-semibold text-[var(--text)]">Not enough logged signal yet.</p>
              <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-muted)]">
                Complete a few tasks or habits, write a reflection, or add body and mind check-ins. Insights stay private and only reflect what you log.
              </p>
              <Link href="/today" className="mt-3 inline-flex min-h-10 items-center rounded-md text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] sm:min-h-0">
                Start in Today &rarr;
              </Link>
            </div>
          </Card>
        )}

        {/* Overview — compact level card */}
        <LevelOverviewCard
          level={levelInfo.level}
          overallTitle={overallTitle}
          progressPercent={levelInfo.progressPercent}
          xpNeededForNext={levelInfo.xpNeededForNext}
          totalXp={totalXp}
        />

        <section className="mb-6">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Pattern snapshot
          </h2>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
              <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Strongest area</p>
              <p className="mt-2 break-words text-base font-bold leading-tight text-[var(--text)] sm:text-lg">
                {strongest ? `${strongest.icon} ${strongest.name}` : "\u2014"}
              </p>
              <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                {strongest ? `${Math.round(strongest.score)}% signal` : "No area signal yet"}
              </p>
            </Card>
            <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
              <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Needs attention</p>
              <p className="mt-2 break-words text-base font-bold leading-tight text-[var(--text)] sm:text-lg">
                {weakest ? `${weakest.icon} ${weakest.name}` : "\u2014"}
              </p>
              <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                {weakest ? `${Math.round(weakest.score)}% signal` : "No gap visible yet"}
              </p>
            </Card>
            <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
              <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Balance</p>
              <p className="mt-2 break-words text-2xl font-bold text-[var(--accent)]">
                {balanceScore !== null ? `${balanceScore}%` : "\u2014"}
              </p>
              <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">Across active areas</p>
            </Card>
            <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
              <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Task completion</p>
              <p className="mt-2 break-words text-2xl font-bold text-[var(--text)]">
                {taskCount > 0 ? `${taskCompletionRate}%` : "\u2014"}
              </p>
              <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                {taskCount > 0 ? `${doneTaskCount} of ${taskCount} done` : "No tasks yet"}
              </p>
            </Card>
          </div>
        </section>

        {/* Life Balance Map */}
        {(() => {
          const hasAnyXp = realmXp.some((r) => r.xp > 0);

          return (
            <div className="mb-8">
              <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="min-w-0 break-words text-sm font-semibold text-[var(--text)]">Life Balance Map</h2>
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <HelpPopover title="How the map works">
                      <p>Each angle represents one of your life areas. The farther a point extends outward, the more logged activity that area has received through completed habits, tasks, and projects.</p>
                      <p className="mt-1.5">Your Life Balance Map shows where logged energy is accumulating and where attention may be thin.</p>
                    </HelpPopover>
                  </div>
                </div>
                <button
                  onClick={handleOpenDialog}
                  className="flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] sm:min-h-0 sm:px-0"
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
                      Your balance map will take shape as you complete logged actions across your life areas.
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
                    <div className="flex min-w-0 flex-col gap-6 p-4 sm:flex-row sm:items-center sm:gap-8 sm:p-7">
                      {/* Chart */}
                      <div className="mx-auto w-full max-w-[260px] shrink-0 sm:mx-0 sm:max-w-[320px]">
                        <RealmRadarChart realms={scoredRealms} />
                      </div>

                      {/* Analysis panel */}
                      <div className="flex-1 min-w-0">
                        {hasAnyXp ? (
                          <div className="flex flex-col gap-4">
                            <p className="text-xs text-[var(--text-muted)]">
                              Your Life Balance Map shows where logged energy is accumulating and where attention may be thin.
                            </p>

                            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                  Strongest
                                </p>
                                {strongest && (
                                  <div className="mt-1.5">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="text-sm">{strongest.icon}</span>
                                      <span className="min-w-0 break-words text-sm font-semibold text-[var(--text)]">{strongest.name}</span>
                                      <span className="ml-auto text-[13px] font-bold tabular-nums" style={{ color: strongest.color }}>
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
                              <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                  Needs attention
                                </p>
                                {weakest && (
                                  <div className="mt-1.5">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="text-sm">{weakest.icon}</span>
                                      <span className="min-w-0 break-words text-sm font-semibold text-[var(--text)]">{weakest.name}</span>
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
                              <div className="flex min-w-0 flex-wrap items-center gap-2.5 pl-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                  Balance
                                </span>
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                                  <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-[var(--surface-soft)] sm:w-28 sm:flex-none">
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
                              Your Life Balance Map shows where logged energy is accumulating and where attention may be thin.
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
          Current momentum
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

        {activeGoalsCount > 0 && (
          <>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Execution alignment
            </h2>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              A read-only view of whether active goals are connected to projects, tasks, or habits.
            </p>
            <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Active goals</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">{activeGoalsCount}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">Currently active</p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Goals with action links</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">{linkedGoalsCount}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">Connected to action</p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Goals without action links</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">{unlinkedGoalsCount}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">No action link yet</p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Action links</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">{projectLinksCount + taskLinksCount + habitLinksCount}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                  {projectLinksCount} projects / {taskLinksCount} tasks / {habitLinksCount} habits
                </p>
              </Card>
            </div>
            <p className="mb-6 text-center text-[10px] text-[var(--text-muted)]">
              {unlinkedGoalsCount > 0
                ? "Some active goals are not connected to projects, tasks, or habits yet."
                : "Your active goals are connected to action."}
            </p>
          </>
        )}

        {/* Memory */}
        {(journalEntriesThisMonth > 0 || knowledgeItemsThisMonth > 0) && (
          <>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Memory signal
            </h2>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              A private, read-only view of reflection and knowledge activity captured manually.
            </p>
            <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Journal entries this month</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">{journalEntriesThisMonth}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">Reflection activity</p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Knowledge items this month</p>
                <p className="mt-2 text-2xl font-bold text-[var(--text)]">{knowledgeItemsThisMonth}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">Knowledge activity</p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Latest knowledge</p>
                <p className="mt-2 break-words text-base font-bold leading-tight text-[var(--text)] sm:text-lg">{latestKnowledgeTitle ?? "—"}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">{latestKnowledgeType ?? "This month"}</p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Most used type</p>
                <p className="mt-2 break-words text-base font-bold leading-tight text-[var(--text)] sm:text-lg">{topKnowledgeType ?? "—"}</p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">This month</p>
              </Card>
            </div>
            <p className="mb-6 text-center text-[10px] text-[var(--text-muted)]">
              Private manual memory. No AI summaries or external processing.
            </p>
          </>
        )}

        {/* Finance */}
        {financeHasData && (
          <>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Finance signal
            </h2>
            <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Logged income</p>
                <p className="mt-2 break-words text-xl font-bold leading-tight text-[var(--text)] sm:text-2xl">
                  {formatFinanceSignalAmount(financeIncome, financeCurrency, financeHasMixedCurrencies)}
                </p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                  {financeHasMixedCurrencies ? "Review detailed amounts in Finance" : "This month"}
                </p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Logged expenses</p>
                <p className="mt-2 break-words text-xl font-bold leading-tight text-[var(--text)] sm:text-2xl">
                  {formatFinanceSignalAmount(financeExpense, financeCurrency, financeHasMixedCurrencies)}
                </p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                  {financeHasMixedCurrencies ? "Review detailed amounts in Finance" : "This month"}
                </p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Net logged</p>
                <p className="mt-2 break-words text-xl font-bold leading-tight text-[var(--text)] sm:text-2xl">
                  {formatFinanceSignalAmount(financeNet, financeCurrency, financeHasMixedCurrencies)}
                </p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                  {financeHasMixedCurrencies ? "Review detailed amounts in Finance" : "This month"}
                </p>
              </Card>
              <Card variant="default" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
                <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Transactions this month</p>
                <p className="mt-2 break-words text-2xl font-bold text-[var(--text)]">
                  {financeTransactionCount}
                </p>
                <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">Manual tracker</p>
              </Card>
            </div>
            <p className="mb-6 text-center text-[10px] text-[var(--text-muted)]">
              Manual tracker. Not financial advice. No bank connection.
            </p>
          </>
        )}

        <div className="mb-6">
          <BodyProInsights />
        </div>

        <div className="mb-6">
          <PassionsInsights />
        </div>

        <div className="mb-6 space-y-2">
          <Link
            href="/weekly-review"
            className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="min-w-0 break-words">Run Weekly Review</span>
            </span>
            <span className="text-[var(--text-muted)]">&rarr;</span>
          </Link>
          <Link
            href="/knowledge"
            className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <span className="min-w-0 break-words">Open Knowledge</span>
            </span>
            <span className="text-[var(--text-muted)]">&rarr;</span>
          </Link>
          <Link
            href="/coach"
            className="flex min-h-11 min-w-0 flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)] sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex min-w-0 items-center gap-2">
              <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <span className="min-w-0 break-words">Review recommended next actions</span>
            </span>
            <span className="min-w-0 break-words text-[var(--text-muted)]">See recommended next actions &rarr;</span>
          </Link>
        </div>

        {/* Weekly consistency */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Consistency pattern
        </h2>

        <WeeklyConsistencyCard
          habitCount={habitCount}
          weekHabitLogs={weekHabitLogs}
          weekDueHabits={weekDueHabits}
          weekHabitRate={weekHabitRate}
        />

        {/* Habit streaks */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Streak health
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

function formatFinanceSignalAmount(amount: number, currency: string | null, hasMixedCurrencies: boolean): string {
  if (hasMixedCurrencies) return "Mixed currencies";
  return formatMoney(amount, 2, currency ?? undefined);
}

function toLocalDateBoundaryIso(dateString: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = boundary === "start"
    ? new Date(year, month - 1, day, 0, 0, 0, 0)
    : new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

function makeMemoryLabel(value: string | null): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 48 ? `${text.slice(0, 45)}...` : text;
}

function getTopValue(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = makeMemoryLabel(value);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let topValue: string | null = null;
  let topCount = 0;
  for (const [value, count] of counts) {
    if (count > topCount) {
      topValue = value;
      topCount = count;
    }
  }

  return topValue;
}
