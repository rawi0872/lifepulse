import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Link, Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { spacing, radii, type } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { useLifePulseTheme } from "../../lib/theme-provider";
import {
  MAX_WEEKLY_OUTCOMES,
  getCurrentPlanWeekRange,
  getLocalTodayDateString,
  nextOutcomePosition,
  orderOutcomes,
  summarizePlanEvidence,
  type WeeklyOutcome,
  type WeeklyPlanSnapshot,
} from "@lifepulse/domain";
import type { PlanOption } from "../../lib/plan-service";
import {
  addPlanLink,
  addWeeklyOutcome,
  createWeeklyPlan,
  deleteWeeklyOutcome,
  loadPlanLinkOptions,
  loadWeeklyPlan,
  removePlanLink,
  setMustWin,
  updatePlanIntention,
  updateWeeklyOutcome,
} from "../../lib/plan-service";
import { PlanIcon, ChevronRight, Plus, Check } from "../../src/icons";

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

export default function PlanScreen() {
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<WeeklyPlanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [options, setOptions] = useState<{ goals: PlanOption[]; projects: PlanOption[]; tasks: PlanOption[]; habits: PlanOption[] } | null>(null);
  const [evidence, setEvidence] = useState<{ tasks: { id: string; status: string }[]; habitLogs: { habit_id: string; completed_date: string }[] }>({ tasks: [], habitLogs: [] });
  const [outcomeInput, setOutcomeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingIntention, setEditingIntention] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState("");
  const [expandedOutcomeId, setExpandedOutcomeId] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const mountedRef = useRef(true);

  const week = useMemo(() => getCurrentPlanWeekRange(getLocalTodayDateString()), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    const loaded = await loadWeeklyPlan(supabase, user.id, week.weekStart);
    if (!mountedRef.current) return;
    setSnapshot(loaded);
    if (loaded) {
      const [opts, tasksRes, logsRes] = await Promise.all([
        loadPlanLinkOptions(supabase, user.id),
        supabase.from("tasks").select("id, status").eq("user_id", user.id).in("id", loaded.links.filter((l) => l.linked_type === "task").map((l) => l.linked_id)),
        supabase.from("habit_logs").select("habit_id, completed_date").eq("user_id", user.id).gte("completed_date", week.weekStart).lte("completed_date", week.weekEnd),
      ]);
      if (!mountedRef.current) return;
      setOptions(opts);
      setEvidence({
        tasks: ((tasksRes.data ?? []) as { id: string; status: string }[]),
        habitLogs: ((logsRes.data ?? []) as { habit_id: string; completed_date: string }[]),
      });
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, week.weekStart, week.weekEnd]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const outcomes = useMemo(() => (snapshot ? orderOutcomes(snapshot.outcomes) : []), [snapshot]);
  const mustWin = outcomes.find((o) => o.must_win) ?? null;
  const planEvidence = useMemo(
    () => (snapshot ? summarizePlanEvidence(snapshot, evidence.tasks, evidence.habitLogs) : null),
    [snapshot, evidence],
  );
  const canAddMore = snapshot !== null && nextOutcomePosition(outcomes) !== null;
  const linkedTaskIds = useMemo(() => new Set(snapshot?.links.filter((l) => l.linked_type === "task").map((l) => l.linked_id) ?? []), [snapshot]);
  const linkedHabitIds = useMemo(() => new Set(snapshot?.links.filter((l) => l.linked_type === "habit").map((l) => l.linked_id) ?? []), [snapshot]);

  async function handleStartPlan() {
    if (!user || saving) return;
    setSaving(true);
    await createWeeklyPlan(supabase, user.id, week.weekStart);
    await load();
    setSaving(false);
  }

  async function handleAddOutcome() {
    if (!snapshot || !outcomeInput.trim() || saving) return;
    setSaving(true);
    const created = await addWeeklyOutcome(supabase, snapshot, outcomeInput.trim());
    if (created && mountedRef.current) setOutcomeInput("");
    await load();
    setSaving(false);
  }

  async function toggleDone(outcome: WeeklyOutcome) {
    if (!user) return;
    await updateWeeklyOutcome(supabase, user.id, outcome, { done: !outcome.done });
    await load();
  }

  async function toggleMustWin(outcome: WeeklyOutcome) {
    if (!snapshot || !user) return;
    await setMustWin(supabase, user.id, snapshot.plan.id, outcome.must_win ? null : outcome.id, snapshot.outcomes);
    await load();
  }

  async function removeOutcome(outcome: WeeklyOutcome) {
    if (!user) return;
    await deleteWeeklyOutcome(supabase, user.id, outcome.id);
    await load();
  }

  async function cycleGoalLink(outcome: WeeklyOutcome) {
    if (!user || !options) return;
    const ids = [null, ...options.goals.map((g) => g.id)];
    const current = outcome.goal_id;
    const next = ids[(ids.indexOf(current) + 1) % ids.length] ?? null;
    await updateWeeklyOutcome(supabase, user.id, outcome, { goal_id: next });
    await load();
  }

  async function cycleProjectLink(outcome: WeeklyOutcome) {
    if (!user || !options) return;
    const ids = [null, ...options.projects.map((p) => p.id)];
    const current = outcome.project_id;
    const next = ids[(ids.indexOf(current) + 1) % ids.length] ?? null;
    await updateWeeklyOutcome(supabase, user.id, outcome, { project_id: next });
    await load();
  }

  async function toggleLink(type: "task" | "habit", id: string) {
    if (!snapshot || !user) return;
    const existing = snapshot.links.find((l) => l.linked_type === type && l.linked_id === id);
    if (existing) {
      await removePlanLink(supabase, user.id, existing.id);
    } else {
      await addPlanLink(supabase, user.id, snapshot.plan.id, type, id);
    }
    await load();
  }

  async function saveIntention() {
    if (!snapshot || !user) return;
    await updatePlanIntention(supabase, user.id, snapshot.plan.id, intentionDraft);
    setEditingIntention(false);
    await load();
  }

  const goalTitle = (id: string | null) => options?.goals.find((g) => g.id === id)?.title ?? "Link goal";
  const projectTitle = (id: string | null) => options?.projects.find((p) => p.id === id)?.title ?? "Link project";

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Stack.Screen options={{ title: "Plan", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.accent} />}
      >
        <Text style={styles.eyebrow}>PLAN</Text>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.sub}>{formatWeekRange(week.weekStart, week.weekEnd)}</Text>

        {loading && (
          <Text style={styles.loading}>Loading your plan...</Text>
        )}

        {!loading && loadError && !snapshot && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Couldn&apos;t load your plan.</Text>
            <TouchableOpacity style={styles.retry} onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Retry loading plan">
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !snapshot && !loadError && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEyebrow}>WEEKLY PLAN</Text>
            <Text style={styles.emptyTitle}>Plan your week</Text>
            <Text style={styles.emptyDesc}>Decide what would make this week count. You can start with just one outcome.</Text>
            <TouchableOpacity style={styles.primary} onPress={() => void handleStartPlan()} disabled={saving} accessibilityRole="button" accessibilityLabel="Plan this week">
              <Text style={styles.primaryText}>{saving ? "Starting..." : "Plan this week"}</Text>
            </TouchableOpacity>
            <View style={styles.examples}>
              {["Finish SAT geometry review", "Publish first outreach", "Complete 3 gym sessions"].map((example) => (
                <Text key={example} style={styles.example}>{example}</Text>
              ))}
            </View>
          </View>
        )}

        {snapshot && (
          <View>
            <TouchableOpacity
              style={styles.intentionBox}
              onPress={() => { setIntentionDraft(snapshot.plan.intention ?? ""); setEditingIntention(true); }}
              accessibilityRole="button"
              accessibilityLabel="Edit weekly intention"
            >
              <Text style={styles.sectionEyebrow}>WEEKLY INTENTION</Text>
              <Text style={snapshot.plan.intention ? styles.intention : styles.intentionPlaceholder}>
                {snapshot.plan.intention || "Add an intention for the week (optional)"}
              </Text>
            </TouchableOpacity>
            {editingIntention && (
              <View style={styles.intentionEditor}>
                <TextInput
                  style={styles.input}
                  value={intentionDraft}
                  onChangeText={(t) => setIntentionDraft(t.slice(0, 120))}
                  placeholder="One line for the week (optional)"
                  placeholderTextColor={colors.textMuted}
                  maxLength={120}
                  returnKeyType="done"
                  onSubmitEditing={() => void saveIntention()}
                />
                <View style={styles.intentionActions}>
                  <TouchableOpacity style={styles.primarySmall} onPress={() => void saveIntention()} accessibilityRole="button" accessibilityLabel="Save intention">
                    <Text style={styles.primaryTextSmall}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostSmall} onPress={() => setEditingIntention(false)} accessibilityRole="button" accessibilityLabel="Cancel editing intention">
                    <Text style={styles.ghostTextSmall}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {mustWin && (
              <View style={styles.mustWinBox}>
                <Text style={[styles.sectionEyebrow, { color: colors.accent }]}>MUST WIN</Text>
                <Text style={styles.mustWinText}>{mustWin.text}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>WEEKLY OUTCOMES · {outcomes.length}/{MAX_WEEKLY_OUTCOMES}</Text>
            {outcomes.map((outcome, index) => {
              const expanded = expandedOutcomeId === outcome.id;
              return (
                <View key={outcome.id} style={styles.card}>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[styles.check, outcome.done && styles.checkDone]}
                      onPress={() => void toggleDone(outcome)}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark outcome ${index + 1} done`}
                    >
                      {outcome.done && <Check size={12} color={colors.onAccent} />}
                    </TouchableOpacity>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, outcome.done && styles.rowTitleDone]}>
                        <Text style={styles.rowIndex}>{index + 1}. </Text>{outcome.text}
                      </Text>
                      {(goalTitle(outcome.goal_id) !== "Link goal" || projectTitle(outcome.project_id) !== "Link project") && (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {[outcome.goal_id ? goalTitle(outcome.goal_id) : null, outcome.project_id ? projectTitle(outcome.project_id) : null].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.chip, outcome.must_win && styles.chipActive]}
                      onPress={() => void toggleMustWin(outcome)}
                      accessibilityRole="button"
                      accessibilityLabel={outcome.must_win ? "Clear Must Win" : "Make Must Win"}
                    >
                      <Text style={[styles.chipText, outcome.must_win && styles.chipTextActive]}>{outcome.must_win ? "★ Must Win" : "Must Win"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chip}
                      onPress={() => setExpandedOutcomeId(expanded ? null : outcome.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle goal and project links"
                    >
                      <Text style={styles.chipText}>Goal / Project</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chipDanger}
                      onPress={() => void removeOutcome(outcome)}
                      accessibilityRole="button"
                      accessibilityLabel="Remove outcome"
                    >
                      <Text style={styles.chipDangerText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  {expanded && (
                    <View style={styles.linkBox}>
                      <TouchableOpacity style={styles.linkRow} onPress={() => void cycleGoalLink(outcome)} accessibilityRole="button" accessibilityLabel="Cycle goal link">
                        <Text style={styles.linkLabel}>GOAL</Text>
                        <Text style={styles.linkValue} numberOfLines={1}>{goalTitle(outcome.goal_id)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.linkRow} onPress={() => void cycleProjectLink(outcome)} accessibilityRole="button" accessibilityLabel="Cycle project link">
                        <Text style={styles.linkLabel}>PROJECT</Text>
                        <Text style={styles.linkValue} numberOfLines={1}>{projectTitle(outcome.project_id)}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
            {canAddMore ? (
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, styles.addInput]}
                  value={outcomeInput}
                  onChangeText={(t) => setOutcomeInput(t.slice(0, 120))}
                  placeholder={outcomes.length === 0 ? "What would make this week a win?" : "Add another outcome (optional)"}
                  placeholderTextColor={colors.textMuted}
                  maxLength={120}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleAddOutcome()}
                />
                <TouchableOpacity style={[styles.primarySmall, (!outcomeInput.trim() || saving) && styles.disabled]} onPress={() => void handleAddOutcome()} disabled={!outcomeInput.trim() || saving} accessibilityRole="button" accessibilityLabel="Add outcome">
                  <Text style={styles.primaryTextSmall}>Add</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.hint}>Three outcomes is the weekly maximum — depth beats breadth.</Text>
            )}

            <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowSupport(!showSupport)} accessibilityRole="button" accessibilityLabel="Toggle supporting tasks and habits">
              <Text style={styles.sectionLabel}>SUPPORTING</Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {planEvidence && (
              <Text style={styles.evidence}>
                {planEvidence.linkedTasksDone} of {planEvidence.linkedTasksTotal} linked tasks done
                {planEvidence.supportingHabitLogDays > 0 ? ` · habits logged ${planEvidence.supportingHabitLogDays} day${planEvidence.supportingHabitLogDays === 1 ? "" : "s"} this week` : ""}
              </Text>
            )}
            {showSupport && (
              <View>
                <Text style={styles.listLabel}>TASKS</Text>
                {(options?.tasks ?? []).map((task) => {
                  const linked = linkedTaskIds.has(task.id);
                  return (
                    <TouchableOpacity key={task.id} style={[styles.toggleRow, linked && styles.toggleRowActive]} onPress={() => void toggleLink("task", task.id)} accessibilityRole="button" accessibilityLabel={`Link task ${task.title}`}>
                      <View style={[styles.miniCheck, linked && styles.miniCheckActive]}>
                        {linked && <Check size={10} color={colors.onAccent} />}
                      </View>
                      <Text style={styles.toggleText} numberOfLines={1}>{task.title}</Text>
                    </TouchableOpacity>
                  );
                })}
                {(options?.tasks ?? []).length === 0 && <Text style={styles.hint}>No open tasks.</Text>}
                <Text style={styles.listLabel}>HABITS</Text>
                {(options?.habits ?? []).map((habit) => {
                  const linked = linkedHabitIds.has(habit.id);
                  return (
                    <TouchableOpacity key={habit.id} style={[styles.toggleRow, linked && styles.toggleRowActive]} onPress={() => void toggleLink("habit", habit.id)} accessibilityRole="button" accessibilityLabel={`Link habit ${habit.title}`}>
                      <View style={[styles.miniCheck, linked && styles.miniCheckActive]}>
                        {linked && <Check size={10} color={colors.onAccent} />}
                      </View>
                      <Text style={styles.toggleText} numberOfLines={1}>{habit.title}</Text>
                    </TouchableOpacity>
                  );
                })}
                {(options?.habits ?? []).length === 0 && <Text style={styles.hint}>No habits yet.</Text>}
              </View>
            )}

            <Link href="/(tabs)/today" asChild>
              <TouchableOpacity style={styles.nextCard} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Prepare today">
                <View style={styles.nextBody}>
                  <Text style={styles.nextEyebrow}>NEXT</Text>
                  <Text style={styles.nextText}>Carry this week into today.</Text>
                </View>
                <Text style={styles.nextCta}>Prepare today</Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}

        <Link href="/(tabs)/today" asChild>
          <TouchableOpacity style={styles.back} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Back to Today">
            <Text style={styles.backText}>Back to Today</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    eyebrow: { ...type.caption, color: colors.textMuted, letterSpacing: 1.6, fontWeight: "700" },
    title: { ...type.screen, color: colors.textPrimary, marginTop: spacing.sm },
    sub: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
    loading: { ...type.body, color: colors.textMuted, marginTop: spacing.xl, textAlign: "center" },
    errorBox: { marginTop: spacing.xl, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radii.lg, padding: spacing.lg },
    errorText: { ...type.body, color: colors.danger },
    retry: { marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: "center" },
    retryText: { color: colors.onAccent, fontWeight: "700" },
    emptyBox: { marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg, alignItems: "center" },
    emptyEyebrow: { ...type.caption, color: colors.accent, fontWeight: "700", letterSpacing: 1.6 },
    emptyTitle: { ...type.screen, color: colors.textPrimary, marginTop: spacing.sm },
    emptyDesc: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center" },
    primary: { marginTop: spacing.lg, backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.xl, minHeight: 48, justifyContent: "center" },
    primaryText: { color: colors.onAccent, fontWeight: "700", fontSize: 15 },
    examples: { marginTop: spacing.lg, gap: spacing.sm, width: "100%" },
    example: { ...type.meta, color: colors.textSecondary, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
    intentionBox: { marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg },
    sectionEyebrow: { ...type.caption, color: colors.textMuted, fontWeight: "700", letterSpacing: 1.6 },
    intention: { ...type.item, fontSize: 17, color: colors.textPrimary, marginTop: spacing.sm },
    intentionPlaceholder: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
    intentionEditor: { marginTop: spacing.md, gap: spacing.sm },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 12, minHeight: 48, color: colors.textPrimary, fontSize: 15 },
    intentionActions: { flexDirection: "row", gap: spacing.sm },
    primarySmall: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: "center" },
    primaryTextSmall: { color: colors.onAccent, fontWeight: "700", fontSize: 14 },
    ghostSmall: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: "center" },
    ghostTextSmall: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
    disabled: { opacity: 0.5 },
    mustWinBox: { marginTop: spacing.lg, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radii.lg, padding: spacing.lg },
    mustWinText: { fontSize: 19, lineHeight: 24, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.sm },
    sectionLabel: { ...type.caption, color: colors.accent, fontWeight: "700", letterSpacing: 1.4, marginTop: spacing.xl },
    card: { marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg },
    row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center", marginTop: 2 },
    checkDone: { backgroundColor: colors.success, borderColor: colors.success },
    rowBody: { flex: 1 },
    rowTitle: { ...type.item, color: colors.textPrimary },
    rowTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
    rowIndex: { ...type.meta, color: colors.textMuted },
    rowMeta: { ...type.meta, color: colors.textSecondary, marginTop: 4 },
    cardActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 10, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: "center" },
    chipActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
    chipText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
    chipTextActive: { color: colors.accentStrong },
    chipDanger: { borderRadius: radii.md, paddingVertical: 10, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: "center" },
    chipDangerText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
    linkBox: { marginTop: spacing.md, gap: spacing.sm },
    linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, minHeight: 48 },
    linkLabel: { ...type.caption, color: colors.textMuted, fontWeight: "700", letterSpacing: 1 },
    linkValue: { ...type.body, color: colors.textPrimary, flex: 1 },
    addRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    addInput: { flex: 1 },
    hint: { ...type.meta, color: colors.textMuted, marginTop: spacing.md },
    sectionToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, minHeight: 44 },
    evidence: { ...type.meta, color: colors.textSecondary, marginTop: spacing.sm },
    listLabel: { ...type.caption, color: colors.textSecondary, fontWeight: "700", letterSpacing: 1, marginTop: spacing.md },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.md, marginTop: spacing.sm, minHeight: 48 },
    toggleRowActive: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
    miniCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
    miniCheckActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    toggleText: { ...type.body, color: colors.textPrimary, flex: 1 },
    nextCard: { marginTop: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg },
    nextBody: { flex: 1 },
    nextEyebrow: { ...type.caption, color: colors.accent, fontWeight: "700", letterSpacing: 1.6 },
    nextText: { ...type.body, color: colors.textSecondary, marginTop: 4 },
    nextCta: { color: colors.onAccent, backgroundColor: colors.accent, fontWeight: "700", fontSize: 14, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.lg, overflow: "hidden" },
    back: { marginTop: spacing.lg, alignItems: "center", minHeight: 44, justifyContent: "center" },
    backText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  });
}
