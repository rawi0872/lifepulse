"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpPopover } from "@/components/HelpPopover";
import { InfoTip } from "@/components/InfoTip";
import { getTodayDateString } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  WEALTH_CURRENCIES,
  WEALTH_GOAL_TYPE_DISPLAY,
  WEALTH_GOAL_TARGET_METRIC,
  parseWealthAmount,
  getWealthGoalProgress,
  getWealthBudgetStatuses,
  getWealthBalanceFreshness,
  getWealthRecurringIntelligence,
  getWealthDataCoverage,
  deriveWealthInsights,
  type WealthGoalProgress,
  type WealthBudgetStatus,
} from "@lifepulse/domain";
import { ensureWebWealthRealm } from "@/lib/wealth-today";
import {
  validateWealthAccount,
  createWealthAccount,
  updateWealthAccount,
  archiveWealthAccount,
  deleteWealthAccount,
  createWealthTransaction,
  createWealthTransfer,
  deleteWealthTransaction,
  createWealthRecurring,
  setWealthRecurringActive,
  advanceWealthRecurring,
  deleteWealthRecurring,
  createWealthGoal,
  deleteWealthGoal,
  setWealthBaseCurrency,
  WEALTH_GOAL_OPTIONS,
} from "@/lib/wealth";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
} from "@/components/finance/types";
import {
  formatCurrency,
  get6MonthRange,
  getMonthRange,
  computeAnalytics,
} from "@/components/finance/financeUtils";
import { FinanceKpiCard } from "@/components/finance/FinanceKpiCard";
import { CashflowTrendChart } from "@/components/finance/CashflowTrendChart";
import { ExpenseBreakdownChart } from "@/components/finance/ExpenseBreakdownChart";
import { FinanceInsights } from "@/components/finance/FinanceInsights";
import { TransactionList } from "@/components/finance/TransactionList";
import { AccountSummary } from "@/components/finance/AccountSummary";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { BudgetForm } from "@/components/finance/BudgetForm";
import { AccountForm } from "@/components/finance/AccountForm";
import { BudgetHealthList } from "@/components/finance/BudgetHealthList";

interface WealthRecurringItem {
  id: string;
  name: string;
  kind: string;
  amount: number;
  currency: string;
  frequency: string;
  next_due_date: string;
  is_active: boolean;
}

interface WealthGoal {
  id: string;
  title: string;
  status: string | null;
  goal_type: string | null;
  target_metric: string | null;
  target_value: number | null;
  target_unit: string | null;
  baseline_value: number | null;
  target_date: string | null;
}

const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Transport", "Health", "Education", "Entertainment", "Subscriptions", "Shopping", "Savings", "Other expense"];
const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Other income"];


