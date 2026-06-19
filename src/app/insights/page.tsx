"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { getTodayDateString, getWeekStartDate } from "@/lib/utils";
import { getLevelInfo, getOverallTitle, getRealmTitle } from "@/lib/levels";
import { HelpPopover } from "@/components/HelpPopover";
import { getCurrentStreak, getBestStreak } from "@/lib/streaks";

interface RealmXp {
  name: string;
  color: string;
  icon: string;
  xp: number;
}

function InsightSkeleton() {
  return (
    <DashboardNav>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-8">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--surface)]" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-h-[120px] rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
              <div className="mb-2 h-3 w-16 animate-pulse rounded bg-[var(--surface)]" />
              <div className="mb-4 h-8 w-14 animate-pulse rounded bg-[var(--surface)]" />
              <div className="mt-auto h-3 w-28 animate-pulse rounded bg-[var(--surface-soft)]" />
            </div>
          ))}
        </div>
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <div className="mb-3 h-4 w-48 animate-pulse rounded bg-[var(--surface)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--surface)]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface)]" />
              </div>
              <div className="mb-2 h-3 w-40 animate-pulse rounded bg-[var(--surface-soft)]" />
              <div className="h-1.5 w-full animate-pulse rounded bg-[var(--surface)]" />
              <div className="mt-1 h-3 w-36 animate-pulse rounded bg-[var(--surface-soft)]" />
            </div>
          ))}
        </div>
      </div>
    </DashboardNav>
  );
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
            xp: realmMap[r.id] || 0,
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
        <Card variant="subtle" className="mb-6 border-[var(--border)]">
          <div className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent-ghost)] ring-1 ring-[var(--accent)]/20">
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--accent)]">{levelInfo.level}</p>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text)] truncate">{overallTitle}</p>
                <p className="text-[10px] text-[var(--text-muted)] shrink-0">{levelInfo.xpNeededForNext} XP to next</p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] shadow-sm shadow-[var(--accent)]/10 transition-all"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">{totalXp} total XP</p>
            </div>
          </div>
        </Card>

        {/* Life area levels — hero section */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              Life area levels
              <HelpPopover title="How XP and levels work">
                <p>Completing habits and tasks earns XP. XP goes into your overall level and into the life area connected to that action.</p>
                <p className="mt-1.5">Weekly consistency shows how often you completed expected habit check-ins. Life area levels show where your progress is growing.</p>
              </HelpPopover>
            </h2>
            <button
              onClick={() => router.push("/settings")}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Manage
            </button>
          </div>

          {realmXp.length === 0 || realmXp.every((r) => r.xp === 0) ? (
            <Card variant="subtle" className="border-dashed border-[var(--border)]">
              <div className="p-6 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  Complete habits or tasks to start leveling up your life areas.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-2">
              {realmXp.map((r) => {
                const info = getLevelInfo(r.xp);
                const title = getRealmTitle(r.name, info.level);
                const xpInLevel = r.xp - info.currentLevelXp;
                const xpRange = info.nextLevelXp - info.currentLevelXp;
                return (
                  <Card key={r.name} className="overflow-hidden border-[var(--border-strong)] transition-all duration-150 hover:border-[var(--border-strong)]">
                    <div className="flex items-center gap-4 p-5">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm bg-gradient-to-br"
                        style={{
                          backgroundImage: `linear-gradient(to bottom right, ${r.color}33, transparent)`,
                          color: r.color,
                          boxShadow: `inset 0 0 0 1px ${r.color}30`,
                        }}
                      >
                        {r.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--text)] truncate">{r.name}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">{title}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xl font-bold text-[var(--text)]">{info.level}</p>
                              <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Level</p>
                            </div>
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold"
                              style={{
                                backgroundColor: r.color + "15",
                                color: r.color,
                              }}
                            >
                              {r.xp}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${info.progressPercent}%`, backgroundColor: r.color, boxShadow: `0 1px 3px 0 ${r.color}1A` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                          {r.xp} XP &middot; {xpInLevel}/{xpRange} to next level
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Momentum */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Momentum
        </h2>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card variant="default" className="flex flex-col p-4 min-h-[100px]">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">XP today</p>
            <p className={`mt-2 text-2xl font-bold ${todayXp > 0 ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}`}>+{todayXp}</p>
            <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">{today}</p>
          </Card>
          <Card variant="default" className="flex flex-col p-4 min-h-[100px]">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Active projects</p>
            <p className="mt-2 text-2xl font-bold text-[var(--success)]">{activeProjectCount}</p>
            <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">{activeProjectCount === 1 ? "Project in progress" : "Projects in progress"}</p>
          </Card>
          <Card variant="subtle" className="flex flex-col p-4 min-h-[100px]">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Task completion</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">
              {taskCount > 0 ? `${taskCompletionRate}%` : "\u2014"}
            </p>
            <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">
              {taskCount > 0 ? `${doneTaskCount} of ${taskCount} done` : "No tasks yet"}
            </p>
          </Card>
          <Card variant="subtle" className="flex flex-col p-4 min-h-[100px]">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Journal</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{journalCount}</p>
            <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)]">{journalCount === 1 ? "Entry written" : "Entries written"}</p>
          </Card>
        </div>

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

        {/* Weekly consistency */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Weekly consistency
        </h2>

        {habitCount > 0 ? (
          <Card className="mb-6 border-[var(--border-strong)]">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text)]">Habit consistency</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {weekHabitLogs} of {weekDueHabits} expected check-ins this week
                  </p>
                </div>
                <span className="text-3xl font-bold tabular-nums text-[var(--accent)]">
                  {weekHabitRate ?? 0}%
                </span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-all shadow-sm shadow-[var(--accent)]/10"
                  style={{ width: `${weekHabitRate ?? 0}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Daily habits counted 7&times;/week. Weekly habits count based on their target.
              </p>
            </div>
          </Card>
        ) : (
          <Card variant="subtle" className="mb-6 border-dashed border-[var(--border)]">
            <div className="p-4 text-center">
              <p className="text-sm text-[var(--text-muted)]">No habits yet.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Create habits to track your weekly consistency.
              </p>
            </div>
          </Card>
        )}

        {/* Habit streaks */}
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Habit streaks
        </h2>

        {habitCount > 0 ? (
          <Card className="mb-6 border-[var(--border-strong)]">
            <div className="grid grid-cols-3 gap-4 p-5">
              <div className="text-center">
                <p className="text-3xl font-bold text-[var(--accent)]">{longestStreak}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Longest current</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-[var(--text)]">{activeStreaks}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Active {activeStreaks === 1 ? "streak" : "streaks"}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-[var(--text)]">{bestEverStreak}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Best ever</p>
              </div>
            </div>
            <div className="border-t border-[var(--border)] px-5 py-3">
              <p className="text-xs text-[var(--text-muted)]">
                Streaks count expected habit days. Rest days do not break streaks.
              </p>
            </div>
          </Card>
        ) : (
          <Card variant="subtle" className="mb-6 border-dashed border-[var(--border)]">
            <div className="p-4 text-center">
              <p className="text-sm text-[var(--text-muted)]">No habits yet.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Build a streak by completing habits consistently.
              </p>
            </div>
          </Card>
        )}
      </div>
    </DashboardNav>
  );
}
