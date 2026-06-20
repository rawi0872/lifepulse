export interface FinanceAccount {
  id: string;
  name: string;
  type: string;
  starting_balance: number;
  currency: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  icon: string | null;
}

export interface FinanceTransaction {
  id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  type: "income" | "expense";
  title: string;
  note: string | null;
  transaction_date: string;
  finance_accounts: Pick<FinanceAccount, "name" | "type" | "currency"> | null;
  finance_categories: Pick<FinanceCategory, "name" | "type" | "color"> | null;
}

export interface FinanceBudget {
  id: string;
  category_id: string;
  month: string;
  amount: number;
  finance_categories: Pick<FinanceCategory, "name" | "type" | "color"> | null;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ExpenseCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color: string;
  amount: number;
  percentage: number;
}

export interface BudgetUsage {
  budgetId: string;
  categoryName: string;
  categoryColor: string | null;
  spent: number;
  budgetAmount: number;
  percentage: number;
  status: "on_track" | "near_limit" | "over_budget";
}

export interface FinanceInsight {
  type: "positive" | "negative" | "neutral" | "warning";
  icon: string;
  title: string;
  description: string;
}

export interface AccountBalance {
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  startingBalance: number;
  incomeTotal: number;
  expenseTotal: number;
  currentBalance: number;
  transactionCount: number;
}

export interface FinanceAnalytics {
  currentMonthIncome: number;
  currentMonthExpenses: number;
  currentMonthNet: number;
  previousMonthIncome: number;
  previousMonthExpenses: number;
  previousMonthNet: number;
  incomeDelta: number | null;
  expensesDelta: number | null;
  netDelta: number | null;
  expensesByCategory: ExpenseCategoryBreakdown[];
  budgetUsage: BudgetUsage[];
  highestExpense: { title: string; amount: number; date: string } | null;
  biggestCategory: ExpenseCategoryBreakdown | null;
  averageDailySpending: number;
  monthlyTrendLast6Months: MonthlyTrend[];
  transactionCountThisMonth: number;
  totalAccountBalance: number;
  accountBalances: AccountBalance[];
  hasMixedCurrencies: boolean;
}
