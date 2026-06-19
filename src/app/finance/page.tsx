"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTodayDateString } from "@/lib/utils";

interface FinanceAccount {
  id: string;
  name: string;
  type: string;
  starting_balance: number;
  currency: string;
}

interface FinanceCategory {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  icon: string | null;
}

interface FinanceTransaction {
  id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  type: "income" | "expense";
  title: string;
  note: string | null;
  transaction_date: string;
  finance_accounts: FinanceAccount | null;
  finance_categories: FinanceCategory | null;
}

interface FinanceBudget {
  id: string;
  category_id: string;
  month: string;
  amount: number;
  finance_categories: FinanceCategory | null;
}

function formatCurrency(amount: number, currency = "ILS"): string {
  if (typeof amount !== "number" || isNaN(amount)) return "0.00";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function getMonthRange(date: Date): { start: string; end: string; label: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
  return { start, end, label };
}

function SimpleSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
        >
          <span className="flex-1 text-left">
            {selected ? selected.label : <span className="text-[var(--text-muted)]">{placeholder}</span>}
          </span>
          <svg className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-xl" role="listbox">
            {options.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-[var(--text-muted)]">No options</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    value === opt.value
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_EXPENSE_CATEGORIES = ["Food", "Transport", "Subscriptions", "Clothes", "School", "Health", "Entertainment", "Other"];
const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Other"];
const ACCOUNT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];
const TRANSACTION_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export default function FinancePage() {
  const supabase = createClient();
  const router = useRouter();
  const cancelledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);

  const monthRange = getMonthRange(currentMonth);

  const incomeTotal = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const netCashflow = incomeTotal - expenseTotal;

  const budgetSpend: Record<string, number> = {};
  for (const t of transactions.filter((t) => t.type === "expense" && t.category_id)) {
    const catId = t.category_id!;
    budgetSpend[catId] = (budgetSpend[catId] || 0) + Number(t.amount);
  }

  const [seeding, setSeeding] = useState(false);

  async function loadData() {
    if (cancelledRef.current) return;
    setLoading(true);
    setFeedback(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const [accountsRes, categoriesRes, txRes, budgetsRes] = await Promise.all([
        supabase.from("finance_accounts").select("*").eq("user_id", user.id).order("created_at"),
        supabase.from("finance_categories").select("*").eq("user_id", user.id).order("created_at"),
        supabase.from("finance_transactions").select("*, finance_accounts(name, type, currency), finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .gte("transaction_date", monthRange.start)
          .lte("transaction_date", monthRange.end)
          .order("transaction_date", { ascending: false }),
        supabase.from("finance_budgets").select("*, finance_categories(name, type, color)")
          .eq("user_id", user.id)
          .eq("month", `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`),
      ]);

      if (!cancelledRef.current) {
        if (accountsRes.error) throw accountsRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        if (txRes.error) throw txRes.error;
        if (budgetsRes.error) throw budgetsRes.error;

        setAccounts(accountsRes.data ?? []);
        setCategories(categoriesRes.data ?? []);
        setTransactions(txRes.data ?? []);
        setBudgets(budgetsRes.data ?? []);

        if ((categoriesRes.data ?? []).length === 0) {
          seedDefaultCategories(user.id);
        }
      }
    } catch {
      if (!cancelledRef.current) {
        setFeedback({ type: "error", message: "Failed to load finance data." });
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
      const { data } = await supabase.from("finance_categories").select("*").eq("user_id", userId);
      if (data) setCategories(data);
    } catch {
      // categories can be created later in Settings
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
  const [txTitle, setTxTitle] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txDate, setTxDate] = useState(getTodayDateString());
  const [txNote, setTxNote] = useState("");

  function resetTxForm() {
    setTxTitle("");
    setTxAmount("");
    setTxType("expense");
    setTxCategoryId("");
    setTxAccountId("");
    setTxDate(getTodayDateString());
    setTxNote("");
    setEditingTxId(null);
    setShowTxForm(false);
  }

  function editTransaction(tx: FinanceTransaction) {
    setTxTitle(tx.title);
    setTxAmount(String(tx.amount));
    setTxType(tx.type as "income" | "expense");
    setTxCategoryId(tx.category_id ?? "");
    setTxAccountId(tx.account_id ?? "");
    setTxDate(tx.transaction_date);
    setTxNote(tx.note ?? "");
    setEditingTxId(tx.id);
    setShowTxForm(true);
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    const title = txTitle.trim();
    const amount = parseFloat(txAmount);

    if (!title) {
      setFeedback({ type: "error", message: "Title is required." });
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      setFeedback({ type: "error", message: "Amount must be greater than 0." });
      return;
    }
    if (!txCategoryId) {
      setFeedback({ type: "error", message: "Category is required." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const txData = {
        user_id: user.id,
        title,
        amount,
        type: txType,
        category_id: txCategoryId || null,
        account_id: txAccountId || null,
        transaction_date: txDate,
        note: txNote || null,
      };

      if (editingTxId) {
        const { error } = await supabase.from("finance_transactions").update(txData).eq("id", editingTxId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_transactions").insert(txData);
        if (error) throw error;
      }

      resetTxForm();
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to save transaction." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id: string) {
    setSaving(true);
    try {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to delete transaction." });
    } finally {
      setSaving(false);
    }
  }

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  async function handleAddBudget() {
    const amount = parseFloat(budgetAmount);
    if (!budgetCategoryId || !amount || isNaN(amount) || amount <= 0) return;

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
      });
      if (error) throw error;
      setBudgetCategoryId("");
      setBudgetAmount("");
      setShowBudgetForm(false);
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to add budget." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(id: string) {
    try {
      await supabase.from("finance_budgets").delete().eq("id", id);
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to delete budget." });
    }
  }

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [acctName, setAcctName] = useState("");
  const [acctType, setAcctType] = useState("cash");
  const [acctBalance, setAcctBalance] = useState("0");
  const [acctCurrency, setAcctCurrency] = useState("ILS");

  async function handleAddAccount() {
    const name = acctName.trim();
    const balance = parseFloat(acctBalance);
    if (!name) return;
    if (isNaN(balance)) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("finance_accounts").insert({
        user_id: user.id,
        name,
        type: acctType,
        starting_balance: balance,
        currency: acctCurrency,
      });
      if (error) throw error;
      setAcctName("");
      setAcctType("cash");
      setAcctBalance("0");
      setAcctCurrency("ILS");
      setShowAccountForm(false);
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to add account." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    try {
      await supabase.from("finance_accounts").delete().eq("id", id);
      loadData();
    } catch {
      setFeedback({ type: "error", message: "Failed to delete account." });
    }
  }

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const expenseOptions = categories.filter((c) => c.type === "expense").map((c) => ({ value: c.id, label: c.name }));
  const incomeOptions = categories.filter((c) => c.type === "income").map((c) => ({ value: c.id, label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }));
  const budgetCatOptions = categories.filter((c) => c.type === "expense").map((c) => ({ value: c.id, label: c.name }));

  const hasData = transactions.length > 0 || budgets.length > 0 || accounts.length > 0;

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-4xl px-5 py-8">
          <div className="mb-8">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-h-[100px] rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
                <div className="mb-2 h-3 w-16 animate-pulse rounded bg-[var(--surface)]" />
                <div className="h-7 w-24 animate-pulse rounded bg-[var(--surface)]" />
              </div>
            ))}
          </div>
        </div>
      </DashboardNav>
    );
  }

  return (
    <DashboardNav>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Finance</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Track the money moves that matter.
              </p>
            </div>
          </div>
        </div>

        {feedback && (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-400"
              : "border-green-500/20 bg-green-500/10 text-green-400"
          }`}>
            {feedback.message}
          </div>
        )}

        {!hasData && !showTxForm && !showBudgetForm && !showAccountForm && (
          <Card className="mb-6 p-6 text-center">
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Know where your money is going. Start tracking your first transaction.
            </p>
            <Button onClick={() => setShowTxForm(true)} size="sm">
              Add your first transaction
            </Button>
          </Card>
        )}

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-muted)]">{monthRange.label}</h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                aria-label="Previous month"
              >
                &larr;
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date())}
                className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                aria-label="Next month"
              >
                &rarr;
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card variant="subtle" className="p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Income</p>
              <p className="mt-1 text-lg font-semibold text-green-400">{formatCurrency(incomeTotal)}</p>
            </Card>
            <Card variant="subtle" className="p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Expenses</p>
              <p className="mt-1 text-lg font-semibold text-red-400">{formatCurrency(expenseTotal)}</p>
            </Card>
            <Card variant="subtle" className="p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Net Cashflow</p>
              <p className={`mt-1 text-lg font-semibold ${netCashflow >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(netCashflow)}
              </p>
            </Card>
            <Card variant="subtle" className="p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Budget Used</p>
              {budgets.length > 0 ? (
                <p className={`mt-1 text-lg font-semibold ${expenseTotal > 0 ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                  {expenseTotal > 0
                    ? `${Math.round((expenseTotal / budgets.reduce((s, b) => s + Number(b.amount), 0)) * 100)}%`
                    : "0%"}
                </p>
              ) : (
                <p className="mt-1 text-xs text-[var(--text-muted)]">No budgets set</p>
              )}
            </Card>
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-muted)]">
              {editingTxId ? "Edit Transaction" : "Add Transaction"}
            </h2>
            {!showTxForm ? (
              <Button size="sm" variant="secondary" onClick={() => { resetTxForm(); setShowTxForm(true); }}>
                + New
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={resetTxForm}>
                Cancel
              </Button>
            )}
          </div>
          {showTxForm && (
            <Card className="p-4">
              <form onSubmit={handleSaveTransaction} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Title</label>
                    <input
                      value={txTitle}
                      onChange={(e) => setTxTitle(e.target.value)}
                      placeholder="Groceries, Salary, ..."
                      required
                      maxLength={200}
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {TRANSACTION_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setTxType(t.value as "income" | "expense"); setTxCategoryId(""); }}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        txType === t.value
                          ? t.value === "income"
                            ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                            : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                          : "bg-[var(--surface-soft)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SimpleSelect
                    label="Category"
                    options={txType === "income" ? incomeOptions : expenseOptions}
                    value={txCategoryId}
                    onChange={setTxCategoryId}
                    placeholder="Select category"
                  />
                  <SimpleSelect
                    label="Account (optional)"
                    options={accountOptions}
                    value={txAccountId}
                    onChange={setTxAccountId}
                    placeholder="No account"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Date</label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Note (optional)</label>
                    <input
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                      placeholder="Optional note"
                      maxLength={500}
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? "Saving..." : editingTxId ? "Update" : "Add Transaction"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>

        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-[var(--text-muted)]">Recent Transactions</h2>
          {transactions.length === 0 ? (
            <Card variant="subtle" className="p-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                No transactions this month.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isExpense = tx.type === "expense";
                const catName = tx.finance_categories?.name ?? "Uncategorized";
                const acctName = tx.finance_accounts?.name;
                return (
                  <Card key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{tx.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {tx.transaction_date} &middot; {catName}
                        {acctName && <> &middot; {acctName}</>}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold whitespace-nowrap ${
                      isExpense ? "text-red-400" : "text-green-400"
                    }`}>
                      {isExpense ? "-" : "+"}{formatCurrency(Number(tx.amount))}
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => editTransaction(tx)}
                        className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                        aria-label="Edit transaction"
                      >
                        Edit
                      </button>
                      {confirmDelete === tx.id ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => deleteTransaction(tx.id)}
                            className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(tx.id)}
                          className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label="Delete transaction"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-muted)]">Budgets</h2>
            {!showBudgetForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowBudgetForm(true)}>
                + Budget
              </Button>
            )}
          </div>
          {showBudgetForm && (
            <Card className="mb-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[150px]">
                  <SimpleSelect
                    label="Category"
                    options={budgetCatOptions}
                    value={budgetCategoryId}
                    onChange={setBudgetCategoryId}
                    placeholder="Select category"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Monthly amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 pb-px">
                  <Button size="sm" onClick={handleAddBudget} disabled={saving || !budgetCategoryId || !budgetAmount}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowBudgetForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
          {budgets.length === 0 ? (
            <Card variant="subtle" className="p-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Set monthly budgets to track your spending limits.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {budgets.map((b) => {
                const catName = b.finance_categories?.name ?? "Uncategorized";
                const spent = budgetSpend[b.category_id ?? ""] ?? 0;
                const pct = Number(b.amount) > 0 ? Math.min(100, (spent / Number(b.amount)) * 100) : 0;
                return (
                  <Card key={b.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--text)]">{catName}</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatCurrency(spent)} / {formatCurrency(Number(b.amount))}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--surface)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteBudget(b.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="Delete budget"
                    >
                      Delete
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-muted)]">Accounts</h2>
            {!showAccountForm && (
              <Button size="sm" variant="secondary" onClick={() => setShowAccountForm(true)}>
                + Account
              </Button>
            )}
          </div>
          {showAccountForm && (
            <Card className="mb-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[150px]">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Name</label>
                  <input
                    value={acctName}
                    onChange={(e) => setAcctName(e.target.value)}
                    placeholder="Wallet, Checking, ..."
                    maxLength={100}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="w-36">
                  <SimpleSelect
                    label="Type"
                    options={ACCOUNT_TYPES}
                    value={acctType}
                    onChange={setAcctType}
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Starting balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={acctBalance}
                    onChange={(e) => setAcctBalance(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="w-20">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Currency</label>
                  <input
                    value={acctCurrency}
                    onChange={(e) => setAcctCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="ILS"
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 pb-px">
                  <Button size="sm" onClick={handleAddAccount} disabled={saving || !acctName.trim()}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAccountForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
          {accounts.length === 0 ? (
            <Card variant="subtle" className="p-6 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Track your accounts to see where your money lives.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <Card key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--text)]">{a.name}</p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">{a.type}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {formatCurrency(Number(a.starting_balance), a.currency)}
                  </p>
                  <span className="text-xs text-[var(--text-muted)]">{a.currency}</span>
                  <button
                    type="button"
                    onClick={() => deleteAccount(a.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Delete account"
                  >
                    Delete
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[var(--text-muted)]">
          Manual tracker. Not financial advice. No bank connection.
        </p>
      </div>
    </DashboardNav>
  );
}
