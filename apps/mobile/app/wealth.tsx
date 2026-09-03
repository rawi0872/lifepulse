import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { Stack, Link } from "expo-router";
import { colors, spacing, radii } from "../lib/theme";
import { loadWealthOverview } from "../lib/wealth-service";
import { formatWealth } from "@lifepulse/domain";

export default function WealthScreen() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadWealthOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let a=true; void loadWealthOverview().then(d=>{ if(a){setData(d); setLoading(false);}}); return ()=>{a=false;}; }, []);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title:"Wealth", headerStyle:{backgroundColor:colors.bg}, headerTintColor:colors.textPrimary }} />
      <Text style={styles.title}>Wealth</Text>
      <Text style={styles.sub}>Financial awareness — accounts, net worth, cash flow, goals. Source: finance_accounts starting_balance (manual-first, no auto-drift).</Text>
      {loading ? <ActivityIndicator color={colors.accent} style={{marginTop:16}}/> : null}
      {!loading && data && (
        <>
          <View style={styles.card}><Text style={styles.cardTitle}>Net worth</Text>{data.balance.length===0 ? <Text style={styles.note}>No accounts yet.</Text> : data.balance.map(b=> <Text key={b.currencyCode} style={styles.value}>{formatWealth(b.netWorth, b.currencyCode)} · {b.assetAccountCount} assets {b.liabilityAccountCount} liabilities</Text>)}</View>
          <View style={styles.card}><Text style={styles.cardTitle}>Cash flow (month)</Text>{!data.cashFlow ? <Text style={styles.note}>No transactions.</Text> : <Text style={styles.value}>{formatWealth(data.cashFlow.netCashFlow, data.cashFlow.currencyCode)} net · income {formatWealth(data.cashFlow.income, data.cashFlow.currencyCode)}</Text>}</View>
          <View style={styles.card}><Text style={styles.cardTitle}>Upcoming (7d)</Text>{data.upcoming7.length===0 ? <Text style={styles.note}>Nothing due in 7 days.</Text> : data.upcoming7.map(u=> <Text key={u.id} style={styles.row}>{u.name} · {formatWealth(u.amount, u.currency)} · {u.dueDate}</Text>)}</View>
          <View style={styles.card}><Text style={styles.cardTitle}>Goals</Text>{data.goals.length===0 ? <Text style={styles.note}>No Wealth goals yet.</Text> : data.goals.map((g:any)=><Text key={g.id} style={styles.row}>{g.title} · {g.goal_type ?? g.target_metric ?? ""}</Text>)}</View>
          <Link href="/realms" style={styles.link}>Back to Realms</Link>
        </>
      )}
      {!loading && !data ? <Text style={styles.note}>Sign in to view Wealth.</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg}, content:{padding:spacing.xl,paddingTop:56,paddingBottom:24},
  title:{fontSize:26,fontWeight:"700",color:colors.textPrimary}, sub:{fontSize:13,color:colors.textSecondary,marginTop:6,lineHeight:18},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radii.lg,padding:spacing.lg,marginTop:spacing.lg},
  cardTitle:{fontSize:13,fontWeight:"600",color:colors.accent,textTransform:"uppercase",letterSpacing:0.5},
  value:{fontSize:14,fontWeight:"700",color:colors.textPrimary,marginTop:6}, note:{fontSize:12,color:colors.textSecondary,marginTop:6,lineHeight:16}, row:{fontSize:13,color:colors.textPrimary,marginTop:6},
  link:{color:colors.accent,fontSize:13,textAlign:"center",marginTop:16},
});
