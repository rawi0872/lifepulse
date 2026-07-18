"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { getLevelInfo, getOverallTitle } from "@/lib/levels";
import { formatMoney } from "@/lib/config";
import { getCurrentStreak, getBestStreak } from "@/lib/streaks";
import { InsightSkeleton } from "@/components/insights/InsightSkeleton";
import { LevelOverviewCard } from "@/components/insights/LevelOverviewCard";
import { MomentumGrid } from "@/components/insights/MomentumGrid";
import { WeeklyConsistencyCard } from "@/components/insights/WeeklyConsistencyCard";
import { HabitStreaksCard } from "@/components/insights/HabitStreaksCard";
import { RealmLevelList } from "@/components/insights/RealmLevelList";
import { BodyProInsights } from "@/components/insights/BodyProInsights";
import { PassionsInsights } from "@/components/insights/PassionsInsights";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface RealmXp {
  name: string;
  color: string;
  icon: string;
  xp: number;
}

interface InsightTrendDay {
  date: string;
  label: string;
  tasks: number;
  habits: number;
  reflections: number;
  mind: number;
  body: number;
  nutrition: number;
  finance: number;
  total: number;
}

interface InsightTrendData {
  days: InsightTrendDay[];
  taskDays: number;
  completedTasks: number;
  habitDays: number;
  habitLogs: number;
  reflectionDays: number;
  reflections: number;
  mindDays: number;
  mindCheckins: number;
  bodyNutritionDays: number;
  bodyNutritionCheckins: number;
  financeDays: number;
  financeEntries: number;
  loggedDays: number;
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
  const [trendData, setTrendData] = useState<InsightTrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [supabase] = useState(() => createClient());
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
      const recentDates = getRecentDates(today, 7);
      const recentStart = recentDates[0];
      const recentEnd = recentDates[recentDates.length - 1];
      setTrendLoading(true);
      setTrendData(null);

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
        const [
          financeRes,
          journalMemoryRes,
          knowledgeMemoryRes,
          recentTasksRes,
          recentHabitLogsRes,
          recentJournalRes,
          recentMindRes,
          recentBodyRes,
          recentNutritionRes,
          recentFinanceRes,
        ] = await Promise.all([
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
          supabase.from("tasks")
            .select("completed_at")
            .eq("user_id", user.id)
            .eq("status", "done")
            .gte("completed_at", `${recentStart}T00:00:00`)
            .lte("completed_at", `${recentEnd}T23:59:59`),
          supabase.from("habit_logs")
            .select("completed_date")
            .eq("user_id", user.id)
            .gte("completed_date", recentStart)
            .lte("completed_date", recentEnd),
          supabase.from("journal_entries")
            .select("entry_date")
            .eq("user_id", user.id)
            .gte("entry_date", recentStart)
            .lte("entry_date", recentEnd),
          supabase.from("mind_metrics")
            .select("entry_date")
            .eq("user_id", user.id)
            .gte("entry_date", recentStart)
            .lte("entry_date", recentEnd),
          supabase.from("body_metrics")
            .select("entry_date")
            .eq("user_id", user.id)
            .gte("entry_date", recentStart)
            .lte("entry_date", recentEnd),
          supabase.from("nutrition_logs")
            .select("log_date")
            .eq("user_id", user.id)
            .gte("log_date", recentStart)
            .lte("log_date", recentEnd),
          supabase.from("finance_transactions")
            .select("transaction_date")
            .eq("user_id", user.id)
            .gte("transaction_date", recentStart)
            .lte("transaction_date", recentEnd),
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
          setTrendData(buildInsightTrendData(recentDates, {
            tasks: (recentTasksRes.data ?? []) as { completed_at?: string | null }[],
            habits: (recentHabitLogsRes.data ?? []) as { completed_date?: string | null }[],
            reflections: (recentJournalRes.data ?? []) as { entry_date?: string | null }[],
            mind: (recentMindRes.data ?? []) as { entry_date?: string | null }[],
            body: (recentBodyRes.data ?? []) as { entry_date?: string | null }[],
            nutrition: (recentNutritionRes.data ?? []) as { log_date?: string | null }[],
            finance: (recentFinanceRes.data ?? []) as { transaction_date?: string | null }[],
          }));
        }
      } catch (secondaryError) {
        console.warn("Failed to load secondary Insights signals", secondaryError);
      } finally {
        if (!cancelled) setTrendLoading(false);
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
  const insightSignalCount = totalXp + journalEntriesThisMonth + knowledgeItemsThisMonth + financeTransactionCount + weekHabitLogs + (trendData?.loggedDays ?? 0);
  const hasSparseSignals = insightSignalCount === 0;
  const quietAreas = useMemo(
    () => buildQuietAreas(trendData, {
      activeProjectCount,
      activeGoalsCount,
      financeHasData,
      journalEntriesThisMonth,
      knowledgeItemsThisMonth,
    }),
    [activeGoalsCount, activeProjectCount, financeHasData, journalEntriesThisMonth, knowledgeItemsThisMonth, trendData]
  );

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
            Insights are based on tasks, habits, reflections, and optional manual context you add. During the first week, start with Today and let patterns build from a few logged days.
          </p>
        </div>

        {hasSparseSignals && (
          <Card variant="subtle" className="mb-8 border-dashed border-[var(--border)] bg-black/10">
            <div className="p-4 text-center sm:p-5">
              <p className="text-sm font-semibold text-[var(--text)]">Not enough logged signal yet.</p>
              <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-muted)]">
                Start with Today: one priority, one visible action, and a reflection. Insights stay private and only reflect what you log.
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

        <InsightOverview trendData={trendData} trendLoading={trendLoading} />

        <section className="mb-6">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Pattern snapshot
          </h2>
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
              <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Logged days</p>
              <p className="mt-2 break-words text-base font-bold leading-tight text-[var(--text)] sm:text-lg">
                {trendData ? `${trendData.loggedDays} / 7` : "-"}
              </p>
              <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                Last 7 days
              </p>
            </Card>
            <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
              <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Action days</p>
              <p className="mt-2 break-words text-base font-bold leading-tight text-[var(--text)] sm:text-lg">
                {trendData ? `${countDaysWithAction(trendData)} / 7` : "-"}
              </p>
              <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">
                Tasks or habits logged
              </p>
            </Card>
            <Card variant="subtle" className="flex min-h-[100px] min-w-0 flex-col p-3.5 sm:p-4">
              <p className="break-words text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Reflection days</p>
              <p className="mt-2 break-words text-2xl font-bold text-[var(--accent)]">
                {trendData ? `${trendData.reflectionDays}` : "-"}
              </p>
              <p className="mt-auto break-words pt-2 text-[10px] leading-snug text-[var(--text-muted)]">Journal entries in last 7 days</p>
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

        <ActivityTrends trendData={trendData} trendLoading={trendLoading} />
        <DomainSignals
          trendData={trendData}
          activeProjectCount={activeProjectCount}
          activeGoalsCount={activeGoalsCount}
          financeHasData={financeHasData}
          journalEntriesThisMonth={journalEntriesThisMonth}
          knowledgeItemsThisMonth={knowledgeItemsThisMonth}
        />
        <QuietAreas areas={quietAreas} trendLoading={trendLoading} />
        <ReviewLinks />

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

function InsightOverview({ trendData, trendLoading }: { trendData: InsightTrendData | null; trendLoading: boolean }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Insight overview
      </h2>
      <Card className="min-w-0 overflow-hidden border-[var(--border)] bg-[linear-gradient(180deg,rgba(244,247,251,0.035),rgba(244,247,251,0.01)),var(--surface)]">
        <div className="p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">Recent patterns from logged activity</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                Insights shows broad patterns from manual entries. Weekly Review is the deeper weekly close-out.
              </p>
            </div>
            <span className="w-fit rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] text-[var(--text-muted)]">
              Last 7 days
            </span>
          </div>

          {trendLoading && !trendData ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
              ))}
            </div>
          ) : trendData ? (
            <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <InsightCountCard label="Logged days" value={`${trendData.loggedDays} / 7`} detail="Any manual signal" />
              <InsightCountCard label="Tasks completed" value={trendData.completedTasks} detail={`${trendData.taskDays} day${trendData.taskDays === 1 ? "" : "s"}`} />
              <InsightCountCard label="Habits logged" value={trendData.habitLogs} detail={`${trendData.habitDays} day${trendData.habitDays === 1 ? "" : "s"}`} />
              <InsightCountCard label="Reflections" value={trendData.reflections} detail={`${trendData.reflectionDays} day${trendData.reflectionDays === 1 ? "" : "s"}`} />
            </div>
          ) : (
            <QuietNotice />
          )}
        </div>
        <p className="border-t border-[var(--border)] px-4 py-3 text-[10px] leading-relaxed text-[var(--text-muted)] sm:px-5">
          Private manual context from what you enter. No AI summaries or external processing.
        </p>
      </Card>
    </section>
  );
}

