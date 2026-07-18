import type {
  FinanceTransaction,
  FinanceBudget,
  FinanceAccount,
  MonthlyTrend,
  ExpenseCategoryBreakdown,
  BudgetUsage,
  FinanceInsight,
  FinanceAnalytics,
  AccountBalance,
} from "./types";
import { formatMoney, getAppCurrency } from "@/lib/config";

type BalanceTransaction = Pick<FinanceTransaction, "account_id" | "amount" | "type">;

export function formatCurrency(amount: number, currency = getAppCurrency()): string {
  return formatMoney(amount, 2, currency);
}

export function getMonthRange(date: Date): { start: string; end: string; label: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
  return { start, end, label };
}

export function getPreviousMonthRange(date: Date): { start: string; end: string; label: string } {
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return getMonthRange(prev);
}

export function get6MonthRange(date: Date): { start: string; end: string } {
  const startMonth = new Date(date.getFullYear(), date.getMonth() - 5, 1);
  const start = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const end = getMonthRange(date).end;
  return { start, end };
}

export function getLast6Months(date: Date): Date[] {
  const months: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(date.getFullYear(), date.getMonth() - i, 1));
  }
  return months;
}

export function getMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

export function formatMonthYear(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function computeDeltas(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return parseFloat((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

export const CATEGORY_COLORS = [
  "#7aa2c7",
  "#7fb394",
  "#d2a85f",
  "#b588c4",
  "#6fc1b8",
  "#e06f6f",
  "#8ba4c7",
  "#d99a6c",
  "#b58b8b",
  "#7fa8b5",
];

export function getCategoryColor(categoryId: string): string {
  const hash = categoryId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

export function computeAnalytics({
  transactions,
  balanceTransactions = transactions,
  budgets,
  accounts,
  currentMonth,
}: {
  transactions: FinanceTransaction[];
  balanceTransactions?: BalanceTransaction[];
  budgets: FinanceBudget[];
  accounts: FinanceAccount[];
  currentMonth: Date;
}): FinanceAnalytics {
  const monthRange = getMonthRange(currentMonth);
  const prevRange = getPreviousMonthRange(currentMonth);

  const currentMonthTxs = transactions.filter(
    (tx) => tx.transaction_date >= monthRange.start && tx.transaction_date <= monthRange.end
  );

  const currentMonthIncome = currentMonthTxs
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const currentMonthExpenses = currentMonthTxs
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const currentMonthNet = currentMonthIncome - currentMonthExpenses;

  const prevMonthTxs = transactions.filter(
    (tx) => tx.transaction_date >= prevRange.start && tx.transaction_date <= prevRange.end
  );

  const previousMonthIncome = prevMonthTxs
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const previousMonthExpenses = prevMonthTxs
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const previousMonthNet = previousMonthIncome - previousMonthExpenses;

  const incomeDelta = computeDeltas(currentMonthIncome, previousMonthIncome);
  const expensesDelta = computeDeltas(currentMonthExpenses, previousMonthExpenses);
  const netDelta = computeDeltas(currentMonthNet, previousMonthNet);

  const totalExpenses = currentMonthExpenses;
  const expensesByCategoryMap = new Map<string, { categoryName: string; color: string; amount: number }>();
  for (const tx of currentMonthTxs.filter((tx) => tx.type === "expense")) {
    const catId = tx.category_id || "uncategorized";
    const existing = expensesByCategoryMap.get(catId);
    const catName = tx.finance_categories?.name || "Uncategorized";
    const color = tx.finance_categories?.color || getCategoryColor(catId);
    if (existing) {
      existing.amount += Number(tx.amount);
    } else {
      expensesByCategoryMap.set(catId, { categoryName: catName, color, amount: Number(tx.amount) });
    }
  }

  const expensesByCategory: ExpenseCategoryBreakdown[] = Array.from(expensesByCategoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.categoryName,
      color: data.color,
      amount: parseFloat(data.amount.toFixed(2)),
      percentage: totalExpenses > 0 ? parseFloat(((data.amount / totalExpenses) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const budgetSpend: Record<string, number> = {};
  for (const tx of currentMonthTxs.filter((tx) => tx.type === "expense" && tx.category_id)) {
    const catId = tx.category_id!;
    budgetSpend[catId] = (budgetSpend[catId] || 0) + Number(tx.amount);
  }

  const budgetUsage: BudgetUsage[] = budgets
    .map((b) => {
      const spent = budgetSpend[b.category_id] || 0;
      const pct = Number(b.amount) > 0 ? parseFloat(((spent / Number(b.amount)) * 100).toFixed(1)) : 0;
      let status: "on_track" | "near_limit" | "over_budget";
      if (pct >= 100) status = "over_budget";
      else if (pct >= 80) status = "near_limit";
      else status = "on_track";
      return {
        budgetId: b.id,
        categoryName: b.finance_categories?.name || "Uncategorized",
        categoryColor: b.finance_categories?.color || null,
        spent: parseFloat(spent.toFixed(2)),
        budgetAmount: Number(b.amount),
        percentage: pct,
        status,
      };
    })
    .sort((a, b) => {
      const order = { over_budget: 0, near_limit: 1, on_track: 2 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return b.percentage - a.percentage;
    });

  const highestExpenseTx = currentMonthTxs
    .filter((tx) => tx.type === "expense")
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null;

  const highestExpense = highestExpenseTx
    ? {
        title: highestExpenseTx.title,
        amount: Number(highestExpenseTx.amount),
        date: highestExpenseTx.transaction_date,
      }
    : null;

  const biggestCategory = expensesByCategory.length > 0 ? expensesByCategory[0] : null;

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const effectiveDays = isCurrentMonth ? Math.max(1, today.getDate()) : daysInMonth;
  const averageDailySpending =
    effectiveDays > 0 ? parseFloat((currentMonthExpenses / effectiveDays).toFixed(2)) : 0;

  const last6Months = getLast6Months(currentMonth);
  const monthlyTrendLast6Months: MonthlyTrend[] = last6Months.map((m) => {
    const range = getMonthRange(m);
    const monthTxs = transactions.filter(
      (tx) => tx.transaction_date >= range.start && tx.transaction_date <= range.end
    );
    const income = monthTxs
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expenses = monthTxs
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    return {
      month: formatMonthYear(m),
      label: getMonthLabel(m),
      income,
      expenses,
      net: income - expenses,
    };
  });

  const transactionCountThisMonth = currentMonthTxs.length;

  const accountBalances: AccountBalance[] = accounts.map((account) => {
    const accountTxs = balanceTransactions.filter((tx) => tx.account_id === account.id);
    const incomeTotal = accountTxs
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expenseTotal = accountTxs
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const currentBalance = Number(account.starting_balance) + incomeTotal - expenseTotal;
    return {
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      currency: account.currency,
      startingBalance: Number(account.starting_balance),
      incomeTotal,
      expenseTotal,
      currentBalance,
      transactionCount: accountTxs.length,
    };
  });

  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const hasMixedCurrencies = currencies.length > 1;

  const totalAccountBalance = hasMixedCurrencies
    ? 0
    : accountBalances.reduce((sum, a) => sum + a.currentBalance, 0);

  return {
    currentMonthIncome,
    currentMonthExpenses,
    currentMonthNet,
    previousMonthIncome,
    previousMonthExpenses,
    previousMonthNet,
    incomeDelta,
    expensesDelta,
    netDelta,
    expensesByCategory,
    budgetUsage,
    highestExpense,
    biggestCategory,
    averageDailySpending,
    monthlyTrendLast6Months,
    transactionCountThisMonth,
    totalAccountBalance,
    accountBalances,
    hasMixedCurrencies,
  };
}

export function computeInsights(analytics: FinanceAnalytics, monthLabel: string): FinanceInsight[] {
  const insights: FinanceInsight[] = [];

  if (analytics.transactionCountThisMonth === 0) {
    insights.push({
      type: "neutral",
      icon: "→",
      title: "No transactions yet",
      description: `Add your first manual transaction for ${monthLabel} to create review context.`,
    });
    return insights;
  }

  if (analytics.netDelta !== null) {
    if (analytics.currentMonthNet >= 0 && analytics.netDelta > 0) {
      insights.push({
        type: "positive",
        icon: "↑",
        title: "Net cashflow changed",
        description: `Up ${analytics.netDelta}% vs last month. Logged income is above logged expenses this month.`,
      });
    } else if (analytics.currentMonthNet < 0) {
      insights.push({
        type: "warning",
        icon: "!",
        title: "Expenses above income",
        description: `Logged expenses are ${formatCurrency(Math.abs(analytics.currentMonthNet))} above logged income this month.`,
      });
    }
  }

  if (analytics.biggestCategory && analytics.biggestCategory.percentage > 0) {
    insights.push({
      type: "neutral",
      icon: "•",
      title: `Top category: ${analytics.biggestCategory.categoryName}`,
      description: `${analytics.biggestCategory.percentage}% of expenses - ${formatCurrency(analytics.biggestCategory.amount)}`,
    });
  }

  if (analytics.expensesDelta !== null && analytics.expensesDelta > 10) {
    insights.push({
      type: "warning",
      icon: "↑",
      title: "Expenses changed",
      description: `Logged expenses are up ${analytics.expensesDelta}% compared to last month.`,
    });
  }

  if (analytics.expensesDelta !== null && analytics.expensesDelta < -10) {
    insights.push({
      type: "positive",
      icon: "↓",
      title: "Expenses changed",
      description: `Logged expenses decreased ${Math.abs(analytics.expensesDelta)}% from last month.`,
    });
  }

  const atRisk = analytics.budgetUsage.filter((b) => b.status === "near_limit");
  if (atRisk.length > 0) {
    insights.push({
      type: "warning",
      icon: "!",
      title: `${atRisk.length} budget${atRisk.length > 1 ? "s" : ""} near limit`,
      description: atRisk.map((b) => `${b.categoryName} at ${b.percentage}%`).join(", "),
    });
  }

  const overBudget = analytics.budgetUsage.filter((b) => b.status === "over_budget");
  if (overBudget.length > 0) {
    insights.push({
      type: "negative",
      icon: "!",
      title: `${overBudget.length} budget${overBudget.length > 1 ? "s" : ""} over logged amount`,
      description: overBudget.map((b) => `${b.categoryName} is ${formatCurrency(b.spent - b.budgetAmount)} over the logged monthly amount`).join(", "),
    });
  }

  if (analytics.highestExpense) {
    insights.push({
      type: "neutral",
      icon: "•",
      title: "Highest expense",
      description: `${analytics.highestExpense.title} - ${formatCurrency(analytics.highestExpense.amount)}`,
    });
  }

  return insights;
}
