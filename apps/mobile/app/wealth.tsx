import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, RefreshControl } from "react-native";
import { Stack, Link } from "expo-router";
import { colors, spacing, radii, type } from "../lib/theme";
import { WealthIcon } from "../src/icons/WealthIcon";
import { Plus } from "../src/icons/Plus";
import { Close } from "../src/icons/Close";
import { loadWealthOverview, loadWealthIntelligence, createWealthAccount, updateWealthAccount, archiveWealthAccount, createWealthTransaction, createPairedTransfer, updateWealthTransaction, deleteWealthTransaction, createWealthCategory, createWealthRecurring, updateWealthRecurring, setRecurringActive, advanceWealthRecurring, createWealthGoal, deleteWealthGoal, setBaseCurrency, createWealthBudget, deleteWealthBudget, setWealthBudgetCurrency } from "../lib/wealth-service";
import { formatWealth, formatWealthGrouped, parseWealthAmount, WEALTH_CURRENCIES, WEALTH_ACCOUNT_TYPE_OPTIONS, WEALTH_ACCOUNT_TYPE_DISPLAY, WEALTH_GOAL_TYPE_DISPLAY, WEALTH_GOAL_TARGET_METRIC, wealthPeriodBounds } from "@lifepulse/domain";
import { Svg, Rect } from "react-native-svg";

type Period = "month" | "3months";
const GOAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "savings_target", label: "Save money" },
  { value: "net_worth_target", label: "Reach net worth" },
  { value: "debt_payoff", label: "Pay off debt" },
  { value: "emergency_fund", label: "Build emergency fund" },
  { value: "investment_contribution", label: "Investment contribution" },
  { value: "general", label: "General financial goal" },
];