function ActivityTrends({ trendData, trendLoading }: { trendData: InsightTrendData | null; trendLoading: boolean }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Activity trends
      </h2>
      <Card className="min-w-0 p-4 sm:p-5">
        <div className="mb-4 min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">7-day rhythm</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Tasks, habits, reflections, and manual check-ins by day. Based on logged activity only.
          </p>
        </div>
        {trendLoading && !trendData ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-10 rounded-xl bg-[var(--surface-soft)]" />
            ))}
          </div>
        ) : trendData && trendData.loggedDays > 0 ? (
          <div className="space-y-4" aria-label="Recent activity trend rows">
            <TrendDotRow label="Tasks" days={trendData.days} accessor={(day) => day.tasks} />
            <TrendDotRow label="Habits" days={trendData.days} accessor={(day) => day.habits} />
            <TrendDotRow label="Reflections" days={trendData.days} accessor={(day) => day.reflections} />
            <TrendDotRow label="Manual check-ins" days={trendData.days} accessor={(day) => day.mind + day.body + day.nutrition + day.finance} />
          </div>
        ) : (
          <QuietNotice />
        )}
      </Card>
    </section>
  );
}

function DomainSignals({
  trendData,
  activeProjectCount,
  activeGoalsCount,
  financeHasData,
  journalEntriesThisMonth,
  knowledgeItemsThisMonth,
}: {
  trendData: InsightTrendData | null;
  activeProjectCount: number;
  activeGoalsCount: number;
  financeHasData: boolean;
  journalEntriesThisMonth: number;
  knowledgeItemsThisMonth: number;
}) {
  const rows = [
    {
      label: "Actions",
      value: trendData ? `${trendData.completedTasks} tasks / ${trendData.habitLogs} habits` : "-",
      detail: trendData ? `Activity appeared on ${countDaysWithAction(trendData)} of the last 7 days.` : "Loading recent action pattern.",
    },
    {
      label: "Reflection and memory",
      value: trendData ? `${trendData.reflections} reflections` : "-",
      detail: `${journalEntriesThisMonth} journal entries and ${knowledgeItemsThisMonth} knowledge items this month.`,
    },
    {
      label: "Body and mind",
      value: trendData ? `${trendData.mindCheckins} mind / ${trendData.bodyNutritionCheckins} body` : "-",
      detail: trendData ? `${trendData.mindDays + trendData.bodyNutritionDays} logged day signals in the last 7 days.` : "Loading manual check-ins.",
    },
    {
      label: "System activity",
      value: `${activeGoalsCount} goals / ${activeProjectCount} projects`,
      detail: financeHasData
        ? "Finance entries appeared this month."
        : "No finance entries are visible in this month window.",
    },
  ];

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Domain signals
      </h2>
      <Card className="min-w-0 overflow-hidden border-[var(--border)]">
        <div className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <div key={row.label} className="grid min-w-0 gap-2 px-4 py-3.5 sm:grid-cols-[11rem_1fr] sm:items-center sm:px-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)]">{row.label}</p>
                <p className="mt-1 break-words text-base font-bold leading-tight text-[var(--accent)] sm:text-lg">{row.value}</p>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">{row.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function QuietAreas({ areas, trendLoading }: { areas: string[]; trendLoading: boolean }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Quiet areas / needs more data
      </h2>
      <Card variant="subtle" className="min-w-0 border-dashed border-[var(--border)] bg-black/[0.08] p-4 sm:p-5">
        {trendLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
        ) : areas.length > 0 ? (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">Some areas are quiet because there is not enough logged data yet.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {areas.map((area) => (
                <span key={area} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--text-muted)]">
                  {area}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
              Quiet areas are not judgments - they just have less data.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Recent logged activity is visible across the tracked areas on this page.</p>
        )}
      </Card>
    </section>
  );
}