export default function WealthPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const cancelledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [balanceTransactions, setBalanceTransactions] = useState<Pick<FinanceTransaction, "account_id" | "amount" | "type">[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [recurring, setRecurring] = useState<WealthRecurringItem[]>([]);
  const [goals, setGoals] = useState<WealthGoal[]>([]);
  const [baseCurrency, setBaseCurrencyState] = useState<string>("ILS");

  const monthRange = getMonthRange(currentMonth);

  const analytics = useMemo(
    () => computeAnalytics({ transactions, balanceTransactions, budgets, accounts, currentMonth, baseCurrency }),
    [transactions, balanceTransactions, budgets, accounts, currentMonth, baseCurrency]
  );

  const wealthGoalProgress: WealthGoalProgress[] = useMemo(
    () => getWealthGoalProgress(goals as never[], accounts as never[]),
    [goals, accounts],
  );

  const wealthRecurringIntel = useMemo(
    () => getWealthRecurringIntelligence(recurring as never[], getTodayDateString()),
    [recurring],
  );

  const wealthInsights = useMemo(() => {
    const todayStr = getTodayDateString();
    const freshness = getWealthBalanceFreshness(accounts as never[], todayStr, 30);
    const monthStart = `${todayStr.slice(0, 7)}-01`;
    const byCategory = new Map<string, { name: string; amount: number; count: number }>();
    for (const tx of transactions) {
      if (tx.type !== "expense" || !tx.transaction_date.startsWith(monthStart.slice(0, 7))) continue;
      if ((tx.finance_accounts?.currency ?? null) !== baseCurrency) continue;
      const key = tx.category_id ?? "uncategorized";
      const entry = byCategory.get(key) ?? { name: tx.finance_categories?.name ?? "Uncategorized", amount: 0, count: 0 };
      entry.amount += Number(tx.amount);
      entry.count += 1;
      byCategory.set(key, entry);
    }
    const summaries = [...byCategory.entries()].map(([categoryId, entry]) => ({
      categoryId,
      categoryName: entry.name,
      amount: entry.amount,
      share: 0,
      count: entry.count,
      currency: baseCurrency,
    }));
    const budgetStatuses: WealthBudgetStatus[] = getWealthBudgetStatuses(
      budgets.map((b) => ({ id: b.id, category_id: b.category_id, month: b.month, amount: Number(b.amount), currency: b.currency ?? null })),
      categories.map((c) => ({ id: c.id, name: c.name })),
      summaries,
      baseCurrency,
    );
    const coverage = getWealthDataCoverage({
      accounts: accounts as never[],
      transactions: transactions.map((t) => ({
        ...t,
        currency: t.finance_accounts?.currency ?? null,
      })) as never[],
      budgets: budgets as never[],
      goals: goals as never[],
      recurring: recurring as never[],
      freshness,
    });
    return deriveWealthInsights({
      trends: [],
      categoryChanges: [],
      budgets: budgetStatuses,
      goals: wealthGoalProgress,
      recurring: wealthRecurringIntel,
      freshness,
      coverage,
    });
  }, [transactions, budgets, goals, recurring, accounts, baseCurrency, categories, wealthGoalProgress, wealthRecurringIntel]);

  const boundedInsights: { type: "positive" | "negative" | "neutral" | "warning"; icon: string; title: string; description: string }[] =
    wealthInsights.slice(0, 5).map((insight) => ({
      type: insight.kind.includes("over") || insight.kind.includes("negative") || insight.kind.includes("behind")
        ? "warning"
        : insight.kind.includes("achieved") || insight.kind.includes("met")
          ? "positive"
          : "neutral",
      icon: insight.kind.includes("over") ? "!" : insight.kind.includes("achieved") ? "✓" : "•",
      title: insight.title,
      description: insight.dataSufficiency === "insufficient"
        ? `${insight.rationale} (Not enough evidence yet.)`
        : insight.rationale,
    }));

  const currentMonthTransactions = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.transaction_date >= monthRange.start && tx.transaction_date <= monthRange.end
      ),
    [transactions, monthRange.start, monthRange.end]
  );

  const [seeding, setSeeding] = useState(false);

  async function loadData() {
    if (cancelledRef.current) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const sixMonthRange = get6MonthRange(currentMonth);
      const realmId = await ensureWebWealthRealm(supabase, user.id);

      const [accountsRes, categoriesRes, txRes, balanceTxRes, budgetsRes, recurringRes, goalsRes, prefsRes] = await Promise.all([
        supabase.from("finance_accounts").select("id, name, type, starting_balance, currency, is_archived, institution_name").eq("user_id", user.id).eq("is_archived", false).order("created_at"),
        supabase.from("finance_categories").select("id, name, type, color, icon").eq("user_id", user.id).order("created_at"),
        supabase.from("finance_transactions")
          .select("id, account_id, category_id, amount, type, title, note, transaction_date, linked_transaction_id, finance_accounts(name, type, currency), finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .gte("transaction_date", sixMonthRange.start)
          .lte("transaction_date", sixMonthRange.end)
          .order("transaction_date", { ascending: false }),
        supabase.from("finance_transactions")
          .select("account_id, amount, type, finance_accounts(currency)")
          .eq("user_id", user.id),
        supabase.from("finance_budgets").select("id, category_id, month, amount, currency, finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .eq("month", `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`),
        supabase.from("finance_recurring_items").select("id, name, kind, amount, currency, frequency, next_due_date, is_active").eq("user_id", user.id).order("next_due_date"),
        realmId
          ? supabase.from("goals").select("id, title, status, goal_type, target_metric, target_value, target_unit, baseline_value, target_date").eq("user_id", user.id).eq("realm_id", realmId)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("finance_preferences").select("base_currency").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!cancelledRef.current) {
        if (accountsRes.error) throw accountsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        if (txRes.error) throw txRes.error;
        if (balanceTxRes.error) throw balanceTxRes.error;
        if (budgetsRes.error) throw budgetsRes.error;

        setAccounts(accountsRes.data ?? []);
        setCategories(categoriesRes.data ?? []);
        setTransactions((txRes.data ?? []) as unknown as FinanceTransaction[]);
        setBalanceTransactions((balanceTxRes.data ?? []) as Pick<FinanceTransaction, "account_id" | "amount" | "type">[]);
        setBudgets((budgetsRes.data ?? []) as unknown as FinanceBudget[]);
        if (!recurringRes.error) setRecurring((recurringRes.data ?? []) as WealthRecurringItem[]);
        if (!goalsRes.error) setGoals(((goalsRes as { data?: unknown }).data ?? []) as WealthGoal[]);
        const prefs = prefsRes.data as { base_currency?: string | null } | null;
        if (prefs?.base_currency && WEALTH_CURRENCIES.includes(prefs.base_currency)) {
          setBaseCurrencyState(prefs.base_currency);
        }

        if ((categoriesRes.data ?? []).length === 0) {
          await seedDefaultCategories(user.id);
        }
      }
    } catch {
      if (!cancelledRef.current) {
        toast({ type: "error", title: "Failed to load wealth data." });
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }

  async function seedDefaultCategories(userId: string) {
    if (seeding) return;
    setSeeding(true);
    try {
      const defaults: { name: string; type: "income" | "expense"; user_id: string }[] = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name, type: "expense" as const, user_id: userId })),
        ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ name, type: "income" as const, user_id: userId })),
      ];
      const { error } = await supabase.from("finance_categories").insert(defaults);
      if (error) throw error;
      const { data } = await supabase.from("finance_categories").select("id, name, type, color, icon").eq("user_id", userId);
      if (data) setCategories(data);
    } catch {
    } finally {
      setSeeding(false);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const [showTxForm, setShowTxForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingTxLocked, setEditingTxLocked] = useState(false);
  const [txTitle, setTxTitle] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense" | "transfer" | "adjustment">("expense");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txToAccountId, setTxToAccountId] = useState("");
  const [txDate, setTxDate] = useState(getTodayDateString());
  const [txNote, setTxNote] = useState("");

  function resetTxForm() {
    setTxTitle("");
    setTxAmount("");
    setTxType("expense");
    setTxCategoryId("");
    setTxAccountId("");
    setTxToAccountId("");
    setTxDate(getTodayDateString());
    setTxNote("");
    setEditingTxId(null);
    setEditingTxLocked(false);
    setShowTxForm(false);
  }

  function startTransaction(type: "income" | "expense" | "transfer" | "adjustment") {
    resetTxForm();
    setTxType(type);
    setShowTxForm(true);
  }

  function editTransaction(tx: FinanceTransaction) {
    // Paired transfer rows: only title/note/date may change (mobile parity).
    const locked = tx.type === "transfer";
    setTxTitle(tx.title);
    setTxAmount(String(tx.amount));
    setTxType(tx.type);
    setTxCategoryId(tx.category_id ?? "");
    setTxAccountId(tx.account_id ?? "");
    setTxToAccountId("");
    setTxDate(tx.transaction_date);
    setTxNote(tx.note ?? "");
    setEditingTxId(tx.id);
    setEditingTxLocked(locked);
    setShowTxForm(true);
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    const title = txTitle.trim();
    const amount = parseWealthAmount(txAmount);

    if (!title) {
      toast({ type: "error", title: "Title is required." });
      return;
    }
    if (amount === null) {
      toast({ type: "error", title: "Amount must be a positive number." });
      return;
    }
    if ((txType === "income" || txType === "expense") && !txCategoryId) {
      toast({ type: "error", title: "Category is required." });
      return;
    }
    if (!txAccountId) {
      toast({ type: "error", title: "Account is required." });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate)) {
      toast({ type: "error", title: "Use a valid date." });
      return;
    }

    setSaving(true);
    try {
      if (editingTxId) {
        if (editingTxLocked) {
          const { error } = await supabase
            .from("finance_transactions")
            .update({ title, transaction_date: txDate, note: txNote || null })
            .eq("id", editingTxId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("finance_transactions")
            .update({
              title,
              amount,
              category_id: txCategoryId || null,
              account_id: txAccountId,
              transaction_date: txDate,
              note: txNote || null,
            })
            .eq("id", editingTxId);
          if (error) throw error;
        }
        toast({ type: "success", title: "Transaction updated." });
      } else if (txType === "transfer") {
        if (!txToAccountId) {
          toast({ type: "error", title: "Choose a destination account." });
          return;
        }
        await createWealthTransfer(supabase, {
          fromAccountId: txAccountId,
          toAccountId: txToAccountId,
          amount,
          transactionDate: txDate,
          title: title === "" ? undefined : title,
          note: txNote || null,
        });
        toast({ type: "success", title: "Transfer recorded." });
      } else {
        await createWealthTransaction(supabase, {
          accountId: txAccountId,
          categoryId: txType === "adjustment" ? txCategoryId || null : txCategoryId,
          amount,
          type: txType,
          title,
          note: txNote || null,
          transactionDate: txDate,
        });
        toast({ type: "success", title: "Transaction added." });
      }

      resetTxForm();
      loadData();
    } catch (err) {
      toast({ type: "error", title: err instanceof Error ? err.message : "Failed to save transaction." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id: string) {
    setSaving(true);
    try {
      await deleteWealthTransaction(supabase, id);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete transaction." });
    } finally {
      setSaving(false);
    }
  }

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("");
  const [confirmingBudgetDeleteId, setConfirmingBudgetDeleteId] = useState<string | null>(null);

  async function handleAddBudget() {
    const amount = parseWealthAmount(budgetAmount);
    if (!budgetCategoryId || amount === null) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const { error } = await supabase.from("finance_budgets").insert({
        user_id: user.id,
        category_id: budgetCategoryId,
        month,
        amount,
        // Legacy NULL means unknown currency (canonical unknown semantics).
        currency: budgetCurrency.trim() ? budgetCurrency.trim().toUpperCase() : null,
      });
      if (error) throw error;
      setBudgetCategoryId("");
      setBudgetAmount("");
      setBudgetCurrency("");
      setShowBudgetForm(false);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to add budget." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(id: string) {
    try {
      await supabase.from("finance_budgets").delete().eq("id", id);
      setConfirmingBudgetDeleteId(null);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete budget." });
    }
  }

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [acctName, setAcctName] = useState("");
  const [acctType, setAcctType] = useState("checking");
  const [acctBalance, setAcctBalance] = useState("0");
  const [acctCurrency, setAcctCurrency] = useState("ILS");
  const [acctInstitution, setAcctInstitution] = useState("");
  const [editingAcctId, setEditingAcctId] = useState<string | null>(null);
  const [confirmingAccountDeleteId, setConfirmingAccountDeleteId] = useState<string | null>(null);

  function resetAccountForm() {
    setAcctName("");
    setAcctType("checking");
    setAcctBalance("0");
    setAcctCurrency("ILS");
    setAcctInstitution("");
    setEditingAcctId(null);
    setShowAccountForm(false);
  }

  function startEditAccount(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    setAcctName(account.name);
    setAcctType(account.type);
    setAcctBalance(String(account.starting_balance));
    setAcctCurrency(account.currency);
    setAcctInstitution((account as { institution_name?: string | null }).institution_name ?? "");
    setEditingAcctId(id);
    setShowAccountForm(true);
  }

  async function handleSaveAccount() {
    const input = {
      name: acctName,
      type: acctType,
      startingBalance: acctBalance,
      currency: acctCurrency,
      institutionName: acctInstitution || null,
    };
    const error = validateWealthAccount(input);
    if (error) {
      toast({ type: "error", title: error });
      return;
    }

    setSaving(true);
    try {
      if (editingAcctId) {
        await updateWealthAccount(supabase, editingAcctId, input);
        toast({ type: "success", title: "Account updated." });
      } else {
        await createWealthAccount(supabase, input);
        toast({ type: "success", title: "Account added." });
      }
      resetAccountForm();
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to save account." });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveAccount(id: string, archived: boolean) {
    try {
      await archiveWealthAccount(supabase, id, archived);
      loadData();
      toast({ type: "success", title: archived ? "Account archived." : "Account restored." });
    } catch {
      toast({ type: "error", title: "Failed to update account." });
    }
  }

  async function deleteAccount(id: string) {
    try {
      await deleteWealthAccount(supabase, id);
      setConfirmingAccountDeleteId(null);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete account." });
    }
  }

  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recName, setRecName] = useState("");
  const [recKind, setRecKind] = useState("bill");
  const [recAmount, setRecAmount] = useState("");
  const [recCurrency, setRecCurrency] = useState("ILS");
  const [recFrequency, setRecFrequency] = useState("monthly");
  const [recDueDate, setRecDueDate] = useState(getTodayDateString());

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalType, setGoalType] = useState<string>("savings_target");
  const [goalValue, setGoalValue] = useState("");
  const [goalCurrency, setGoalCurrency] = useState("ILS");
  const [goalDate, setGoalDate] = useState("");

  async function handleAddRecurring() {
    const amount = parseWealthAmount(recAmount);
    if (!recName.trim() || amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(recDueDate)) {
      toast({ type: "error", title: "Name, positive amount, and a valid date are required." });
      return;
    }
    setSaving(true);
    try {
      await createWealthRecurring(supabase, {
        name: recName,
        kind: recKind,
        amount,
        currency: recCurrency,
        frequency: recFrequency,
        nextDueDate: recDueDate,
      });
      setRecName("");
      setRecAmount("");
      setShowRecurringForm(false);
      loadData();
      toast({ type: "success", title: "Recurring item added." });
    } catch (err) {
      toast({ type: "error", title: err instanceof Error ? err.message : "Failed to add recurring item." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleRecurring(id: string, active: boolean) {
    try {
      await setWealthRecurringActive(supabase, id, active);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to update recurring item." });
    }
  }

  async function handleAdvanceRecurring(id: string) {
    try {
      await advanceWealthRecurring(supabase, id);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to advance recurring item." });
    }
  }

  async function handleDeleteRecurring(id: string) {
    try {
      await deleteWealthRecurring(supabase, id);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete recurring item." });
    }
  }

  async function handleAddGoal() {
    const value = goalValue.trim() === "" ? null : parseWealthAmount(goalValue);
    if (goalValue.trim() !== "" && value === null) {
      toast({ type: "error", title: "Target must be a positive number." });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const realmId = await ensureWebWealthRealm(supabase, user.id);
      if (!realmId) {
        toast({ type: "error", title: "Workspace initializing. Try again in a moment." });
        return;
      }
      await createWealthGoal(supabase, realmId, {
        title: goalTitle,
        goalType,
        targetMetric: (WEALTH_GOAL_TARGET_METRIC as Record<string, string>)[goalType] ?? "savings_balance",
        targetValue: value,
        targetUnit: goalCurrency,
        targetDate: goalDate || null,
      });
      setGoalTitle("");
      setGoalValue("");
      setGoalDate("");
      setShowGoalForm(false);
      loadData();
      toast({ type: "success", title: "Goal added." });
    } catch (err) {
      toast({ type: "error", title: err instanceof Error ? err.message : "Failed to add goal." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoal(id: string) {
    try {
      await deleteWealthGoal(supabase, id);
      loadData();
    } catch {
      toast({ type: "error", title: "Failed to delete goal." });
    }
  }

  async function handleBaseCurrencyChange(currency: string) {
    try {
      await setWealthBaseCurrency(supabase, currency);
      setBaseCurrencyState(currency);
      toast({ type: "success", title: `Base currency set to ${currency}.` });
    } catch {
      toast({ type: "error", title: "Failed to set base currency." });
    }
  }

  const expenseOptions = categories.filter((c) => c.type === "expense").map((c) => ({ value: c.id, label: c.name }));
  const incomeOptions = categories.filter((c) => c.type === "income").map((c) => ({ value: c.id, label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }));
  const budgetCatOptions = categories.filter((c) => c.type === "expense").map((c) => ({ value: c.id, label: c.name }));

  const hasData = transactions.length > 0 || budgets.length > 0 || accounts.length > 0;

  function getKpiDelta(value: number, delta: number | null): { value: string; isPositive: boolean } | null {
    if (delta === null) return null;
    return {
      value: `${delta}%`,
      isPositive: delta >= 0,
    };
  }

  const budgetTotal = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetPct = budgetTotal > 0 ? Math.round((analytics.currentMonthExpenses / budgetTotal) * 100) : 0;
  const incomeCountThisMonth = currentMonthTransactions.filter((tx) => tx.type === "income").length;
  const expenseCountThisMonth = currentMonthTransactions.filter((tx) => tx.type === "expense").length;
  const latestTransaction = currentMonthTransactions[0] ?? null;

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
          <div className="mb-8">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <FinanceKpiCard key={i} label="" value="" delta={null} variant="income" isLoading />
            ))}
          </div>
        </div>
      </DashboardNav>
    );
  }

  return (
    <DashboardNav>
      <div className="mx-auto max-w-5xl overflow-x-hidden px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-6 min-w-0">
          <div className="flex min-w-0 items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Manual money check-in</p>
              <h1 className="break-words text-2xl font-bold tracking-tight text-[var(--text)]">Wealth</h1>
              <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                {hasData
                  ? `Review manually logged income and expenses for ${monthRange.label.toLowerCase()}.`
                  : "Log income and expenses manually so you can notice where money went."}
                <HelpPopover title="What is Wealth?" className="ml-1.5">
                  <p>Wealth is a private manual tracker. Add income and expenses to understand your money flow. No bank connection. Not financial, investment, tax, or debt advice.</p>
                </HelpPopover>
              </p>
              <p className="mt-1 break-words text-xs text-[var(--text-muted)]">
                Weekly Review can use logged entries as context. One entry is enough to start.
              </p>
            </div>
          </div>
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
              <span className="block text-xs font-semibold text-[var(--text)]">Income</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Money that came in, such as pay, client payment, or gift.</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
              <span className="block text-xs font-semibold text-[var(--text)]">Expense</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Money that went out, such as food, transport, or subscription.</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
              <span className="block text-xs font-semibold text-[var(--text)]">Boundaries</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Private tracking only. No bank connection or advice.</span>
            </div>
          </div>
          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Base</span>
              {WEALTH_CURRENCIES.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => void handleBaseCurrencyChange(currency)}
                  aria-pressed={baseCurrency === currency}
                  className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:min-h-0 ${
                    baseCurrency === currency
                      ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                      : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {currency}
                </button>
              ))}
            </div>
            <h2 className="break-words text-sm font-medium text-[var(--text-secondary)]">{monthRange.label}</h2>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="min-h-10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
                aria-label="Previous month"
              >
                &larr; Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date())}
                className="min-h-10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="min-h-10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0"
                aria-label="Next month"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>

        {!hasData && (
          <>
            <InfoTip id="finance" title="Start with one income or expense" className="mb-4">
              <ol className="list-inside list-decimal space-y-1 break-words">
                <li>Choose Expense for money that went out, like Food or Transport.</li>
                <li>Choose Income for money that came in, like Paycheck or Client payment.</li>
                <li>Amount, date, category, and note are manual entries only.</li>
                <li>Your weekly review becomes clearer as you log.</li>
              </ol>
            </InfoTip>
            <Card className="mb-6 p-5 text-center sm:p-6">
              <p className="mb-2 break-words text-sm font-medium text-[var(--text)]">One entry is enough to start.</p>
              <p className="mx-auto mb-4 max-w-lg break-words text-sm leading-relaxed text-[var(--text-muted)]">
                Start with one income or expense. Manual entries only; this is for awareness, not advice.
              </p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <Button onClick={() => startTransaction("expense")} size="sm">
                  Log an expense
                </Button>
                <Button onClick={() => startTransaction("income")} size="sm" variant="secondary">
                  Log income
                </Button>
              </div>
            </Card>
          </>
        )}

        {hasData && (
          <>
            <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <FinanceKpiCard
                label="Income"
                value={formatCurrency(analytics.currentMonthIncome, baseCurrency)}
                delta={getKpiDelta(analytics.currentMonthIncome, analytics.incomeDelta)}
                variant="income"
                helpContent={<p>Total {baseCurrency} money received during the selected month. Other currencies and unknown-currency rows are never converted — they are counted separately below.</p>}
              />
              <FinanceKpiCard
                label="Expenses"
                value={formatCurrency(analytics.currentMonthExpenses, baseCurrency)}
                delta={getKpiDelta(analytics.currentMonthExpenses, analytics.expensesDelta)}
                variant="expense"
                helpContent={<p>Total {baseCurrency} money spent during the selected month. The percentage compares this month to the previous month.</p>}
              />
              <FinanceKpiCard
                label="Net Cashflow"
                value={formatCurrency(analytics.currentMonthNet, baseCurrency)}
                delta={getKpiDelta(analytics.currentMonthNet, analytics.netDelta)}
                variant="net"
                helpContent={<p>Income minus expenses in {baseCurrency}. Positive means more money came in than went out.</p>}
              />
              <FinanceKpiCard
                label="Budget Used"
                value={budgets.length > 0 ? `${budgetPct}%` : "—"}
                delta={null}
                variant="budget"
                helpContent={<p>How much of your monthly budget has already been used across budgeted categories.</p>}
              />
            </div>

            <Card className="mb-6 min-w-0 p-4 sm:p-5">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Manual context</p>
                  <h3 className="mt-1 break-words text-sm font-semibold text-[var(--text)]">This month&apos;s money context</h3>
                  <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                    Based on what you logged for {monthRange.label.toLowerCase()}, Weekly Review has {analytics.transactionCountThisMonth} transaction{analytics.transactionCountThisMonth !== 1 ? "s" : ""}: {incomeCountThisMonth} income and {expenseCountThisMonth} expense entr{expenseCountThisMonth === 1 ? "y" : "ies"}.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                  Not financial advice
                </span>
              </div>
              {(analytics.unknownCurrencyCount > 0 || analytics.excludedForeignCount > 0) && (
                <p className="mt-3 break-words text-[11px] leading-relaxed text-[var(--text-muted)]">
                  Shown in {baseCurrency} only.
                  {analytics.unknownCurrencyCount > 0 && ` ${analytics.unknownCurrencyCount} row${analytics.unknownCurrencyCount === 1 ? "" : "s"} with unknown currency excluded.`}
                  {analytics.excludedForeignCount > 0 && ` ${analytics.excludedForeignCount} non-${baseCurrency} row${analytics.excludedForeignCount === 1 ? "" : "s"} excluded (no silent conversion).`}
                </p>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                  <span className="block text-xs font-semibold text-[var(--text)]">Latest entry</span>
                  <span className="mt-1 block break-words text-[10px] leading-relaxed text-[var(--text-muted)]">
                    {latestTransaction ? `${latestTransaction.title} - ${formatCurrency(Number(latestTransaction.amount), baseCurrency)}` : "No entry for this month."}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                  <span className="block text-xs font-semibold text-[var(--text)]">Top category</span>
                  <span className="mt-1 block break-words text-[10px] leading-relaxed text-[var(--text-muted)]">
                    {analytics.biggestCategory ? `${analytics.biggestCategory.categoryName} - ${formatCurrency(analytics.biggestCategory.amount, baseCurrency)}` : "No expense category logged."}
                  </span>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                  <span className="block text-xs font-semibold text-[var(--text)]">Private review</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">Manual entries only. No bank connection, AI summaries, or external processing.</span>
                </div>
              </div>
            </Card>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="min-w-0 p-4 sm:p-5">
                <h3 className="mb-4 break-words text-sm font-medium text-[var(--text-secondary)]">
                  Cashflow Trend
                  <HelpPopover title="Cashflow Trend" className="ml-1">
                    <p>This shows manually logged income and expenses over the last 6 months so you can review how your money flow changed.</p>
                    <p className="mt-1.5 text-[var(--text-muted)]">Income line (blue) shows money in. Expenses line (red) shows money out. Net = income minus expenses.</p>
                  </HelpPopover>
                </h3>
                <CashflowTrendChart data={analytics.monthlyTrendLast6Months} />
              </Card>
              <Card className="min-w-0 p-4 sm:p-5">
                <h3 className="mb-4 break-words text-sm font-medium text-[var(--text-secondary)]">
                  Expense Breakdown
                  <HelpPopover title="Expense Breakdown" className="ml-1">
                    <p>This shows where logged expenses went during the selected month, grouped by category.</p>
                    <p className="mt-1.5 text-[var(--text-muted)]">Percentages are based on monthly expenses only. Income transactions are not included. Larger slices mean more money spent in that category.</p>
                  </HelpPopover>
                </h3>
                <ExpenseBreakdownChart data={analytics.expensesByCategory} />
              </Card>
            </div>

            {boundedInsights.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 break-words text-sm font-medium text-[var(--text-secondary)]">
                  Review Context
                  <HelpPopover title="Review Context" className="ml-1">
                  <p>Bounded Wealth notes (at most five) from recorded budgets, goals, recurring items, and balances. Manual entries only, no advice.</p>
                  </HelpPopover>
                </h3>
                <FinanceInsights insights={boundedInsights} />
              </div>
            )}
          </>
        )}

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              {editingTxId ? "Edit entry" : "Log entry"}
              <HelpPopover title="Entries" className="ml-1">
                <p>Use Expense for money that went out and Income for money that came in. Use Transfer to move money between accounts and Adjustment to correct a record. The entry is manual and only saves when you press Add transaction.</p>
              </HelpPopover>
            </h3>
            {!showTxForm ? (
              <Button size="sm" variant="secondary" onClick={() => startTransaction("expense")}>
                + Income/expense
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={resetTxForm}>
                Cancel
              </Button>
            )}
          </div>
          <TransactionForm
            show={showTxForm}
            saving={saving}
            editingTxId={editingTxId}
            editingLocked={editingTxLocked}
            txTitle={txTitle}
            txAmount={txAmount}
            txType={txType}
            txCategoryId={txCategoryId}
            txAccountId={txAccountId}
            txToAccountId={txToAccountId}
            txDate={txDate}
            txNote={txNote}
            expenseOptions={expenseOptions}
            incomeOptions={incomeOptions}
            accountOptions={accountOptions}
            onTitleChange={setTxTitle}
            onAmountChange={setTxAmount}
            onTypeChange={(v) => { setTxType(v); setTxCategoryId(""); }}
            onCategoryChange={setTxCategoryId}
            onAccountChange={setTxAccountId}
            onToAccountChange={setTxToAccountId}
            onDateChange={setTxDate}
            onNoteChange={setTxNote}
            onSave={handleSaveTransaction}
            onCancel={resetTxForm}
          />
        </div>

        <div className="mb-8">
          <h3 className="mb-3 break-words text-sm font-medium text-[var(--text-secondary)]">
            Recent Transactions
            <HelpPopover title="Recent Transactions" className="ml-1">
              <p>Transactions are the money moves you add manually. Income adds to logged monthly income, and expenses add to logged monthly expenses. Transfers and adjustments never touch cash flow.</p>
              <p className="mt-1.5 text-[var(--text-muted)]">&quot;All&quot; shows everything. The other filters show only that transaction type.</p>
            </HelpPopover>
          </h3>
          <TransactionList
            transactions={currentMonthTransactions}
            onEdit={editTransaction}
            onDelete={deleteTransaction}
            onAddNew={() => { resetTxForm(); setShowTxForm(true); }}
          />
        </div>

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              Budget Health
              <HelpPopover title="Budget Health" className="ml-1">
                <p>Budgets help you record a monthly amount for a category. Life Pulse compares logged expenses in that category against the budget.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Within budget = logged expenses are below the budget. Near limit = logged expenses are close to the budget. Over budget = logged expenses passed the budget.</p>
                <p className="mt-1.5">Budgets only use expense categories.</p>
              </HelpPopover>
            </h3>
            {!showBudgetForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowBudgetForm(true)}>
                + Budget
              </Button>
            )}
          </div>
          <BudgetForm
            show={showBudgetForm}
            saving={saving}
            budgetCategoryId={budgetCategoryId}
            budgetAmount={budgetAmount}
            budgetCurrency={budgetCurrency}
            budgetCatOptions={budgetCatOptions}
            onCategoryChange={setBudgetCategoryId}
            onAmountChange={setBudgetAmount}
            onCurrencyChange={setBudgetCurrency}
            onSave={handleAddBudget}
            onCancel={() => setShowBudgetForm(false)}
          />
          <BudgetHealthList
            budgetUsage={analytics.budgetUsage}
            formatCurrency={formatCurrency}
            onDelete={deleteBudget}
            onRequestDelete={setConfirmingBudgetDeleteId}
            onCancelDelete={() => setConfirmingBudgetDeleteId(null)}
            confirmingDeleteId={confirmingBudgetDeleteId}
          />
        </div>

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              Accounts
              <HelpPopover title="Accounts" className="ml-1">
                <p>Accounts are where your money lives, like checking, savings, or cash.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">The balance you set is the balance shown. Transactions never change it silently. Not connected to your bank.</p>
              </HelpPopover>
            </h3>
            {!showAccountForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowAccountForm(true)}>
                + Account
              </Button>
            )}
          </div>
          <AccountForm
            show={showAccountForm}
            saving={saving}
            editing={editingAcctId !== null}
            acctName={acctName}
            acctType={acctType}
            acctBalance={acctBalance}
            acctCurrency={acctCurrency}
            acctInstitution={acctInstitution}
            onNameChange={setAcctName}
            onTypeChange={setAcctType}
            onBalanceChange={setAcctBalance}
            onCurrencyChange={(v) => setAcctCurrency(v.toUpperCase())}
            onInstitutionChange={setAcctInstitution}
            onSave={handleSaveAccount}
            onCancel={resetAccountForm}
          />
          <AccountSummary
            accountBalances={analytics.accountBalances}
            hasMixedCurrencies={analytics.hasMixedCurrencies}
            onDelete={deleteAccount}
            onRequestDelete={setConfirmingAccountDeleteId}
            onCancelDelete={() => setConfirmingAccountDeleteId(null)}
            confirmingDeleteId={confirmingAccountDeleteId}
            onAddNew={() => { resetAccountForm(); setShowAccountForm(true); }}
            onEdit={startEditAccount}
            onToggleArchive={(id) => void handleArchiveAccount(id, true)}
          />
        </div>

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              Recurring
              <HelpPopover title="Recurring" className="ml-1">
                <p>Bills, subscriptions, and repeating income with a next due date. NEXTRON uses due items for Today suggestions when you allow it.</p>
              </HelpPopover>
            </h3>
            {!showRecurringForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowRecurringForm(true)}>
                + Recurring
              </Button>
            )}
          </div>
          {showRecurringForm && (
            <Card className="mb-3 p-3.5 sm:p-4">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Name</label>
                  <input value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="Rent, Spotify, Paycheck" maxLength={100} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Kind</label>
                    <select value={recKind} onChange={(e) => setRecKind(e.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2">
                      <option value="bill">Bill</option>
                      <option value="subscription">Subscription</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Frequency</label>
                    <select value={recFrequency} onChange={(e) => setRecFrequency(e.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Amount</label>
                  <input type="number" step="0.01" min="0.01" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="0.00" className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Currency</label>
                    <select value={recCurrency} onChange={(e) => setRecCurrency(e.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2">
                      {WEALTH_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Next due</label>
                    <input type="date" value={recDueDate} onChange={(e) => setRecDueDate(e.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2" />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button size="sm" variant="secondary" onClick={() => setShowRecurringForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddRecurring} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              </div>
            </Card>
          )}
          {recurring.length === 0 ? (
            <Card variant="subtle" className="p-5 text-center sm:p-6">
              <p className="break-words text-sm text-[var(--text-muted)]">No recurring items. Bills due soon can surface in Today.</p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {recurring.map((item) => (
                <Card key={item.id} className="flex min-w-0 flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:px-4">
                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 break-words text-sm font-medium text-[var(--text)]">{item.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {item.kind} · {item.frequency} · {formatCurrency(Number(item.amount), item.currency)} · due {item.next_due_date}
                      {!item.is_active && " · paused"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <button type="button" onClick={() => void handleToggleRecurring(item.id, !item.is_active)} className="min-h-10 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0">
                      {item.is_active ? "Pause" : "Resume"}
                    </button>
                    <button type="button" onClick={() => void handleAdvanceRecurring(item.id)} className="min-h-10 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] sm:min-h-0">
                      Advance
                    </button>
                    <button type="button" onClick={() => void handleDeleteRecurring(item.id)} className="min-h-10 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] sm:min-h-0">
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <h3 className="min-w-0 break-words text-sm font-medium text-[var(--text-secondary)]">
              Goals
              <HelpPopover title="Goals" className="ml-1">
                <p>Truthful progress only: savings counts savings accounts, debt counts liabilities, investment stays insufficient without evidence.</p>
              </HelpPopover>
            </h3>
            {!showGoalForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowGoalForm(true)}>
                + Goal
              </Button>
            )}
          </div>
          {showGoalForm && (
            <Card className="mb-3 p-3.5 sm:p-4">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Title</label>
                  <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="Emergency fund" maxLength={120} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Type</label>
                  <select value={goalType} onChange={(e) => setGoalType(e.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2">
                    {WEALTH_GOAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Target (optional)</label>
                    <input type="number" step="0.01" min="0.01" value={goalValue} onChange={(e) => setGoalValue(e.target.value)} placeholder="20000" className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Currency</label>
                    <select value={goalCurrency} onChange={(e) => setGoalCurrency(e.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2">
                      {WEALTH_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Target date (optional)</label>
                  <input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none sm:min-h-0 sm:py-2" />
                </div>
              </div>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button size="sm" variant="secondary" onClick={() => setShowGoalForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddGoal} disabled={saving || !goalTitle.trim()}>{saving ? "Saving..." : "Save"}</Button>
              </div>
            </Card>
          )}
          {wealthGoalProgress.length === 0 ? (
            <Card variant="subtle" className="p-5 text-center sm:p-6">
              <p className="break-words text-sm text-[var(--text-muted)]">No Wealth goals yet. Progress is computed truthfully from your accounts.</p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {wealthGoalProgress.map((goal) => (
                <Card key={goal.goalId} className="min-w-0 px-3.5 py-3 sm:px-4">
                  <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="min-w-0 break-words text-sm font-medium text-[var(--text)]">{goal.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {(WEALTH_GOAL_TYPE_DISPLAY as Record<string, string>)[goal.type] ?? goal.type} · {goal.status}
                        {goal.progressPct != null && ` · ${Math.round(goal.progressPct * 100)}%`}
                      </p>
                    </div>
                    <button type="button" onClick={() => void handleDeleteGoal(goal.goalId)} className="min-h-10 shrink-0 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] sm:min-h-0">
                      Delete
                    </button>
                  </div>
                  {goal.progressPct != null && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, Math.round(goal.progressPct * 100))}%` }} />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        <p className="break-words text-center text-xs text-[var(--text-muted)]">
          Private manual tracker. No bank connection. Not financial advice. Not investment, tax, or debt advice.
        </p>
      </div>
    </DashboardNav>
  );
}
