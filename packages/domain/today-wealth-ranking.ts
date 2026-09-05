import type { MorningPlanFirstAction } from "./today/morning-plan";
import type { WealthSignalV2 } from "./wealth-intelligence";

// Maps ordinary Up Next to deterministic priority preserving urgency
export function ordinaryPriority(upNext: MorningPlanFirstAction | null): number | null {
  if (!upNext) return null;
  if (upNext.type === "task") {
    const p = (upNext.task as any).priority as string;
    const rank = p === "high" ? 0 : p === "medium" ? 1 : 2;
    // Reason indicates urgency
    if (upNext.reason === "Overdue") return 10 + rank; // 10,11,12
    if (upNext.reason === "Top priority") return 12 + rank; // 12,13,14 (explicit priority)
    if (upNext.reason === "Due today") return 14 + rank; // 14,15,16
    return 18 + rank; // Active task 18,19,20
  }
  // habit
  return 19; // habit due today
}

// Wealth recurring urgency based on due proximity (deterministic)
export function wealthUrgencyPriority(signal: WealthSignalV2, todayStr: string): number {
  if (!signal.dueDate) return signal.priority;
  const today = new Date(todayStr);
  const due = new Date(signal.dueDate);
  const diff = Math.ceil((due.getTime() - today.getTime())/86400000);
  if (signal.kind === "wealth_bill_due") {
    if (diff < 0) return diff >= -2 ? 9 : diff >= -7 ? 11 : 14;
    if (diff === 0) return 9;
    if (diff === 1) return 11;
    if (diff <= 3) return 13;
    if (diff <= 7) return 16;
    return 18;
  }
  if (signal.kind === "wealth_subscription_due") {
    if (diff < 0) return 12;
    if (diff <= 1) return 14;
    return 17;
  }
  return signal.priority;
}

export interface TodayRankingInput {
  ordinaryUpNext: MorningPlanFirstAction | null;
  wealthCandidate: WealthSignalV2 | null;
  todayStr?: string;
}

// Deduplication: if same sourceId, collapse
function isDuplicate(ordinary: MorningPlanFirstAction | null, wealth: WealthSignalV2 | null): boolean {
  if (!ordinary || !wealth || !wealth.sourceId) return false;
  return ordinary.id === wealth.sourceId;
}

export function selectTodayPrimaryCandidate(input: TodayRankingInput): { source: "ordinary" | "wealth" | null; ordinary: MorningPlanFirstAction | null; wealth: WealthSignalV2 | null; chosen: MorningPlanFirstAction | WealthSignalV2 | null } {
  const { ordinaryUpNext, wealthCandidate, todayStr } = input;
  const today = todayStr ?? new Date().toISOString().slice(0,10);
  // Dedupe: same underlying task/habit must not compete twice
  let wealth = wealthCandidate;
  if (isDuplicate(ordinaryUpNext, wealthCandidate)) wealth = null;

  const ordP = ordinaryPriority(ordinaryUpNext);
  const wealthP = wealth ? wealthUrgencyPriority(wealth, today) : null;

  if (!ordinaryUpNext && !wealth) return { source: null, ordinary: null, wealth: null, chosen: null };
  if (!ordinaryUpNext) return { source: "wealth", ordinary: null, wealth, chosen: wealth };
  if (!wealth) return { source: "ordinary", ordinary: ordinaryUpNext, wealth: null, chosen: ordinaryUpNext };

  // Both exist: lower priority wins (deterministic tie-breaker: wealth dueDate then kind)
  if ((wealthP ?? 999) < (ordP ?? 999)) return { source: "wealth", ordinary: ordinaryUpNext, wealth, chosen: wealth };
  if ((ordP ?? 999) < (wealthP ?? 999)) return { source: "ordinary", ordinary: ordinaryUpNext, wealth, chosen: ordinaryUpNext };
  // tie: prefer ordinary (existing behavior) for stability
  return { source: "ordinary", ordinary: ordinaryUpNext, wealth, chosen: ordinaryUpNext };
}