function ReviewLinks() {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Manual review
      </h2>
      <div className="space-y-2">
        <Link
          href="/today"
          className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
        >
          <span className="min-w-0 break-words">Return to Today</span>
          <span className="text-[var(--text-muted)]">&rarr;</span>
        </Link>
        <Link
          href="/weekly-review"
          className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
        >
          <span className="min-w-0 break-words">Run Weekly Review</span>
          <span className="text-[var(--text-muted)]">&rarr;</span>
        </Link>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-muted)]">
        Insights shows broad patterns from logged activity. Weekly Review closes out the week in more detail. Both are based on what you enter manually.
      </p>
    </section>
  );
}

function InsightCountCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function TrendDotRow({ label, days, accessor }: { label: string; days: InsightTrendDay[]; accessor: (day: InsightTrendDay) => number }) {
  const activeDays = days.filter((day) => accessor(day) > 0).length;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{activeDays} / 7 days</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const value = accessor(day);
          return (
            <div key={`${label}-${day.date}`} className="min-w-0 text-center">
              <div
                className={`mx-auto flex h-10 w-full max-w-10 items-center justify-center rounded-2xl border text-xs font-semibold transition-colors ${
                  value > 0
                    ? "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-muted)]"
                }`}
                title={`${day.label}: ${value} logged`}
              >
                {value > 0 ? value : "-"}
              </div>
              <p className="mt-1 text-[9px] font-medium text-[var(--text-muted)]">{day.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuietNotice() {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-black/[0.08] px-4 py-5 text-center">
      <p className="text-sm font-medium text-[var(--text)]">Not enough logged activity yet.</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
        This becomes useful after a few Today loops: one visible action and one reflection at a time.
      </p>
    </div>
  );
}

function getRecentDates(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildInsightTrendData(
  dates: string[],
  rows: {
    tasks: { completed_at?: string | null }[];
    habits: { completed_date?: string | null }[];
    reflections: { entry_date?: string | null }[];
    mind: { entry_date?: string | null }[];
    body: { entry_date?: string | null }[];
    nutrition: { log_date?: string | null }[];
    finance: { transaction_date?: string | null }[];
  }
): InsightTrendData {
  const days = dates.map((date) => {
    const dayDate = new Date(`${date}T12:00:00`);
    const tasks = rows.tasks.filter((row) => row.completed_at?.slice(0, 10) === date).length;
    const habits = rows.habits.filter((row) => row.completed_date === date).length;
    const reflections = rows.reflections.filter((row) => row.entry_date === date).length;
    const mind = rows.mind.filter((row) => row.entry_date === date).length;
    const body = rows.body.filter((row) => row.entry_date === date).length;
    const nutrition = rows.nutrition.filter((row) => row.log_date === date).length;
    const finance = rows.finance.filter((row) => row.transaction_date === date).length;

    return {
      date,
      label: WEEKDAYS[dayDate.getDay()],
      tasks,
      habits,
      reflections,
      mind,
      body,
      nutrition,
      finance,
      total: tasks + habits + reflections + mind + body + nutrition + finance,
    };
  });

  return {
    days,
    taskDays: days.filter((day) => day.tasks > 0).length,
    completedTasks: rows.tasks.length,
    habitDays: days.filter((day) => day.habits > 0).length,
    habitLogs: rows.habits.length,
    reflectionDays: days.filter((day) => day.reflections > 0).length,
    reflections: rows.reflections.length,
    mindDays: days.filter((day) => day.mind > 0).length,
    mindCheckins: rows.mind.length,
    bodyNutritionDays: days.filter((day) => day.body > 0 || day.nutrition > 0).length,
    bodyNutritionCheckins: rows.body.length + rows.nutrition.length,
    financeDays: days.filter((day) => day.finance > 0).length,
    financeEntries: rows.finance.length,
    loggedDays: days.filter((day) => day.total > 0).length,
  };
}

function countDaysWithAction(trendData: InsightTrendData): number {
  return trendData.days.filter((day) => day.tasks > 0 || day.habits > 0).length;
}

function buildQuietAreas(
  trendData: InsightTrendData | null,
  context: {
    activeProjectCount: number;
    activeGoalsCount: number;
    financeHasData: boolean;
    journalEntriesThisMonth: number;
    knowledgeItemsThisMonth: number;
  }
): string[] {
  if (!trendData) return [];

  const areas: string[] = [];
  if (trendData.completedTasks === 0) areas.push("Tasks");
  if (trendData.habitLogs === 0) areas.push("Habits");
  if (trendData.reflections === 0) areas.push("Reflections");
  if (trendData.mindCheckins === 0) areas.push("Mind check-ins");
  if (trendData.bodyNutritionCheckins === 0) areas.push("Body or nutrition");
  if (trendData.financeEntries === 0 && !context.financeHasData) areas.push("Finance entries");
  if (context.activeProjectCount === 0) areas.push("Active projects");
  if (context.activeGoalsCount === 0) areas.push("Active goals");
  if (context.journalEntriesThisMonth === 0 && context.knowledgeItemsThisMonth === 0) areas.push("Memory activity");

  return areas.slice(0, 8);
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
