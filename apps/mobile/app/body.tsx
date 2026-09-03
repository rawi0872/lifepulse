/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput, RefreshControl } from "react-native";
import { Link, Stack } from "expo-router";
import { Svg, Polyline, Line, Path } from "react-native-svg";
import { colors, spacing, radii } from "../lib/theme";
import { loadBodyOverview, type BodyOverview } from "../lib/body-service";
import { formatBodyMetricValue, type BodyMetricKey } from "@lifepulse/domain";
import { supabase } from "../lib/supabase";
import { getLocalTodayDateString } from "@lifepulse/domain";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Sparkline({ points, width = 120, height = 36, color = colors.accent }: { points: Array<{ date: string; value: number }>; width?: number; height?: number; color?: string }) {
  if (points.length < 2) return <View style={{ width, height, justifyContent: "center" }}><Text style={{ fontSize: 11, color: colors.textMuted }}>—</Text></View>;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = width / Math.max(1, points.length - 1);
  const coords = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={colors.border} strokeWidth={0.7} opacity={0.6} />
      <Polyline points={coords} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BodyIcon({ size = 22, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 13a3 3 0 100-6 3 3 0 000 6Z M7 19a5 5 0 0110 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function BodyScreen() {
  const [overview, setOverview] = useState<BodyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [refreshing, setRefreshing] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalKind, setNewGoalKind] = useState<"general"|"steps_average"|"weight_target"|"sleep_duration">("general");
  const [newGoalTargetValue, setNewGoalTargetValue] = useState("");
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const load = useCallback(async (p: 7 | 30 = period) => {
    setLoading(true);
    const o = await loadBodyOverview(p);
    setOverview(o);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(period);
  }, [load, period]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(period);
    setRefreshing(false);
  };

  const createBodyGoal = async () => {
    if (!newGoalTitle.trim() || !overview?.realm) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const base: Record<string, unknown> = { user_id: user.id, realm_id: overview.realm.id, title: newGoalTitle.trim(), status: "active" };
    // quantitative mapping per 00039 contract
    if (newGoalKind !== "general") {
      const v = Number(newGoalTargetValue);
      if (!Number.isFinite(v) || v <= 0) { Alert.alert("Enter a valid target value."); return; }
      base.goal_type = newGoalKind;
      base.target_value = v;
      base.target_metric = newGoalKind === "steps_average" ? "steps" : newGoalKind === "weight_target" ? "weight" : newGoalKind === "sleep_duration" ? "sleep_duration" : null;
      base.target_unit = newGoalKind === "steps_average" ? "count" : newGoalKind === "weight_target" ? "kg" : newGoalKind === "sleep_duration" ? "hours" : null;
    }
    const { error } = await supabase.from("goals").insert(base as any);
    if (error) { Alert.alert("Could not create goal", error.message.slice(0,140)); return; }
    setNewGoalTitle(""); setNewGoalTargetValue(""); setNewGoalKind("general");
    void load(period);
  };

  const createBodyHabit = async () => {
    if (!newHabitTitle.trim() || !overview?.realm) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("habits").insert({ user_id: user.id, realm_id: overview.realm.id, title: newHabitTitle.trim(), frequency: "daily" });
    if (error) { Alert.alert("Could not create habit", error.message.slice(0,120)); return; }
    setNewHabitTitle("");
    void load(period);
  };

  const createBodyTask = async () => {
    if (!newTaskTitle.trim() || !overview?.realm) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({ user_id: user.id, realm_id: overview.realm.id, title: newTaskTitle.trim(), status: "todo", priority: "medium" });
    if (error) { Alert.alert("Could not create task", error.message.slice(0,120)); return; }
    setNewTaskTitle("");
    void load(period);
  };

  const isFreshBlank =
    !loading &&
    overview &&
    overview.today?.missingMetrics.length === 6 &&
    overview.goals.length === 0 &&
    overview.habits.length === 0 &&
    overview.tasks.length === 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Stack.Screen options={{ title: "Body", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerMark}>
          <BodyIcon size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>BODY</Text>
          <Text style={styles.headerSub}>Your physical rhythm</Text>
        </View>
        <Text style={styles.headerDate}>{getLocalTodayDateString()}</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}

      {!loading && overview && (
        <>
          {/* Hero — Today's Body */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>TODAY&apos;S BODY</Text>
            <Text style={styles.heroValue}>
              {overview.today ? `${overview.today.availableMetrics.length} metrics · ${overview.goals.length} goals active` : "—"}
            </Text>
            <Text style={styles.heroMeta}>
              {overview.today?.freshness === "empty" ? "No Body data yet" : `${overview.today?.activityLevel ?? "unknown"} · freshness ${overview.today?.freshness ?? "–"}`}
            </Text>
          </View>

          {/* Today snapshot */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TODAY</Text>
            <View style={styles.metricsGrid}>
              {(["steps","activeMinutes","exerciseMinutes","sleepDuration","restingHeartRate","weight"] as BodyMetricKey[]).map((k) => {
                const m = overview.today?.metrics[k];
                if (!m) return null;
                const isAvailable = m.quality === "available" || m.quality === "stale";
                if (!isAvailable) return (
                  <View key={k} style={[styles.metricCard, styles.metricMissing]}>
                    <Text style={styles.metricKey}>{k}</Text>
                    <Text style={styles.metricMissingText}>
                      {m.quality === "missing" ? "No data yet" : m.quality === "stale" ? "Last recorded stale" : "—"}
                    </Text>
                  </View>
                );
                const display = m.value != null ? formatBodyMetricValue(k, m.value) : "—";
                return (
                  <View key={k} style={styles.metricCard}>
                    <Text style={styles.metricKey}>{k}</Text>
                    <Text style={styles.metricValue}>{display}</Text>
                    <Text style={styles.metricMeta}>{m.quality} · {m.source}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Trends */}
          <View style={styles.section}>
            <View style={styles.trendHeader}>
              <Text style={styles.sectionTitle}>TRENDS</Text>
              <View style={styles.periodToggle}>
                <TouchableOpacity onPress={() => setPeriod(7)} style={[styles.periodBtn, period===7 && styles.periodBtnActive]}><Text style={[styles.periodText, period===7 && styles.periodTextActive]}>7D</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPeriod(30)} style={[styles.periodBtn, period===30 && styles.periodBtnActive]}><Text style={[styles.periodText, period===30 && styles.periodTextActive]}>30D</Text></TouchableOpacity>
              </View>
            </View>
            {(["steps","sleepDuration","weight","restingHeartRate"] as BodyMetricKey[]).map((k) => {
              const t = overview.trends[k];
              if (!t || !t.isSufficient) {
                const pts = t?.dataPoints ?? 0;
                const need = t?.requiredPoints ?? Math.ceil(period*0.5);
                return (
                  <View key={k} style={styles.trendCard}>
                    <Text style={styles.trendKey}>{k}</Text>
                    <Text style={styles.trendEmpty}>{pts===0 ? "No data yet" : `${pts} of ${need} days recorded — not enough for trend`}</Text>
                    <Text style={styles.trendHint}>Connect health data to see this trend.</Text>
                  </View>
                );
              }
              const dir = t.direction === "up" ? "↑" : t.direction === "down" ? "↓" : "→";
              const pct = t.changePct != null ? `${dir} ${Math.abs(t.changePct).toFixed(1)}%` : "→ flat";
              return (
                <View key={k} style={styles.trendCard}>
                  <View style={styles.trendTop}>
                    <Text style={styles.trendKey}>{k}</Text>
                    <Text style={[styles.trendDir, t.direction==="up" ? styles.up : t.direction==="down" ? styles.down : styles.flat]}>{pct}</Text>
                  </View>
                  <Text style={styles.trendAvg}>{t.currentAvg != null ? `${Math.round(t.currentAvg).toLocaleString()} avg` : "—"} · {t.dataPoints} days</Text>
                  <Text style={styles.trendMeta}>vs previous {period}d {t.previousAvg != null ? Math.round(t.previousAvg).toLocaleString() : "—"}</Text>
                </View>
              );
            })}
          </View>

          {/* Goals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BODY GOALS {overview.goals.length ? `· ${overview.goals.length}` : ""}</Text>
            {overview.goals.length === 0 ? (
              <Text style={styles.emptyText}>No Body goals yet. Create one to track progress.</Text>
            ) : overview.goals.map((g) => (
              <View key={g.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{g.title}</Text>
                <Text style={styles.rowMeta}>{g.status} {g.target_date ? `· target ${g.target_date}` : ""}</Text>
                <Text style={styles.rowHint}>Quantitative progress (target metric/value) not yet persisted — schema reserves for later.</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
              {(["general","steps_average","weight_target","sleep_duration"] as const).map((k) => (
                <TouchableOpacity key={k} onPress={() => setNewGoalKind(k)} style={[styles.chip, newGoalKind===k && styles.chipActive]}>
                  <Text style={[styles.chipText, newGoalKind===k && styles.chipTextActive]}>{k.replace("_"," ")}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {newGoalKind!=="general" && (
              <TextInput value={newGoalTargetValue} onChangeText={setNewGoalTargetValue} placeholder={newGoalKind==="weight_target" ? "Target kg" : newGoalKind==="steps_average" ? "Steps/day" : "Hours"} placeholderTextColor={colors.textMuted} style={[styles.inlineInput, { marginBottom: 6 }]} keyboardType="numeric" maxLength={10} />
            )}
            <View style={styles.inlineAdd}>
              <TextInput value={newGoalTitle} onChangeText={setNewGoalTitle} placeholder="Add a Body goal…" placeholderTextColor={colors.textMuted} style={styles.inlineInput} maxLength={80} />
              <TouchableOpacity onPress={createBodyGoal} disabled={!newGoalTitle.trim()} style={[styles.inlineBtn, !newGoalTitle.trim() && styles.inlineBtnDisabled]}><Text style={styles.inlineBtnText}>Add</Text></TouchableOpacity>
            </View>
          </View>

          {/* Habits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BODY HABITS {overview.habits.length ? `· ${overview.habits.length}` : ""}</Text>
            {overview.habits.length === 0 ? (
              <Text style={styles.emptyText}>No Body habits yet.</Text>
            ) : overview.habits.map((h) => {
              const doneToday = overview.habitLogs.some((l) => l.habit_id === h.id);
              return (
                <View key={h.id} style={styles.rowCard}>
                  <Text style={styles.rowTitle}>{h.title}</Text>
                  <Text style={styles.rowMeta}>{h.frequency} · {doneToday ? "done today" : "due"}</Text>
                </View>
              );
            })}
            <View style={styles.inlineAdd}>
              <TextInput value={newHabitTitle} onChangeText={setNewHabitTitle} placeholder="Add a Body habit…" placeholderTextColor={colors.textMuted} style={styles.inlineInput} maxLength={80} />
              <TouchableOpacity onPress={createBodyHabit} disabled={!newHabitTitle.trim()} style={[styles.inlineBtn, !newHabitTitle.trim() && styles.inlineBtnDisabled]}><Text style={styles.inlineBtnText}>Add</Text></TouchableOpacity>
            </View>
          </View>

          {/* Tasks */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BODY TASKS {overview.tasks.length ? `· ${overview.tasks.length}` : ""}</Text>
            {overview.tasks.length === 0 ? <Text style={styles.emptyText}>No Body tasks.</Text> : overview.tasks.map((t) => (
              <View key={t.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{t.title}</Text>
                <Text style={styles.rowMeta}>{t.status} {t.due_date ? `· ${t.due_date}` : ""}</Text>
              </View>
            ))}
            <View style={styles.inlineAdd}>
              <TextInput value={newTaskTitle} onChangeText={setNewTaskTitle} placeholder="Add a Body task…" placeholderTextColor={colors.textMuted} style={styles.inlineInput} maxLength={80} />
              <TouchableOpacity onPress={createBodyTask} disabled={!newTaskTitle.trim()} style={[styles.inlineBtn, !newTaskTitle.trim() && styles.inlineBtnDisabled]}><Text style={styles.inlineBtnText}>Add</Text></TouchableOpacity>
            </View>
          </View>

          {/* Health status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HEALTH DATA</Text>
            <View style={styles.healthCard}>
              <Text style={styles.healthTitle}>{overview.healthStatus.hasSteps ? "Connected · Steps syncing" : "Not connected"}</Text>
              <Text style={styles.healthMeta}>Allowed: {overview.healthStatus.allowed.join(", ") || "none"} · source {overview.healthStatus.source ?? "—"}</Text>
              <Link href="/health" asChild><TouchableOpacity style={styles.healthLink}><Text style={styles.healthLinkText}>Health Connections</Text></TouchableOpacity></Link>
            </View>
          </View>

          {/* Fresh blank state */}
          {isFreshBlank && (
            <View style={styles.emptyHero}>
              <Text style={styles.emptyTitle}>Build your physical baseline</Text>
              <Text style={styles.emptyText}>Start with one of:</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity onPress={() => setNewGoalTitle("Improve fitness")} style={styles.emptyBtn}><Text style={styles.emptyBtnText}>Add a Body goal</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setNewHabitTitle("Morning walk")} style={styles.emptyBtn}><Text style={styles.emptyBtnText}>Add a Body habit</Text></TouchableOpacity>
                <Link href="/health" asChild><TouchableOpacity style={styles.emptyBtn}><Text style={styles.emptyBtnText}>Connect health data</Text></TouchableOpacity></Link>
              </View>
            </View>
          )}

          <Link href="/(tabs)/today" asChild><TouchableOpacity style={styles.back}><Text style={styles.backText}>Back to Today</Text></TouchableOpacity></Link>
        </>
      )}

      {!loading && !overview ? <Text style={styles.emptyText}>Sign in to view Body.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  headerMark: { width: 32, height: 32, borderRadius: radii.md, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accentBorder },
  headerTitle: { fontSize: 13, fontWeight: "700", color: colors.accent, letterSpacing: 1.2 },
  headerDate: { fontSize: 11, color: colors.textMuted, marginLeft: "auto" },
  headerSub: { fontSize: 11, color: colors.textMuted },
  hero: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg },
  heroLabel: { fontSize: 11, fontWeight: "700", color: colors.accent, letterSpacing: 1.2 },
  heroValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: 6 },
  heroMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.1, textTransform: "uppercase" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 10 },
  metricCard: { width: "48%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10 },
  metricMissing: { backgroundColor: colors.surface, borderStyle: "dashed" },
  metricKey: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  metricValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
  metricMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  metricMissingText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  trendHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  periodToggle: { flexDirection: "row", gap: 6 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  periodBtnActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  periodText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  periodTextActive: { color: colors.accentStrong },
  trendCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10, marginTop: 8 },
  trendKey: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  trendTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trendDir: { fontSize: 12, fontWeight: "700" },
  up: { color: colors.success }, down: { color: colors.danger }, flat: { color: colors.textMuted },
  trendAvg: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginTop: 4 },
  trendMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  trendEmpty: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  trendHint: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  rowCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10, marginTop: 8 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  rowMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  rowHint: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  chipText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: colors.accentStrong },
  inlineAdd: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  inlineInput: { flex: 1, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8, color: colors.textPrimary, fontSize: 13 },
  inlineBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  inlineBtnDisabled: { opacity: 0.45 },
  inlineBtnText: { color: colors.onAccent, fontSize: 12, fontWeight: "700" },
  healthCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12, marginTop: 8 },
  healthTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  healthMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  healthLink: { marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder },
  healthLinkText: { fontSize: 11, fontWeight: "600", color: colors.accentStrong },
  emptyHero: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 16, marginTop: 16, alignItems: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" },
  emptyBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  emptyBtnText: { fontSize: 12, fontWeight: "600", color: colors.accentStrong },
  back: { marginTop: 16, alignItems: "center" },
  backText: { color: colors.accent, fontSize: 13 },
});
