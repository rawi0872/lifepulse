import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert, TextInput } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors, spacing, radii, type, shadow } from "../../lib/theme";
import { Pulse, ChecklistIcon, Habits as HabitsIcon, Check, Close, ChevronRight } from "../../src/icons";
import { BODY_TODAY_SIGNALS_ENABLED } from "../../lib/featureFlags";
import {
  normalizeTodayData,
  selectMorningPlanFirstAction,
  getLocalTodayDateString,
  getWeekStartForDate,
  resolveIntendedUse,
  getCurrentStreak,
  toLocalPriority,
  MAX_PRIORITIES_PER_DAY,
  deriveBodySignals,
} from "@lifepulse/domain";
import type {
  TodayModel,
  TodayDataSnapshot,
  TodayDateContext,
  TodayHabit,
  TodayTask,
  TodayPriority,
  TodayPriorityInput,
} from "@lifepulse/domain";

export default function TodayScreen() {
  const { user } = useAuth();
  const [model, setModel] = useState<TodayModel | null>(null);
  const [priorities, setPriorities] = useState<TodayPriority[]>([]);
  const [priorityInput, setPriorityInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const buildDateContext = useCallback((): TodayDateContext => {
    const localDate = getLocalTodayDateString();
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    const weekStart = getWeekStartForDate(localDate);
    return {
      localDate,
      displayDate: new Date(`${localDate}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      dayStart,
      dayEnd,
      dayOfWeek: now.getDay(),
      weekStart,
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;

    const date = buildDateContext();

    const [profileRes, habitsRes, tasksRes, weekLogsRes] = await Promise.all([
      supabase.from("profiles").select("intended_use").eq("user_id", user.id).single(),
      supabase
        .from("habits")
        .select("id, title, description, frequency, days_of_week, times_per_week")
        .eq("user_id", user.id),
      supabase
        .from("tasks")
        .select("id, title, description, priority, due_date, status, completed_at, project_id")
        .eq("user_id", user.id)
        .or(`and(due_date.eq.${date.localDate},status.eq.todo),and(due_date.lt.${date.localDate},status.eq.todo),and(due_date.is.null,status.eq.todo),and(status.eq.done,completed_at.gte.${date.dayStart},completed_at.lte.${date.dayEnd})`)
        .order("due_date", { ascending: true }),
      supabase
        .from("habit_logs")
        .select("habit_id, completed_date")
        .eq("user_id", user.id)
        .gte("completed_date", date.weekStart),
    ]);

    if (!mountedRef.current) return;

    const snapshot: TodayDataSnapshot = {
      habits: (habitsRes.data ?? []) as TodayHabit[],
      tasks: (tasksRes.data ?? []) as TodayTask[],
      weekLogs: (weekLogsRes.data ?? []) as TodayDataSnapshot["weekLogs"],
      todayEntry: null,
      projectTasks: [],
      taskProjects: [],
      taskGoalLinks: [],
      linkedGoals: [],
      goalPreviewMilestones: [],
      goalPreviewLinks: [],
      todayXp: 0,
      totalXp: 0,
      intendedUse: resolveIntendedUse(profileRes.data?.intended_use),
    };

    const todayModel = normalizeTodayData(snapshot, date);
    setModel(todayModel);

    const { data: priorityData } = await supabase
      .from("today_priorities")
      .select("*")
      .eq("user_id", user.id)
      .eq("local_date", date.localDate)
      .order("position", { ascending: true })
      .limit(MAX_PRIORITIES_PER_DAY);

    if (mountedRef.current) {
      setPriorities((priorityData ?? []) as TodayPriority[]);
    }

    setLoading(false);
  }, [user, buildDateContext]);

  useEffect(() => {
    mountedRef.current = true;
    void loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const completeTask = async (taskId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .eq("status", "todo");
    if (error) {
      Alert.alert("Error", "Could not complete task.");
      return;
    }
    void loadData();
  };

  const completeHabit = async (habitId: string) => {
    if (!user) return;
    const today = getLocalTodayDateString();
    const { data: existing } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", habitId)
      .eq("completed_date", today)
      .maybeSingle();
    if (existing) return;
    const { error } = await supabase.from("habit_logs").insert({
      user_id: user.id,
      habit_id: habitId,
      completed_date: today,
    });
    if (error) {
      Alert.alert("Error", "Could not log habit.");
      return;
    }
    void loadData();
  };

  const addPriority = async () => {
    if (!user || !priorityInput.trim() || priorities.length >= MAX_PRIORITIES_PER_DAY) return;
    const today = getLocalTodayDateString();
    const input: TodayPriorityInput = { text: priorityInput.trim() };
    const { data, error } = await supabase
      .from("today_priorities")
      .insert({
        user_id: user.id,
        local_date: today,
        position: priorities.length + 1,
        text: input.text,
        task_id: input.task_id ?? null,
        done: input.done ?? false,
      })
      .select("*")
      .single();
    if (error) {
      Alert.alert("Error", "Could not add priority.");
      return;
    }
    setPriorities([...priorities, data as TodayPriority]);
    setPriorityInput("");
  };

  const togglePriority = async (id: string) => {
    if (!user) return;
    const priority = priorities.find((p) => p.id === id);
    if (!priority) return;
    setPriorities(priorities.map((p) => (p.id === id ? { ...p, done: !p.done } : p)));
    const { error } = await supabase
      .from("today_priorities")
      .update({ done: !priority.done })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      setPriorities(priorities.map((p) => (p.id === id ? { ...p, done: priority.done } : p)));
      Alert.alert("Error", "Could not update priority.");
    }
  };

  const removePriority = async (id: string) => {
    if (!user) return;
    const removed = priorities.find((p) => p.id === id);
    setPriorities(priorities.filter((p) => p.id !== id));
    const { error } = await supabase
      .from("today_priorities")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      if (removed) setPriorities([...priorities, removed]);
      Alert.alert("Error", "Could not remove priority.");
    }
  };

  const upNext = model ? selectMorningPlanFirstAction(model, priorities.map(toLocalPriority)) : null;
  // Body Today signals — deterministic, bounded, feature-flagged (OFF until Body 5)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _bodySignals = BODY_TODAY_SIGNALS_ENABLED
    ? deriveBodySignals({ dueBodyHabits: [], goalProgress: [], todaySteps: null, sleepMinutes: null })
    : [];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const focusRemaining = MAX_PRIORITIES_PER_DAY - priorities.length;
  const donePriorities = priorities.filter((p) => p.done).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header — compact */}
      <View style={styles.header}>
        <Link href="/realms" asChild>
          <TouchableOpacity style={styles.brandRow} activeOpacity={0.7}>
            <View style={styles.brandMark}>
              <Pulse size={18} color={colors.accentStrong} />
            </View>
            <Text style={styles.brandName}>LIFE PULSE</Text>
          </TouchableOpacity>
        </Link>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.date}>{model?.date.displayDate ?? "Today"}</Text>
      </View>

      {/* Up Next — dense hero */}
      <View style={styles.upNextSection}>
        <Text style={styles.sectionLabelTextAlt}>UP NEXT</Text>
        {upNext ? (
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroType}>
                {upNext.type === "habit" ? "Habit · due today" : "Task · due today"}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{upNext.title}</Text>
            <Text style={styles.heroReason}>{upNext.reason}</Text>
            <TouchableOpacity
              style={styles.heroAction}
              activeOpacity={0.85}
              onPress={() => (upNext.type === "task" ? void completeTask(upNext.id) : void completeHabit(upNext.id))}
            >
              <Text style={styles.heroActionText}>
                {upNext.type === "task" ? "Complete task" : "Log habit"}
              </Text>
              <ChevronRight size={16} color={colors.onAccent} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.heroEmpty}>
            <Check size={20} color={colors.textMuted} />
            <Text style={styles.heroEmptyText}>You&apos;re caught up</Text>
          </View>
        )}
      </View>

      {/* Today's Focus — compact, actionable */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabelTextAlt}>TODAY&apos;S FOCUS</Text>
          <Text style={styles.sectionCount}>
            {donePriorities}/{priorities.length} done
          </Text>
        </View>

        {priorities.length > 0 ? (
          <View style={styles.focusList}>
            {priorities.map((priority, i) => (
              <View key={priority.id} style={[styles.focusRow, priority.done && styles.focusRowDone]}>
                <TouchableOpacity
                  style={[styles.focusCheck, priority.done && styles.focusCheckDone]}
                  onPress={() => void togglePriority(priority.id)}
                  activeOpacity={0.7}
                >
                  {priority.done ? (
                    <Check size={18} color={colors.success} />
                  ) : (
                    <Text style={styles.focusIndex}>{i + 1}</Text>
                  )}
                </TouchableOpacity>
                <Text
                  style={[styles.focusText, priority.done && styles.focusTextDone]}
                  numberOfLines={2}
                >
                  {priority.text}
                </Text>
                <TouchableOpacity
                  style={styles.focusRemove}
                  onPress={() => {
                    Alert.alert("Remove priority", `"${priority.text}"?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Remove", style: "destructive", onPress: () => void removePriority(priority.id) },
                    ]);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Close size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.focusEmpty}>
            <Text style={styles.focusEmptyTitle}>No priorities yet</Text>
            <Text style={styles.focusEmptySub}>
              Choose up to three things that matter today.
            </Text>
            <TouchableOpacity style={styles.addPriorityButton} onPress={() => setPriorityInput(" ")}>
              <Text style={styles.addPriorityButtonText}>+ Add priority</Text>
            </TouchableOpacity>
          </View>
        )}

        {focusRemaining > 0 && priorities.length > 0 && (
          <View style={styles.addPriorityRow}>
            <TextInput
              style={styles.addPriorityInput}
              value={priorityInput}
              onChangeText={(text) => setPriorityInput(text.slice(0, 80))}
              placeholder="Add a priority…"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={() => void addPriority()}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addButton, !priorityInput.trim() && styles.addButtonDisabled]}
              onPress={() => void addPriority()}
              disabled={!priorityInput.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tasks — inline in Today */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <ChecklistIcon size={14} color={colors.accent} />
          <Text style={styles.sectionLabelTextAlt}>TASKS · {model?.tasks.dueToday.length ?? 0} DUE</Text>
        </View>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : (model?.tasks.dueToday.length ?? 0) === 0 ? (
          <CompactEmpty icon={<Pulse size={18} color={colors.textMuted} />} text="No tasks due today" />
        ) : (
          <View style={styles.list}>
            {model?.tasks.dueToday.map((task) => (
              <View key={task.id} style={styles.listRow}>
                <TouchableOpacity
                  style={styles.listCheck}
                  onPress={() => void completeTask(task.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.checkCircle} />
                </TouchableOpacity>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                {task.priority ? (
                  <Text style={styles.listMeta}>{task.priority}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Habits — inline in Today */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <HabitsIcon size={14} color={colors.accent} />
          <Text style={styles.sectionLabelTextAlt}>HABITS · {model?.habits.incompleteToday.length ?? 0} DUE</Text>
        </View>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : (model?.habits.incompleteToday.length ?? 0) === 0 ? (
          <CompactEmpty icon={<Pulse size={18} color={colors.textMuted} />} text="All habits completed or not due" />
        ) : (
          <View style={styles.list}>
            {model?.habits.incompleteToday.map((habit) => {
              const streak = getCurrentStreak([], habit.frequency, habit.days_of_week);
              return (
                <View key={habit.id} style={styles.listRow}>
                  <TouchableOpacity
                    style={styles.listCheck}
                    onPress={() => void completeHabit(habit.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkCircle} />
                  </TouchableOpacity>
                  <View style={styles.listBody}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {habit.title}
                    </Text>
                    <Text style={styles.listMeta}>
                      {habit.frequency}{streak > 0 ? ` · ${streak}-day streak` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <Text style={styles.footer}>
        {model ? `${model.tasks.doneCount} tasks done · ${model.habits.completedCount} habits logged today` : ""}
      </Text>
    </ScrollView>
  );
}

function CompactEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.compactEmpty}>
      {icon}
      <Text style={styles.compactEmptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },

  header: { marginBottom: spacing.lg, paddingTop: spacing.sm },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { ...type.caption, color: colors.textSecondary, fontWeight: "700", letterSpacing: 2 },
  greeting: { ...type.hero, color: colors.textPrimary },
  date: { ...type.meta, color: colors.textSecondary, marginTop: spacing.xs },

  upNextSection: { marginBottom: spacing.lg },
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionLabelText: { ...type.caption, color: colors.accent, fontWeight: "700", letterSpacing: 1.4 },
  sectionLabelTextAlt: { ...type.caption, color: colors.textSecondary, fontWeight: "700", letterSpacing: 1.4, marginBottom: spacing.md },
  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  heroIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroType: { ...type.caption, color: colors.accentStrong, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  heroTitle: { ...type.item, color: colors.textPrimary, marginBottom: spacing.xs },
  heroReason: { ...type.body, color: colors.textSecondary, marginBottom: spacing.md },
  heroAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 12,
    minHeight: 44,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  heroActionText: { ...type.item, color: colors.onAccent, fontWeight: "700" },
  heroEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroEmptyText: { ...type.body, color: colors.textSecondary },

  section: { marginBottom: spacing.lg },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionCount: { ...type.meta, color: colors.textMuted },

  focusList: { gap: spacing.xs },
  focusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    minHeight: 48,
  },
  focusRowDone: { opacity: 0.55 },
  focusCheck: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  focusCheckDone: { borderColor: colors.success, backgroundColor: colors.successSoft },
  focusIndex: { ...type.meta, color: colors.textSecondary, fontWeight: "600" },
  focusText: { ...type.item, color: colors.textPrimary, flex: 1 },
  focusTextDone: { textDecorationLine: "line-through", color: colors.textMuted },
  focusRemove: { padding: spacing.xs },
  focusEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  focusEmptyTitle: { ...type.item, color: colors.textSecondary },
  focusEmptySub: { ...type.meta, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" },
  addPriorityButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  addPriorityButtonText: { ...type.caption, color: colors.accentStrong, fontWeight: "600" },

  addPriorityRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, gap: spacing.sm },
  addPriorityInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 48,
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { ...type.item, color: colors.onAccent, fontWeight: "700" },

  list: { gap: spacing.xs },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  listCheck: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  listBody: { flex: 1 },
  listTitle: { ...type.item, color: colors.textPrimary, flex: 1 },
  listMeta: { ...type.meta, color: colors.textMuted, marginTop: 2 },

  compactEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  compactEmptyText: { ...type.body, color: colors.textMuted },

  emptyText: { ...type.meta, color: colors.textMuted },
  footer: { ...type.caption, color: colors.textFaint, textAlign: "center", marginTop: spacing.lg },
});