export default function WealthScreen() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadWealthOverview>> | null>(null);
  const [intel, setIntel] = useState<Awaited<ReturnType<typeof loadWealthIntelligence>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [histMonths, setHistMonths] = useState<3|6|12>(3);
  const [err, setErr] = useState<string | null>(null);

  // modals
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accName, setAccName] = useState(""); const [accType, setAccType] = useState<string>("checking"); const [accBal, setAccBal] = useState(""); const [accCurr, setAccCurr] = useState("ILS"); const [accInst, setAccInst] = useState(""); const [editAccId, setEditAccId] = useState<string | null>(null);
  const [showTx, setShowTx] = useState(false);
  const [txType, setTxType] = useState<string>("expense"); const [txTitle, setTxTitle] = useState(""); const [txAmt, setTxAmt] = useState(""); const [txDate, setTxDate] = useState(new Date().toISOString().slice(0,10)); const [txAcc, setTxAcc] = useState<string | null>(null); const [txCat, setTxCat] = useState<string | null>(null); const [txNote, setTxNote] = useState(""); const [editTxId, setEditTxId] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false); const [trFrom, setTrFrom] = useState<string>(""); const [trTo, setTrTo] = useState<string>(""); const [trAmt, setTrAmt] = useState(""); const [trDate, setTrDate] = useState(new Date().toISOString().slice(0,10));
  const [showRec, setShowRec] = useState(false); const [recName, setRecName] = useState(""); const [recKind, setRecKind] = useState("bill"); const [recAmt, setRecAmt] = useState(""); const [recCurr, setRecCurr] = useState("ILS"); const [recFreq, setRecFreq] = useState("monthly"); const [recDue, setRecDue] = useState(new Date(Date.now()+86400000*7).toISOString().slice(0,10)); const [editRecId, setEditRecId] = useState<string | null>(null);
  const [showGoal, setShowGoal] = useState(false); const [goalTitle, setGoalTitle] = useState(""); const [goalType, setGoalType] = useState("savings_target"); const [goalValue, setGoalValue] = useState(""); const [goalDate, setGoalDate] = useState(""); const [goalCurr, setGoalCurr] = useState("ILS");
  const [showBudget, setShowBudget] = useState(false); const [budgetCat, setBudgetCat] = useState<string | null>(null); const [budgetAmt, setBudgetAmt] = useState(""); const [budgetMonth, setBudgetMonth] = useState(new Date().toISOString().slice(0,7)+"-01"); const [budgetCurr, setBudgetCurr] = useState("ILS");

  const load = useCallback(async () => {
    try { setErr(null); const [d, i] = await Promise.all([loadWealthOverview(), loadWealthIntelligence().catch(()=>null)]); setData(d); setIntel(i as any); } catch (e:any){ setErr(e.message ?? "Failed to load"); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(()=>{ void load(); },[load]);
  const onRefresh = useCallback(()=>{ setRefreshing(true); void load(); },[load]);

  const baseCurrency = data?.prefs?.base_currency ?? "ILS";
  const cashByCurrency = useMemo(()=>{
    if(!data) return [];
    return period==="month" ? (data as any).cashByCurrencyMonth ?? [] : (data as any).cashByCurrency3 ?? [];
  },[data, period]);
  const periodBounds = useMemo(()=> data ? (period==="month" ? (data as any).monthBounds : (data as any).threeBounds) as {start:string;end:string} : wealthPeriodBounds(period), [data, period]);
  const hasUnknown = useMemo(()=> (cashByCurrency as any[]).some(c=> (c as any).unknown>0), [cashByCurrency]);

  const isFresh = !loading && data && data.accounts.filter(a=>!a.is_archived).length===0 && data.transactions.length===0 && data.recurrings.length===0 && data.goals.length===0;

  // ── Account handlers ──
  const openAddAcc = (acc?: any) => {
    if(acc){ setEditAccId(acc.id); setAccName(acc.name); setAccType(acc.type); setAccBal(String(acc.starting_balance)); setAccCurr(acc.currency); setAccInst(acc.institution_name ?? ""); }
    else { setEditAccId(null); setAccName(""); setAccType("checking"); setAccBal(""); setAccCurr(baseCurrency); setAccInst(""); }
    setShowAddAccount(true);
  };
  const saveAccount = async ()=>{
    const name = accName.trim(); if(!name){ Alert.alert("Name required"); return; }
    const bal = parseWealthAmount(accBal); if(bal===null){ Alert.alert("Valid balance required (e.g. 1000.50)"); return; }
    if(!/^[A-Z]{3}$/.test(accCurr)){ Alert.alert("Currency must be 3 letters"); return; }
    try{
      if(editAccId) await updateWealthAccount(editAccId, { name, type:accType, starting_balance: bal, currency:accCurr, institution_name: accInst.trim() || null });
      else await createWealthAccount({ name, type:accType, starting_balance: bal, currency:accCurr, institution_name: accInst.trim() || null });
      setShowAddAccount(false); void load();
    } catch(e:any){ Alert.alert("Error", e.message); }
  };

  // Transaction handlers
  const saveTx = async ()=>{
    const title = txTitle.trim(); if(!title){ Alert.alert("Title required"); return; }
    const amt = parseWealthAmount(txAmt); if(amt===null || amt<=0){ Alert.alert("Positive amount required"); return; }
    if(!txAcc){ Alert.alert("Account required"); return; }
    try{
      if(editTxId) await updateWealthTransaction(editTxId, { title, amount: amt, category_id: txCat, transaction_date: txDate, account_id: txAcc });
      else {
        if(txType==="transfer"){ Alert.alert("Use Transfer flow for transfers"); return; }
        await createWealthTransaction({ account_id: txAcc, category_id: txCat, amount: amt, type: txType, title, note: txNote||null, transaction_date: txDate });
      }
      setShowTx(false); setEditTxId(null); void load();
    } catch(e:any){ Alert.alert("Error", e.message); }
  };
  const saveTransfer = async ()=>{
    const amt = parseWealthAmount(trAmt); if(amt===null|| amt<=0){ Alert.alert("Positive amount required"); return; }
    if(!trFrom || !trTo){ Alert.alert("Both accounts required"); return; }
    if(trFrom===trTo){ Alert.alert("Choose different accounts"); return; }
    try{ await createPairedTransfer({ from_account_id: trFrom, to_account_id: trTo, amount: amt, transaction_date: trDate }); setShowTransfer(false); void load(); } catch(e:any){ Alert.alert("Transfer failed", e.message); }
  };

  // Recurring
  const saveRec = async ()=>{
    const n = recName.trim(); if(!n){ Alert.alert("Name required"); return; }
    const amt = parseWealthAmount(recAmt); if(amt===null|| amt<=0){ Alert.alert("Positive amount required"); return; }
    if(!/^[A-Z]{3}$/.test(recCurr)){ Alert.alert("Currency 3 letters"); return; }
    try{
      if(editRecId) await updateWealthRecurring(editRecId, { name:n, amount:amt, currency:recCurr, frequency:recFreq, next_due_date:recDue, kind: recKind });
      else await createWealthRecurring({ name:n, kind:recKind, amount:amt, currency:recCurr, frequency:recFreq, next_due_date:recDue });
      setShowRec(false); setEditRecId(null); void load();
    }catch(e:any){ Alert.alert("Error", e.message); }
  };

  // Goal
  const saveGoal = async ()=>{
    const t = goalTitle.trim(); if(!t){ Alert.alert("Title required"); return; }
    const v = goalValue.trim() ? parseWealthAmount(goalValue) : null; if(goalValue.trim() && v===null){ Alert.alert("Target must be numeric"); return; }
    if(!/^[A-Z]{3}$/.test(goalCurr)){ Alert.alert("Currency required"); return; }
    try{
      await createWealthGoal({ title:t, goal_type: goalType, target_metric: (WEALTH_GOAL_TARGET_METRIC as any)[goalType] ?? "savings_balance", target_value: v, target_unit: goalCurr, target_date: goalDate.trim() || null });
      setShowGoal(false); setGoalTitle(""); setGoalValue(""); setGoalDate(""); void load();
    }catch(e:any){ Alert.alert("Error", e.message); }
  };

  if(loading) return <View style={s.center}><Stack.Screen options={{ title:"Wealth" }} /><ActivityIndicator color={colors.accent} /></View>;
  if(err) return <View style={s.center}><Text style={s.err}>{err}</Text></View>;
  if(!data) return <View style={s.center}><Text style={s.note}>Sign in to view Wealth.</Text></View>;

  const activeAccs = data.accounts.filter(a=>!a.is_archived);
  const archivedCount = data.accounts.filter(a=>a.is_archived).length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      <Stack.Screen options={{ title:"Wealth", headerStyle:{backgroundColor:colors.bg}, headerTintColor:colors.textPrimary }} />

      {/* Header */}
      <View style={s.headerRow}>
        <View style={s.headerIcon}><WealthIcon size={18} color="#0ea5e9" /></View>
        <View style={{flex:1}}>
          <Text style={s.eyebrow}>WEALTH</Text>
          <Text style={s.title}>Your financial picture</Text>
          <Text style={s.sub}>Manual-first · no auto-drift · balances are as you set them.</Text>
        </View>
      </View>
      <Link href="/realms" asChild><TouchableOpacity style={s.back}><Text style={s.backText}>‹ Realms</Text></TouchableOpacity></Link>

      {isFresh ? (
        <View style={s.emptyHero}>
          <WealthIcon size={28} color={colors.accent} />
          <Text style={s.emptyTitle}>Build your financial picture</Text>
          <Text style={s.emptySub}>Start with one account. Transactions and goals build from there.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={()=>openAddAcc()} activeOpacity={0.85}><Text style={s.primaryText}>Add your first account</Text></TouchableOpacity>
          <View style={s.emptySecondaryRow}>
            <TouchableOpacity onPress={()=>{ setGoalCurr(baseCurrency); setShowGoal(true); }} style={s.secondaryBtn}><Text style={s.secondaryText}>+ Goal</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setShowRec(true)} style={s.secondaryBtn}><Text style={s.secondaryText}>+ Recurring</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Net worth hero */}
      <View style={s.card}>
        <Text style={s.cardLabel}>NET WORTH</Text>
        {data.balance.length===0 ? <Text style={s.note}>No active accounts.</Text> : data.balance.map(b=> (
          <View key={b.currencyCode} style={s.netRow}>
            <Text style={s.netCurr}>{b.currencyCode}</Text>
            <Text style={s.netValue}>{formatWealthGrouped(b.netWorth, b.currencyCode)}</Text>
            <Text style={s.netMeta}>Assets {formatWealthGrouped(b.assets, b.currencyCode)} · Liabilities {formatWealthGrouped(b.liabilities, b.currencyCode)}</Text>
          </View>
        ))}
        {activeAccs.length===1 ? <Text style={s.metaWarn}>Based on 1 tracked account — add more for a fuller picture.</Text> : null}
        {activeAccs.length>1 && data.balance.length>1 ? <Text style={s.metaWarn}>Totals are per-currency — no FX conversion is applied.</Text> : null}
      </View>

      {/* Accounts */}
      <View style={s.card}>
        <View style={s.sectionHead}>
          <Text style={s.cardLabel}>ACCOUNTS · {activeAccs.length}</Text>
          <TouchableOpacity style={s.addBtn} onPress={()=>openAddAcc()}><Plus size={14} color={colors.onAccent} /><Text style={s.addBtnText}>Add</Text></TouchableOpacity>
        </View>
        {activeAccs.length===0 ? <Text style={s.note}>No accounts yet.</Text> : activeAccs.map(a=> (
          <TouchableOpacity key={a.id} style={s.row} onPress={()=>openAddAcc(a)} activeOpacity={0.7}>
            <View style={{flex:1}}>
              <Text style={s.rowTitle}>{a.name} · <Text style={s.rowMeta}>{(WEALTH_ACCOUNT_TYPE_DISPLAY as any)[a.type] ?? a.type}</Text></Text>
              <Text style={s.rowSub}>{formatWealthGrouped(a.starting_balance, a.currency)} {a.institution_name ? `· ${a.institution_name}` : ""}</Text>
            </View>
            <Text style={s.rowAmount}>{formatWealthGrouped(a.starting_balance, a.currency)}</Text>
          </TouchableOpacity>
        ))}
        {archivedCount>0 ? <Text style={s.noteSmall}>{archivedCount} archived</Text> : null}
      </View>

      {/* Cash flow */}
      <View style={s.card}>
        <Text style={s.cardLabel}>CASH FLOW</Text>
        <View style={s.periodRow}>
          { (["month","3months"] as Period[]).map(p=> (
            <TouchableOpacity key={p} style={[s.periodBtn, period===p && s.periodActive]} onPress={()=>setPeriod(p)}><Text style={[s.periodText, period===p && s.periodActiveText]}>{p==="month" ? "THIS MONTH" : "3 MONTHS"}</Text></TouchableOpacity>
          ))}
          <Text style={s.periodRange}>{periodBounds.start} → {periodBounds.end}</Text>
        </View>
        {cashByCurrency.length===0 ? <Text style={s.note}>No spending recorded for this period. Based on recorded transactions.</Text> : cashByCurrency.map((c:any)=> (
          <View key={c.currency} style={s.cashRow}>
            <Text style={s.cashCurr}>{c.currency}</Text>
            {c.count===0 ? <Text style={s.note}>No spending recorded for this period. Based on recorded transactions.</Text> : (
              <View style={s.cashGrid}>
                <View style={s.cashCell}><Text style={s.cashLabel}>Income</Text><Text style={s.cashValue}>{formatWealthGrouped(c.income, c.currency)}</Text></View>
                <View style={s.cashCell}><Text style={s.cashLabel}>Expenses</Text><Text style={s.cashValue}>{formatWealthGrouped(c.expenses, c.currency)}</Text></View>
                <View style={s.cashCell}><Text style={s.cashLabel}>Net</Text><Text style={[s.cashValue, c.net<0 && {color:colors.danger}]}>{formatWealthGrouped(c.net, c.currency)}</Text></View>
              </View>
            )}
          </View>
        ))}
        <Text style={s.noteSmall}>Based on recorded transactions. Transfers and adjustments excluded. Per-currency — no conversion.</Text>
        {hasUnknown ? <Text style={s.noteSmall}>Some legacy transactions have no account currency — marked as partial/unknown rather than assumed ILS.</Text> : null}
      </View>

      {/* Financial Rhythm — deterministic history */}
      {intel ? (
        <View style={s.card}>
          <Text style={s.cardLabel}>FINANCIAL RHYTHM</Text>
          <View style={s.periodRow}>
            {([3,6,12] as const).map(m=> (
              <TouchableOpacity key={m} style={[s.periodBtn, histMonths===m && s.periodActive]} onPress={()=>setHistMonths(m)}><Text style={[s.periodText, histMonths===m && s.periodActiveText]}>{m}M</Text></TouchableOpacity>
            ))}
          </View>
          {intel.currencies.length===0 ? <Text style={s.note}>No accounts — history not available.</Text> : intel.currencies.map((cur:string)=>{
            const hist = (intel.historyPerCurrency as any)[cur] as any[]; const slice = hist ? hist.slice(-histMonths) : [];
            const max = Math.max(1, ...slice.map(h=> Math.max(h.income, h.expenses)));
            const hasAny = slice.some(h=>h.hasData);
            if(!hasAny) return <View key={cur} style={s.cashRow}><Text style={s.cashCurr}>{cur}</Text><Text style={s.note}>Not enough recorded history yet.</Text></View>;
            return (
              <View key={cur} style={s.cashRow}>
                <Text style={s.cashCurr}>{cur} · {histMonths} months</Text>
                <View style={{flexDirection:"row", alignItems:"flex-end", gap:6, height:44, marginTop:8}}>
                  {slice.map((h:any)=>(
                    <View key={h.month} style={{flex:1, alignItems:"center", gap:2}}>
                      <View style={{flexDirection:"row", gap:2, alignItems:"flex-end", height:32}}>
                        <View style={{width:8, height: (h.income/max)*28+2, backgroundColor: colors.accentSoft, borderWidth:1, borderColor: colors.accentBorder, borderRadius:3}} />
                        <View style={{width:8, height: (h.expenses/max)*28+2, backgroundColor: "rgba(239,68,68,0.16)", borderWidth:1, borderColor:"rgba(239,68,68,0.22)", borderRadius:3}} />
                      </View>
                      <Text style={{fontSize:9, color: h.isPartial? colors.warning : colors.textFaint}}>{h.month.slice(5)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.noteSmall}>Recorded income (blue) vs expenses (muted red). Current month is partial.</Text>
                {intel.trends.find((t:any)=>t.currency===cur && t.isSufficient) ? (
                  <Text style={s.noteSmall}>
                    {(() => { const tr=intel.trends.find((t:any)=>t.currency===cur); return `Previous: income ${formatWealthGrouped(tr.previous.income, cur)} expenses ${formatWealthGrouped(tr.previous.expenses, cur)} · Net change ${formatWealthGrouped(tr.netChange, cur)}${tr.expenseChangePct!=null?` · Expenses ${Math.round(tr.expenseChangePct*100)}%`:``} · ${tr.coverage}`; })()}
                  </Text>
                ) : <Text style={s.noteSmall}>Not enough transaction history for a 3-month comparison. Based on recorded transactions.</Text>}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Budgets — explicit currency, legacy NULL handled */}
      {intel ? (
        <View style={s.card}>
          <View style={s.sectionHead}><Text style={s.cardLabel}>BUDGETS · {intel.budgetStatuses.length}</Text><TouchableOpacity style={s.addBtn} onPress={()=>{ setBudgetCat(data?.categories[0]?.id ?? null); setBudgetAmt(""); setBudgetMonth(new Date().toISOString().slice(0,7)+"-01"); setBudgetCurr(intel.baseCurrency); setShowBudget(true); }}><Text style={s.addBtnText}>+ Add</Text></TouchableOpacity></View>
          <Text style={s.noteSmall}>Each budget has an explicit currency. Legacy budgets with no currency show “Currency not set”.</Text>
          {intel.budgetStatuses.length===0 ? <Text style={s.note}>No budgets for this month.</Text> : intel.budgetStatuses.map((b:any)=>(
            <View key={b.budgetId} style={s.row}>
              <View style={{flex:1}}>
                <Text style={s.rowTitle}>{b.categoryName} {b.currency?`· ${b.currency}`:"· Currency not set"}</Text>
                {b.status==="currency_unknown" ? (
                  <Text style={s.rowMeta}>Set a currency to compare this budget with recorded spending.</Text>
                ) : (
                  <Text style={s.rowMeta}>Budget {formatWealthGrouped(b.budget,b.currency)} · Recorded {formatWealthGrouped(b.actual,b.currency)} · Remaining {formatWealthGrouped(b.remaining,b.currency)} · {Math.round((b.percentUsed ?? 0)*100)}% {b.status}</Text>
                )}
              </View>
              <View style={{gap:6, alignItems:"flex-end"}}>
                {b.status==="currency_unknown" ? (
                  <View style={{flexDirection:"row", gap:4}}>
                    {WEALTH_CURRENCIES.map(c=>(
                      <TouchableOpacity key={c} style={[s.currChip, s.chip, {paddingVertical:4}]} onPress={async()=>{ try{ await setWealthBudgetCurrency(b.budgetId, c); void load(); }catch(e:any){ Alert.alert("Error",e.message);} }}><Text style={s.currText}>{c}</Text></TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <TouchableOpacity onPress={async()=>{ try{ await deleteWealthBudget(b.budgetId); void load(); }catch(e:any){ Alert.alert("Error",e.message);} }}><Text style={s.dangerText}>Delete</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Goal Progress — truthful */}
      {intel ? (
        <View style={s.card}>
          <Text style={s.cardLabel}>GOAL PROGRESS</Text>
          {intel.goalProgress.length===0 ? <Text style={s.note}>No Wealth goals yet. Progress appears after you set a target.</Text> : intel.goalProgress.map((g:any)=>(
            <View key={g.goalId} style={s.row}>
              <View style={{flex:1}}>
                <Text style={s.rowTitle}>{g.title} · {g.type} {g.currency?`· ${g.currency}`:""}</Text>
                <Text style={s.rowMeta}>
                  {g.target!=null && g.currency?`Target ${formatWealthGrouped(g.target, g.currency)}`:"No target"} {g.current!=null && g.currency?`· Current ${formatWealthGrouped(g.current, g.currency)}`:`· ${g.sourceDescription ?? "Insufficient tracked data"}`}
                  {g.progressPct!=null?` · ${Math.round(g.progressPct*100)}%`:""} · {g.status} {g.direction==="down"?"(lower is toward target)":""}
                </Text>
                {g.progressPct!=null ? <View style={{height:6, backgroundColor: colors.surfaceElevated, borderRadius:3, marginTop:6, overflow:"hidden"}}><View style={{width: `${Math.min(100, Math.round(g.progressPct*100))}%`, height:6, backgroundColor: g.status==="achieved"? colors.success : colors.accent}} /></View> : <Text style={s.noteSmall}>{g.sourceDescription}</Text>}
              </View>
            </View>
          ))}
          <Text style={s.noteSmall}>Progress from tracked account balances — not from transaction sums, no fake history.</Text>
        </View>
      ) : null}

      {/* Insights — bounded 3-5, descriptive */}
      {intel && intel.insights.length>0 ? (
        <View style={s.card}>
          <Text style={s.cardLabel}>INSIGHTS · {intel.insights.length}</Text>
          {intel.insights.map((ins:any, i:number)=>(
            <View key={i} style={[s.row, {borderBottomWidth: i===intel.insights.length-1?0:1}]}>
              <View style={{flex:1}}><Text style={s.rowTitle}>{ins.title}</Text><Text style={s.rowMeta}>{ins.rationale}{ins.currency?` · ${ins.currency}`:""}</Text></View>
            </View>
          ))}
          <Text style={s.noteSmall}>Descriptive, not advisory. Max 5.</Text>
        </View>
      ) : null}

      {/* Recurring intelligence + Data coverage + Net-worth history note */}
      {intel ? (
        <>
          <View style={s.card}>
            <Text style={s.cardLabel}>RECURRING OBLIGATIONS</Text>
            <Text style={s.rowMeta}>Due 7d {intel.recurringIntel.due7.length} · Due 30d {intel.recurringIntel.due30.length} · Scheduled date has passed {intel.recurringIntel.overdue.length}</Text>
            {intel.recurringIntel.overdue.length>0 ? intel.recurringIntel.overdue.slice(0,3).map((r:any)=><Text key={r.id} style={s.rowMeta}>{r.name} · {r.currency} {formatWealthGrouped(r.amount,r.currency)} · scheduled {r.next_due_date} (has passed)</Text>) : null}
            {Object.keys(intel.recurringIntel.outflowByCurrency).length>0 ? <Text style={s.noteSmall}>Upcoming committed outflow: {Object.entries(intel.recurringIntel.outflowByCurrency).map(([c,v])=> `${formatWealthGrouped(v as number, c)}`).join(", ")} per currency — income separate.</Text> : null}
            <Text style={s.noteSmall}>Recurring savings/investment not labeled as expense. No adherence history — next_due_date only.</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardLabel}>DATA COVERAGE</Text>
            <Text style={s.rowMeta}>Accounts tracked {intel.coverage.accountsTracked} · Transactions recorded {intel.coverage.transactionsRecorded} · History months {intel.coverage.historyMonths} · Budgets {intel.coverage.budgetsConfigured} · Goals {intel.coverage.goalsConfigured} · Recurring {intel.coverage.recurringConfigured}</Text>
            <Text style={s.rowMeta}>Balances fresh {intel.coverage.balancesFresh} · stale {intel.coverage.balancesStale} (30d threshold) · Unknown currency {intel.coverage.unknownCurrency}</Text>
            <Text style={s.noteSmall}>{intel.coverage.note}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardLabel}>NET WORTH HISTORY</Text>
            <Text style={s.note}>Historical balance trend will appear as you update balances over time. Current: tracked assets/liabilities per currency shown above. No fake net-worth trend.</Text>
          </View>
        </>
      ) : null}

      {/* Recent activity */}
      <View style={s.card}>
        <View style={s.sectionHead}>
          <Text style={s.cardLabel}>RECENT ACTIVITY</Text>
          <View style={{flexDirection:"row", gap:8}}>
            <TouchableOpacity style={s.addBtn} onPress={()=>{ setEditTxId(null); setTxType("expense"); setTxTitle(""); setTxAmt(""); setTxAcc(activeAccs[0]?.id ?? null); setTxCat(null); setShowTx(true); }}><Text style={s.addBtnText}>+ Add</Text></TouchableOpacity>
            <TouchableOpacity style={s.addBtnSecondary} onPress={()=>{ setTrFrom(activeAccs[0]?.id ?? ""); setTrTo(activeAccs[1]?.id ?? ""); setShowTransfer(true); }}><Text style={s.addBtnSecondaryText}>Transfer</Text></TouchableOpacity>
          </View>
        </View>
        {data.transactions.length===0 ? <Text style={s.note}>Cash-flow picture is incomplete — no transactions yet.</Text> : data.transactions.slice(0,12).map(t=> (
          <TouchableOpacity key={t.id} style={s.txRow} onPress={async()=>{
            if(t.type==="transfer"){ Alert.alert("Transfer","Transfers are linked pairs — delete to recreate."); return; }
            setEditTxId(t.id); setTxType(t.type); setTxTitle(t.title); setTxAmt(String(t.amount)); setTxDate(t.transaction_date); setTxAcc(t.account_id); setTxCat(t.category_id); setTxNote(t.note ?? ""); setShowTx(true);
          }}>
            <View style={[s.txDot, t.type==="income" ? {backgroundColor: colors.accentSoft, borderColor: colors.accentBorder} : t.type==="transfer" ? {backgroundColor:"rgba(148,163,184,0.12)", borderColor: colors.border} : {backgroundColor: colors.surfaceOverlay} ]} />
            <View style={{flex:1}}>
              <Text style={s.txTitle}>{t.title} {t.type==="transfer" ? "· transfer" : t.type==="adjustment" ? "· adjustment" : ""}</Text>
              <Text style={s.txMeta}>{t.transaction_date} · {(t as any).raw?.finance_accounts?.name ?? activeAccs.find(a=>a.id===t.account_id)?.name ?? "—"} {(t as any).raw?.finance_categories?.name ? `· ${(t as any).raw.finance_categories.name}` : ""} · {(t as any).currency}</Text>
            </View>
            <Text style={[s.txAmt, t.type==="income" && {color: colors.accentStrong}]}>{t.type==="income" ? "+" : t.type==="expense" ? "−" : "↔"} {formatWealth(t.amount, (t as any).currency)}</Text>
          </TouchableOpacity>
        ))}
        {data.transactions.some(t=>t.type==="transfer") ? <Text style={s.noteSmall}>Transfers show as ↔ and do not affect cash flow.</Text> : null}
      </View>

      {/* Recurring */}
      <View style={s.card}>
        <View style={s.sectionHead}>
          <Text style={s.cardLabel}>UPCOMING</Text>
          <TouchableOpacity style={s.addBtn} onPress={()=>{ setEditRecId(null); setRecName(""); setRecAmt(""); setRecKind("bill"); setRecCurr(baseCurrency); setRecFreq("monthly"); setShowRec(true); }}><Text style={s.addBtnText}>+ Add</Text></TouchableOpacity>
        </View>
        <Text style={s.subLabel}>Next 7 days · {data.upcoming7.length} · Next 30 days · {data.upcoming30.length}</Text>
        {data.recurrings.length===0 ? <Text style={s.note}>No recurring items.</Text> : data.recurrings.slice(0,10).map(r=> (
          <View key={r.id} style={s.row}>
            <View style={{flex:1}}>
              <Text style={s.rowTitle}>{r.name} <Text style={[s.badge, r.kind==="income" ? {backgroundColor: colors.accentSoft, color: colors.accentStrong} : null] as any}> {r.kind}</Text></Text>
              <Text style={s.rowMeta}>{formatWealth(r.amount, r.currency)} · {r.frequency} · due {r.next_due_date}</Text>
            </View>
            <TouchableOpacity onPress={async()=>{ try{ const n = await advanceWealthRecurring(r.id); Alert.alert("Advanced", `Next due ${n}`); void load(); } catch(e:any){ Alert.alert("Error", e.message);} }} style={s.smallBtn}><Text style={s.smallBtnText}>Advance</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{ setEditRecId(r.id); setRecName(r.name); setRecKind(r.kind); setRecAmt(String(r.amount)); setRecCurr(r.currency); setRecFreq(r.frequency); setRecDue(r.next_due_date); setShowRec(true); }} style={s.smallBtnSecondary}><Text style={s.smallBtnSecondaryText}>Edit</Text></TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Goals */}
      <View style={s.card}>
        <View style={s.sectionHead}>
          <Text style={s.cardLabel}>GOALS</Text>
          <TouchableOpacity style={s.addBtn} onPress={()=>{ setGoalCurr(baseCurrency); setShowGoal(true); }}><Text style={s.addBtnText}>+ Add</Text></TouchableOpacity>
        </View>
        {data.goals.length===0 ? <Text style={s.note}>No Wealth goals yet. Add a savings or net-worth target.</Text> : data.goals.map((g:any)=> (
          <View key={g.id} style={s.row}>
            <View style={{flex:1}}><Text style={s.rowTitle}>{g.title}</Text><Text style={s.rowMeta}>{(WEALTH_GOAL_TYPE_DISPLAY as any)[g.goal_type] ?? g.goal_type ?? ""} {g.target_value ? `· Target ${formatWealth(Number(g.target_value), baseCurrency)}` : ""} {g.target_date ? `· ${g.target_date}` : ""}</Text></View>
            <TouchableOpacity onPress={async()=>{ try{ await deleteWealthGoal(g.id); void load(); } catch(e:any){ Alert.alert("Error", e.message);} }}><Text style={s.dangerText}>Delete</Text></TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Preferences */}
      <View style={s.card}>
        <Text style={s.cardLabel}>PREFERENCES</Text>
        <View style={s.prefRow}>
          <Text style={s.prefLabel}>Base currency</Text>
          <View style={s.currencyRow}>{WEALTH_CURRENCIES.map(c=> (
            <TouchableOpacity key={c} style={[s.currChip, baseCurrency===c && s.currChipActive]} onPress={async()=>{ try{ await setBaseCurrency(c); void load(); }catch(e:any){ Alert.alert("Error", e.message);} }}><Text style={[s.currText, baseCurrency===c && s.currTextActive]}>{c}</Text></TouchableOpacity>
          ))}</View>
        </View>
        <Text style={s.noteSmall}>Changing base currency does not convert stored amounts — it sets the default for new accounts and displays grouped summaries.</Text>
        <View style={s.divider} />
        <Text style={s.prefLabel}>NEXTRON ACCESS</Text>
        <Text style={s.note}>Financial data is not shared with NEXTRON unless you enable it. Off by default.</Text>
        <Text style={s.noteSmall}>Provider untouched in Prompt 2. Enablement wires in Prompt 4.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.noteSmall}>finance_budgets preserved (not surfaced in Wealth V1).</Text>
        <Text style={s.noteSmall}>Account Balance is manual — transactions do not silently change Balance.</Text>
      </View>

      {/* ── Modals ── */}
      <Modal visible={showAddAccount} transparent animationType="slide" onRequestClose={()=>setShowAddAccount(false)}>
        <View style={s.modalBg}><View style={s.modal}>
          <View style={s.modalHead}><Text style={s.modalTitle}>{editAccId ? "Edit account" : "Add account"}</Text><TouchableOpacity onPress={()=>setShowAddAccount(false)}><Close size={18} color={colors.textMuted} /></TouchableOpacity></View>
          <Text style={s.inputLabel}>Name</Text><TextInput style={s.input} value={accName} onChangeText={setAccName} placeholder="Checking" placeholderTextColor={colors.textFaint} />
          <Text style={s.inputLabel}>Type</Text>
          <View style={s.chipRow}>{WEALTH_ACCOUNT_TYPE_OPTIONS.map(o=> (<TouchableOpacity key={o.value} style={[s.chip, accType===o.value && s.chipActive]} onPress={()=>setAccType(o.value)}><Text style={[s.chipText, accType===o.value && s.chipTextActive]}>{o.label}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Balance (current balance)</Text><TextInput style={s.input} value={accBal} onChangeText={setAccBal} keyboardType="decimal-pad" placeholder="1000.00" placeholderTextColor={colors.textFaint} />
          <Text style={s.inputLabel}>Currency</Text>
          <View style={s.chipRow}>{WEALTH_CURRENCIES.map(c=> (<TouchableOpacity key={c} style={[s.chip, accCurr===c && s.chipActive]} onPress={()=>setAccCurr(c)}><Text style={[s.chipText, accCurr===c && s.chipTextActive]}>{c}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Institution (optional)</Text><TextInput style={s.input} value={accInst} onChangeText={setAccInst} placeholder="Bank name" placeholderTextColor={colors.textFaint} />
          <TouchableOpacity style={s.primaryBtn} onPress={saveAccount}><Text style={s.primaryText}>Save account</Text></TouchableOpacity>
          {editAccId ? <View style={{flexDirection:"row", gap:8, marginTop:8}}><TouchableOpacity style={s.secondaryBtn} onPress={async()=>{ try{ await archiveWealthAccount(editAccId!, true); setShowAddAccount(false); void load(); }catch(e:any){ Alert.alert("Error", e.message);} }}><Text style={s.secondaryText}>Archive</Text></TouchableOpacity><TouchableOpacity style={s.secondaryBtn} onPress={async()=>{ try{ await archiveWealthAccount(editAccId!, false); setShowAddAccount(false); void load(); }catch(e:any){ Alert.alert("Error", e.message);} }}><Text style={s.secondaryText}>Unarchive</Text></TouchableOpacity></View> : null}
        </View></View>
      </Modal>

      <Modal visible={showTx} transparent animationType="slide" onRequestClose={()=>setShowTx(false)}>
        <View style={s.modalBg}><View style={s.modal}>
          <View style={s.modalHead}><Text style={s.modalTitle}>{editTxId ? "Edit transaction" : "Add transaction"}</Text><TouchableOpacity onPress={()=>setShowTx(false)}><Close size={18} color={colors.textMuted} /></TouchableOpacity></View>
          <View style={s.chipRow}>{["income","expense","adjustment"].map(t=> (<TouchableOpacity key={t} style={[s.chip, txType===t && s.chipActive]} onPress={()=>setTxType(t)}><Text style={[s.chipText, txType===t && s.chipTextActive]}>{t}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Title</Text><TextInput style={s.input} value={txTitle} onChangeText={setTxTitle} placeholder="Groceries" placeholderTextColor={colors.textFaint} />
          <Text style={s.inputLabel}>Amount</Text><TextInput style={s.input} value={txAmt} onChangeText={setTxAmt} keyboardType="decimal-pad" placeholder="25.00" placeholderTextColor={colors.textFaint} />
          <Text style={s.inputLabel}>Account</Text>
          <View style={s.chipRow}>{data.accounts.filter(a=>!a.is_archived).map(a=> (<TouchableOpacity key={a.id} style={[s.chip, txAcc===a.id && s.chipActive]} onPress={()=>setTxAcc(a.id)}><Text style={[s.chipText, txAcc===a.id && s.chipTextActive]}>{a.name}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Category (optional)</Text>
          <View style={s.chipRow}>
            <TouchableOpacity style={[s.chip, !txCat && s.chipActive]} onPress={()=>setTxCat(null)}><Text style={[s.chipText, !txCat && s.chipTextActive]}>None</Text></TouchableOpacity>
            {data.categories.filter(c=> c.type===txType || txType==="adjustment").slice(0,6).map(c=> (<TouchableOpacity key={c.id} style={[s.chip, txCat===c.id && s.chipActive]} onPress={()=>setTxCat(c.id)}><Text style={[s.chipText, txCat===c.id && s.chipTextActive]}>{c.name}</Text></TouchableOpacity>))}
          </View>
          <Text style={s.inputLabel}>Date (YYYY-MM-DD)</Text><TextInput style={s.input} value={txDate} onChangeText={setTxDate} placeholder="2026-09-03" placeholderTextColor={colors.textFaint} />
          {txType==="adjustment" ? (<><Text style={s.inputLabel}>Note (why)</Text><TextInput style={s.input} value={txNote} onChangeText={setTxNote} placeholder="Correction" placeholderTextColor={colors.textFaint} /></>) : null}
          <TouchableOpacity style={s.primaryBtn} onPress={saveTx}><Text style={s.primaryText}>{editTxId ? "Update" : "Save"}</Text></TouchableOpacity>
          {editTxId ? <TouchableOpacity style={[s.secondaryBtn,{marginTop:8}]} onPress={async()=>{ try{ await deleteWealthTransaction(editTxId!); setShowTx(false); void load(); }catch(e:any){ Alert.alert("Error", e.message);} }}><Text style={[s.secondaryText,{color:colors.danger}]}>Delete transaction</Text></TouchableOpacity> : null}
        </View></View>
      </Modal>

      <Modal visible={showTransfer} transparent animationType="slide" onRequestClose={()=>setShowTransfer(false)}>
        <View style={s.modalBg}><View style={s.modal}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Transfer</Text><TouchableOpacity onPress={()=>setShowTransfer(false)}><Close size={18} color={colors.textMuted} /></TouchableOpacity></View>
          <Text style={s.noteSmall}>Moves between two tracked accounts. Same currency only. No cash-flow impact. Linked pair.</Text>
          <Text style={s.inputLabel}>From</Text>
          <View style={s.chipRow}>{data.accounts.filter(a=>!a.is_archived).map(a=> (<TouchableOpacity key={a.id} style={[s.chip, trFrom===a.id && s.chipActive]} onPress={()=>setTrFrom(a.id)}><Text style={[s.chipText, trFrom===a.id && s.chipTextActive]}>{a.name}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>To</Text>
          <View style={s.chipRow}>{data.accounts.filter(a=>!a.is_archived).map(a=> (<TouchableOpacity key={a.id} style={[s.chip, trTo===a.id && s.chipActive]} onPress={()=>setTrTo(a.id)}><Text style={[s.chipText, trTo===a.id && s.chipTextActive]}>{a.name}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Amount</Text><TextInput style={s.input} value={trAmt} onChangeText={setTrAmt} keyboardType="decimal-pad" placeholder="100.00" placeholderTextColor={colors.textFaint} />
          <Text style={s.inputLabel}>Date</Text><TextInput style={s.input} value={trDate} onChangeText={setTrDate} placeholder="2026-09-03" placeholderTextColor={colors.textFaint} />
          <TouchableOpacity style={s.primaryBtn} onPress={saveTransfer}><Text style={s.primaryText}>Create transfer (paired)</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={showRec} transparent animationType="slide" onRequestClose={()=>setShowRec(false)}>
        <View style={s.modalBg}><View style={s.modal}>
          <View style={s.modalHead}><Text style={s.modalTitle}>{editRecId ? "Edit recurring" : "Add recurring"}</Text><TouchableOpacity onPress={()=>setShowRec(false)}><Close size={18} color={colors.textMuted} /></TouchableOpacity></View>
          <Text style={s.inputLabel}>Name</Text><TextInput style={s.input} value={recName} onChangeText={setRecName} placeholder="Rent" placeholderTextColor={colors.textFaint} />
          <View style={s.chipRow}>{["income","bill","subscription","debt_payment","savings","investment","other"].map(k=> (<TouchableOpacity key={k} style={[s.chip, recKind===k && s.chipActive]} onPress={()=>setRecKind(k)}><Text style={[s.chipText, recKind===k && s.chipTextActive]}>{k}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Amount</Text><TextInput style={s.input} value={recAmt} onChangeText={setRecAmt} keyboardType="decimal-pad" placeholder="500.00" placeholderTextColor={colors.textFaint} />
          <View style={s.chipRow}>{WEALTH_CURRENCIES.map(c=> (<TouchableOpacity key={c} style={[s.chip, recCurr===c && s.chipActive]} onPress={()=>setRecCurr(c)}><Text style={[s.chipText, recCurr===c && s.chipTextActive]}>{c}</Text></TouchableOpacity>))}</View>
          <View style={s.chipRow}>{["weekly","monthly","quarterly","yearly"].map(f=> (<TouchableOpacity key={f} style={[s.chip, recFreq===f && s.chipActive]} onPress={()=>setRecFreq(f)}><Text style={[s.chipText, recFreq===f && s.chipTextActive]}>{f}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Next due (YYYY-MM-DD)</Text><TextInput style={s.input} value={recDue} onChangeText={setRecDue} placeholder="2026-09-10" placeholderTextColor={colors.textFaint} />
          <TouchableOpacity style={s.primaryBtn} onPress={saveRec}><Text style={s.primaryText}>Save recurring</Text></TouchableOpacity>
          {editRecId ? <View style={{flexDirection:"row", gap:8, marginTop:8}}><TouchableOpacity style={s.secondaryBtn} onPress={async()=>{ try{ await setRecurringActive(editRecId!, false); setShowRec(false); void load(); }catch(e:any){ Alert.alert("Error", e.message);} }}><Text style={s.secondaryText}>Deactivate</Text></TouchableOpacity><TouchableOpacity style={s.secondaryBtn} onPress={async()=>{ try{ await setRecurringActive(editRecId!, true); setShowRec(false); void load(); }catch(e:any){ Alert.alert("Error", e.message);} }}><Text style={s.secondaryText}>Reactivate</Text></TouchableOpacity></View> : null}
        </View></View>
      </Modal>

      <Modal visible={showGoal} transparent animationType="slide" onRequestClose={()=>setShowGoal(false)}>
        <View style={s.modalBg}><View style={s.modal}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Add Wealth goal</Text><TouchableOpacity onPress={()=>setShowGoal(false)}><Close size={18} color={colors.textMuted} /></TouchableOpacity></View>
          <Text style={s.inputLabel}>Title</Text><TextInput style={s.input} value={goalTitle} onChangeText={setGoalTitle} placeholder="Emergency fund" placeholderTextColor={colors.textFaint} />
          <View style={s.chipRow}>{GOAL_OPTIONS.map(o=> (<TouchableOpacity key={o.value} style={[s.chip, goalType===o.value && s.chipActive]} onPress={()=>setGoalType(o.value)}><Text style={[s.chipText, goalType===o.value && s.chipTextActive]}>{o.label}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Target currency</Text>
          <View style={s.chipRow}>{WEALTH_CURRENCIES.map(c=> (<TouchableOpacity key={c} style={[s.chip, goalCurr===c && s.chipActive]} onPress={()=>setGoalCurr(c)}><Text style={[s.chipText, goalCurr===c && s.chipTextActive]}>{c}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Target amount (optional)</Text><TextInput style={s.input} value={goalValue} onChangeText={setGoalValue} keyboardType="decimal-pad" placeholder="20000" placeholderTextColor={colors.textFaint} />
          <Text style={s.inputLabel}>Target date (YYYY-MM-DD, optional)</Text><TextInput style={s.input} value={goalDate} onChangeText={setGoalDate} placeholder="2027-12-31" placeholderTextColor={colors.textFaint} />
          <TouchableOpacity style={s.primaryBtn} onPress={saveGoal}><Text style={s.primaryText}>Create goal</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={showBudget} transparent animationType="slide" onRequestClose={()=>setShowBudget(false)}>
        <View style={s.modalBg}><View style={s.modal}>
          <View style={s.modalHead}><Text style={s.modalTitle}>Add budget</Text><TouchableOpacity onPress={()=>setShowBudget(false)}><Close size={18} color={colors.textMuted} /></TouchableOpacity></View>
          <Text style={s.inputLabel}>Category (expense)</Text>
          <View style={s.chipRow}>{(data?.categories.filter((c:any)=>c.type==="expense").slice(0,8) ?? []).map((c:any)=>(<TouchableOpacity key={c.id} style={[s.chip, budgetCat===c.id && s.chipActive]} onPress={()=>setBudgetCat(c.id)}><Text style={[s.chipText, budgetCat===c.id && s.chipTextActive]}>{c.name}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Amount</Text><TextInput style={s.input} value={budgetAmt} onChangeText={setBudgetAmt} keyboardType="decimal-pad" placeholder="500.00" placeholderTextColor={colors.textFaint} />
          <Text style={s.inputLabel}>Currency</Text>
          <View style={s.chipRow}>{WEALTH_CURRENCIES.map(c=> (<TouchableOpacity key={c} style={[s.chip, budgetCurr===c && s.chipActive]} onPress={()=>setBudgetCurr(c)}><Text style={[s.chipText, budgetCurr===c && s.chipTextActive]}>{c}</Text></TouchableOpacity>))}</View>
          <Text style={s.inputLabel}>Month (YYYY-MM-01)</Text><TextInput style={s.input} value={budgetMonth} onChangeText={setBudgetMonth} placeholder="2026-09-01" placeholderTextColor={colors.textFaint} />
          <Text style={s.noteSmall}>Currency is persisted on the budget; changing base currency later does not alter it.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={async()=>{ const amt=parseWealthAmount(budgetAmt); if(!budgetCat){ Alert.alert("Category required"); return;} if(amt===null){ Alert.alert("Valid amount"); return;} try{ await createWealthBudget({ category_id: budgetCat, month: budgetMonth, amount: amt, currency: budgetCurr}); setShowBudget(false); void load(); }catch(e:any){ Alert.alert("Error",e.message);} }}><Text style={s.primaryText}>Save budget</Text></TouchableOpacity>
        </View></View>
      </Modal>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:{flex:1, backgroundColor: colors.bg}, content:{padding: spacing.xl, paddingTop: 56, paddingBottom: 32},
  center:{flex:1, backgroundColor:colors.bg, alignItems:"center", justifyContent:"center", padding: spacing.xl},
  err:{color:colors.danger, fontSize:13}, note:{color:colors.textSecondary, fontSize:12, marginTop:6, lineHeight:16},
  noteSmall:{color:colors.textMuted, fontSize:11, marginTop:6, lineHeight:14},
  headerRow:{flexDirection:"row", alignItems:"center", gap: spacing.md, marginBottom: 8},
  headerIcon:{width:32, height:32, borderRadius:9, backgroundColor:"rgba(14,165,233,0.14)", borderWidth:1, borderColor:"rgba(14,165,233,0.22)", alignItems:"center", justifyContent:"center"},
  eyebrow:{...type.caption, color: colors.textMuted, fontWeight:"700", letterSpacing:1.6},
  title:{...type.screen, color: colors.textPrimary, marginTop:2},
  sub:{...type.meta, color: colors.textSecondary, marginTop:4},
  back:{alignSelf:"flex-start", marginTop:6, paddingVertical:4}, backText:{color:colors.accent, fontSize:12, fontWeight:"600"},
  card:{backgroundColor: colors.surface, borderWidth:1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.lg},
  cardLabel:{...type.caption, color: colors.textMuted, fontWeight:"700", letterSpacing:1.2},
  sectionHead:{flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom: spacing.sm},
  addBtn:{flexDirection:"row", gap:6, backgroundColor: colors.accent, paddingHorizontal:12, paddingVertical:8, borderRadius: radii.pill, alignItems:"center"},
  addBtnText:{color: colors.onAccent, fontSize:12, fontWeight:"700"},
  addBtnSecondary:{backgroundColor: colors.surfaceElevated, borderWidth:1, borderColor: colors.border, paddingHorizontal:12, paddingVertical:8, borderRadius: radii.pill},
  addBtnSecondaryText:{color: colors.textSecondary, fontSize:12, fontWeight:"600"},
  row:{flexDirection:"row", alignItems:"center", gap: spacing.md, paddingVertical:10, borderBottomWidth:1, borderBottomColor: colors.border},
  rowTitle:{...type.item, color: colors.textPrimary, fontSize:14},
  rowMeta:{color: colors.textMuted, fontWeight:"400", fontSize:12},
  rowSub:{...type.meta, color: colors.textSecondary, marginTop:2},
  rowAmount:{...type.item, color: colors.textPrimary, fontSize:14},
  emptyHero:{backgroundColor: colors.surface, borderWidth:1, borderColor: colors.accentBorder, borderRadius: radii.lg, padding: spacing.xl, marginTop: spacing.lg, alignItems:"center", gap: spacing.sm},
  emptyTitle:{...type.item, color: colors.textPrimary, marginTop:4},
  emptySub:{...type.meta, color: colors.textSecondary, textAlign:"center"},
  primaryBtn:{backgroundColor: colors.accent, paddingVertical:12, paddingHorizontal:16, borderRadius: radii.md, alignItems:"center", marginTop:8},
  primaryText:{color: colors.onAccent, fontWeight:"700", fontSize:14},
  emptySecondaryRow:{flexDirection:"row", gap:8, marginTop:4},
  secondaryBtn:{backgroundColor: colors.surfaceElevated, borderWidth:1, borderColor: colors.border, paddingVertical:10, paddingHorizontal:14, borderRadius: radii.md, alignItems:"center"},
  secondaryText:{color: colors.textSecondary, fontWeight:"600", fontSize:13},
  netRow:{marginTop:10},
  netCurr:{...type.caption, color: colors.accentStrong, fontWeight:"700"},
  netValue:{fontSize:18, fontWeight:"800", color: colors.textPrimary, marginTop:2},
  netMeta:{...type.meta, color: colors.textSecondary, marginTop:2},
  metaWarn:{...type.meta, color: colors.textMuted, marginTop:8, fontStyle:"italic"},
  periodRow:{flexDirection:"row", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap"},
  periodBtn:{paddingHorizontal:10, paddingVertical:6, borderRadius: radii.pill, borderWidth:1, borderColor: colors.border, backgroundColor: colors.surfaceElevated},
  periodActive:{backgroundColor: colors.accentSoft, borderColor: colors.accentBorder},
  periodText:{fontSize:11, fontWeight:"700", color: colors.textMuted, letterSpacing:0.6},
  periodActiveText:{color: colors.accentStrong},
  periodRange:{...type.meta, color: colors.textFaint, marginLeft:4},
  cashRow:{marginTop:10, paddingTop:10, borderTopWidth:1, borderTopColor: colors.border},
  cashCurr:{...type.caption, color: colors.textSecondary, fontWeight:"700"},
  cashGrid:{flexDirection:"row", gap: spacing.md, marginTop:6},
  cashCell:{flex:1},
  cashLabel:{...type.caption, color: colors.textMuted, fontSize:10, letterSpacing:0.6},
  cashValue:{fontSize:14, fontWeight:"700", color: colors.textPrimary, marginTop:2},
  txRow:{flexDirection:"row", alignItems:"center", gap: spacing.md, paddingVertical:10, borderBottomWidth:1, borderBottomColor: colors.border},
  txDot:{width:8, height:8, borderRadius:4, borderWidth:1, borderColor:"transparent"},
  txTitle:{...type.item, color: colors.textPrimary, fontSize:14},
  txMeta:{...type.meta, color: colors.textMuted, marginTop:2},
  txAmt:{fontSize:13, fontWeight:"700", color: colors.textSecondary},
  subLabel:{...type.caption, color: colors.textMuted, marginTop:6},
  badge:{...type.caption, fontSize:10, backgroundColor:"rgba(148,163,184,0.14)", color: colors.textMuted, paddingHorizontal:6, paddingVertical:2, borderRadius:6, overflow:"hidden"},
  smallBtn:{backgroundColor: colors.surfaceElevated, borderWidth:1, borderColor: colors.border, paddingHorizontal:10, paddingVertical:6, borderRadius:8},
  smallBtnText:{fontSize:11, fontWeight:"700", color: colors.textSecondary},
  smallBtnSecondary:{backgroundColor:"transparent", borderWidth:1, borderColor: colors.border, paddingHorizontal:10, paddingVertical:6, borderRadius:8, marginLeft:6},
  smallBtnSecondaryText:{fontSize:11, fontWeight:"600", color: colors.textMuted},
  dangerText:{color: colors.danger, fontSize:12, fontWeight:"700"},
  prefRow:{marginTop:8},
  prefLabel:{...type.caption, color: colors.textSecondary, fontWeight:"700", letterSpacing:0.6, marginTop:6},
  currencyRow:{flexDirection:"row", gap:8, marginTop:8},
  currChip:{paddingHorizontal:12, paddingVertical:7, borderRadius: radii.pill, borderWidth:1, borderColor: colors.border, backgroundColor: colors.surfaceElevated},
  currChipActive:{backgroundColor: colors.accentSoft, borderColor: colors.accentBorder},
  currText:{fontSize:12, fontWeight:"700", color: colors.textMuted},
  currTextActive:{color: colors.accentStrong},
  divider:{height:1, backgroundColor: colors.border, marginVertical: spacing.md},
  modalBg:{flex:1, backgroundColor:"rgba(0,0,0,0.55)", justifyContent:"flex-end"},
  modal:{backgroundColor: colors.surface, borderTopLeftRadius:20, borderTopRightRadius:20, padding: spacing.xl, maxHeight:"88%", borderWidth:1, borderColor: colors.border},
  modalHead:{flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom: spacing.md},
  modalTitle:{...type.item, color: colors.textPrimary},
  inputLabel:{...type.caption, color: colors.textSecondary, fontWeight:"600", marginTop:10, marginBottom:4},
  input:{backgroundColor: colors.surfaceElevated, borderWidth:1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal:12, paddingVertical:10, color: colors.textPrimary, fontSize:14},
  chipRow:{flexDirection:"row", flexWrap:"wrap", gap:6},
  chip:{paddingHorizontal:10, paddingVertical:7, borderRadius: radii.pill, borderWidth:1, borderColor: colors.border, backgroundColor: colors.surfaceElevated},
  chipActive:{backgroundColor: colors.accentSoft, borderColor: colors.accentBorder},
  chipText:{fontSize:12, fontWeight:"600", color: colors.textMuted},
  chipTextActive:{color: colors.accentStrong},
});
