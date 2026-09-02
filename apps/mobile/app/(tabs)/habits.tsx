import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert, TextInput } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors, spacing, radii, type } from "../../lib/theme";
import { Plus, Check } from "../../src/icons";
import {
  getLocalTodayDateString,
  getWeekStartForDate,
  isHabitDueOnDate,
  normalizeCompletedDates,
  getCurrentStreak,
  getWeeklyProgress,
} from "@lifepulse/domain";
import type { TodayHabit } from "@lifepulse/domain";

interface HabitWithLogs extends TodayHabit {
  completedDates: string[];
}

export default function HabitsScreen() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<HabitWithLogs[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitFrequency, setNewHabitFrequency] = useState<"daily" | "weekdays" | "weekly">("daily");
  const [newHabitTimesPerWeek, setNewHabitTimesPerWeek] = useState(3);
  const [newHabitDaysOfWeek, setNewHabitDaysOfWeek] = useState<number[]>([]);
  const mountedRef = useRef(true);

  const loadHabits = useCallback(async () => {
    if (!user) return;
    const today = getLocalTodayDateString();
    const weekStart = getWeekStartForDate(today);

    const [habitsRes, logsRes] = await Promise.all([
      supabase
        .from("habits")
        .select("id, title, description, frequency, days_of_week, times_per_week")
        .eq("user_id", user.id),
      supabase
        .from("habit_logs")
        .select("habit_id, completed_date")
        .eq("user_id", user.id)
        .gte("completed_date", weekStart),
    ]);

    if (!mountedRef.current) return;

    const rawHabits = (habitsRes.data ?? []) as TodayHabit[];
    const logs = (logsRes.data ?? []) as { habit_id: string; completed_date: string }[];

    const logsByHabit: Record<string, string[]> = {};
    logs.forEach((log) => {
      if (!logsByHabit[log.habit_id]) logsByHabit[log.habit_id] = [];
      logsByHabit[log.habit_id].push(log.completed_date);
    });

    const habitsWithLogs: HabitWithLogs[] = rawHabits.map((habit) => ({
      ...habit,
      completedDates: normalizeCompletedDates(logsByHabit[habit.id] ?? []),
    }));

    setHabits(habitsWithLogs);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    void loadHabits();
    return () => { mountedRef.current = false; };
  }, [loadHabits]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHabits();
    setRefreshing(false);
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
    void loadHabits();
  };

  const uncompleteHabit = async (habitId: string) => {
    if (!user) return;
    const today = getLocalTodayDateString();
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", habitId)
      .eq("completed_date", today);
    if (!logs || logs.length === 0) return;
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("id", logs[0].id)
      .eq("user_id", user.id);
    if (error) {
      Alert.alert("Error", "Could not remove habit log.");
      return;
    }
    void loadHabits();
  };

  const createHabit = async () => {
    if (!user || !newHabitTitle.trim()) return;
    // habits.realm_id is NOT NULL — ensure default realm exists
    let realmId: string | null = null;
    try {
      const { data: realm } = await supabase.from("realms").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      realmId = (realm as { id: string } | null)?.id ?? null;
      if (!realmId) {
        const { data: created, error: realmErr } = await supabase.from("realms").insert({ user_id: user.id, name: "Personal", color: "#6366f1", icon: "◉" }).select("id").single();
        if (!realmErr && created) realmId = (created as { id: string }).id;
      }
    } catch { /* handled below */ }
    if (!realmId) {
      Alert.alert("Setup needed", "Workspace initializing. Try again in a moment.");
      return;
    }
    const payload: Record<string, unknown> = {
      user_id: user.id,
      realm_id: realmId,
      title: newHabitTitle.trim(),
      frequency: newHabitFrequency,
      days_of_week: newHabitDaysOfWeek,
    };
    if (newHabitFrequency === "weekly") {
      payload.times_per_week = newHabitTimesPerWeek;
    }
    const { error } = await supabase.from("habits").insert(payload);
    if (error) {
      console.error("[habits] insert failed", error.message);
      Alert.alert("Error", error.message.includes("realm_id") ? "Workspace not ready. Complete onboarding." : "Could not create habit.");
      return;
    }
    setNewHabitTitle("");
    setShowCreate(false);
    void loadHabits();
  };

  const today = getLocalTodayDateString();
  const weekStart = getWeekStartForDate(today);

  const dueToday = habits.filter((habit) => {
    const completed = habit.completedDates.filter((d) => d === today).length > 0;
    return completed || isHabitDueOnDate(habit, today, habit.completedDates);
  });

  const completedToday = dueToday.filter((habit) => habit.completedDates.some((d) => d === today));
  const incompleteToday = dueToday.filter((habit) => !habit.completedDates.some((d) => d === today));
  const notDueToday = habits.filter((habit) => !dueToday.some((h) => h.id === habit.id));

  const totalTarget = habits.reduce((sum, h) => sum + (h.times_per_week ?? 0), 0);

  const filterTabs = [
    { key: "due", label: "Due today", count: incompleteToday.length },
    { key: "completed", label: "Completed", count: completedToday.length },
    { key: "all", label: "All", count: habits.length },
  ] as const;
  const [activeFilter, setActiveFilter] = useState<"due" | "completed" | "all">("due");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.greeting}>Habits</Text>
          <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
            <Plus size={18} color={colors.accentStrong} />
          </TouchableOpacity>
        </View>
        <Text style={styles.date}>
          {totalTarget > 0 ? `${completedToday.length} of ${totalTarget} targets done today` : "Build your rhythm"}
        </Text>
      </View>

      {/* Status summary */}
      <View style={styles.statusSummary}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{habits.filter(h => isHabitDueOnDate(h, today, h.completedDates) || h.completedDates.includes(today)).length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{completedToday.length}</Text>
          <Text style={styles.statLabel}>Done today</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalTarget}</Text>
          <Text style={styles.statLabel}>Weekly target</Text>
        </View>
      </View>

      {/* Create habit form */}
      {showCreate && (
        <View style={styles.createForm}>
          <View style={styles.createField}>
            <Text style={styles.createLabel}>Title</Text>
            <TextInput
              style={styles.createInput}
              value={newHabitTitle}
              onChangeText={setNewHabitTitle}
              placeholder="What&apos;s the habit?"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="next"
            />
          </View>
          <View style={styles.createField}>
            <Text style={styles.createLabel}>Frequency</Text>
            <View style={styles.frequencyRow}>
              {(["daily", "weekdays", "weekly"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.frequencyChip, newHabitFrequency === f && styles.frequencyChipActive]}
                  onPress={() => { setNewHabitFrequency(f); setNewHabitDaysOfWeek([]); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.frequencyChipLabel, newHabitFrequency === f && styles.frequencyChipLabelActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {newHabitFrequency === "weekly" && (
            <>
              <View style={styles.createField}>
                <Text style={styles.createLabel}>Times per week</Text>
                <View style={styles.timesRow}>
                  <TouchableOpacity style={styles.timesButton} onPress={() => setNewHabitTimesPerWeek(Math.max(1, newHabitTimesPerWeek - 1))} activeOpacity={0.8}>
                    <Text style={styles.timesButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.timesValue}>{newHabitTimesPerWeek}</Text>
                  <TouchableOpacity style={styles.timesButton} onPress={() => setNewHabitTimesPerWeek(Math.min(7, newHabitTimesPerWeek + 1))} activeOpacity={0.8}>
                    <Text style={styles.timesButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.createField}>
                <Text style={styles.createLabel}>Days</Text>
                <View style={styles.daysRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, newHabitDaysOfWeek.includes(d) && styles.dayChipActive]}
                      onPress={() => setNewHabitDaysOfWeek(
                        newHabitDaysOfWeek.includes(d)
                          ? newHabitDaysOfWeek.filter((x) => x !== d)
                          : [...newHabitDaysOfWeek, d]
                      )}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dayChipLabel, newHabitDaysOfWeek.includes(d) && styles.dayChipLabelActive]}>
                        {["S", "M", "T", "W", "T", "F", "S"][d]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
          <View style={styles.createActions}>
            <TouchableOpacity style={styles.createCancel} onPress={() => { setShowCreate(false); setNewHabitTitle(""); }} activeOpacity={0.8}>
              <Text style={styles.createCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createSubmit, !newHabitTitle.trim() && styles.createSubmitDisabled]}
              onPress={createHabit}
              disabled={!newHabitTitle.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.createSubmitText}>Create habit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filterTabs}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabLabel, activeFilter === tab.key && styles.filterTabLabelActive]}>
              {tab.label}
            </Text>
            <Text style={[styles.filterTabCount, activeFilter === tab.key && styles.filterTabCountActive]}>
              {tab.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Habit list */}
      {!loading && habits.length === 0 ? (
        <EmptyState
          icon={<Check size={28} color={colors.textMuted} />}
          title="No habits yet"
          sub="Add a habit to start building consistency."
          actionLabel="+ Create habit"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <>
          {activeFilter === "due" && incompleteToday.length > 0 && (
            <Section title="Due Today" count={incompleteToday.length}>
              {incompleteToday.map((habit) => {
                const streak = getCurrentStreak(habit.completedDates, habit.frequency, habit.days_of_week);
                const weekly = getWeeklyProgress(habit.completedDates, habit.frequency, habit.times_per_week, weekStart, habit.days_of_week);
                return (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    isCompleted={false}
                    streak={streak}
                    weeklyProgress={weekly}
                    onComplete={completeHabit}
                    onUndo={uncompleteHabit}
                  />
                );
              })}
            </Section>
          )}

          {activeFilter === "due" && incompleteToday.length === 0 && (
            <EmptyState
              icon={<Check size={20} color={colors.textMuted} />}
              title="All caught up"
              sub="Nothing due right now."
              actionLabel="+ Create habit"
              onAction={() => setShowCreate(true)}
            />
          )}

          {activeFilter === "completed" && completedToday.length > 0 && (
            <Section title="Completed" count={completedToday.length}>
              {completedToday.map((habit) => {
                const streak = getCurrentStreak(habit.completedDates, habit.frequency, habit.days_of_week);
                return (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    isCompleted
                    streak={streak}
                    onComplete={completeHabit}
                    onUndo={uncompleteHabit}
                  />
                );
              })}
            </Section>
          )}

          {activeFilter === "all" && notDueToday.length > 0 && (
            <Section title="Not Due Today" count={notDueToday.length}>
              {notDueToday.map((habit) => {
                const streak = getCurrentStreak(habit.completedDates, habit.frequency, habit.days_of_week);
                return (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    isCompleted={false}
                    streak={streak}
                    onComplete={completeHabit}
                    onUndo={uncompleteHabit}
                    disabled
                  />
                );
              })}
            </Section>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

function HabitRow({
  habit,
  isCompleted,
  streak,
  weeklyProgress,
  onComplete,
  onUndo,
  disabled,
}: {
  habit: HabitWithLogs;
  isCompleted: boolean;
  streak: number;
  weeklyProgress?: { completed: number; target: number } | null;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, isCompleted && styles.rowCompleted, disabled && styles.rowDisabled]}>
      <TouchableOpacity
        style={[styles.check, isCompleted && styles.checkDone]}
        onPress={() => (isCompleted ? onUndo(habit.id) : onComplete(habit.id))}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {isCompleted ? (
          <Check size={20} color={colors.success} />
        ) : (
          <View style={styles.checkCircle} />
        )}
      </TouchableOpacity>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, isCompleted && styles.rowTitleDone]} numberOfLines={1}>
          {habit.title}
        </Text>
        <Text style={styles.rowMeta}>
          {habit.frequency}
          {streak > 0 ? ` · ${streak}-day streak` : ""}
          {weeklyProgress ? ` · ${weeklyProgress.completed}/${weeklyProgress.target} this week` : ""}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ icon, title, sub, actionLabel, onAction }: { icon: React.ReactNode; title: string; sub: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.emptyState}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.emptyAction} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },

  header: { marginBottom: spacing.md, paddingTop: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  greeting: { ...type.hero, color: colors.textPrimary },
  date: { ...type.meta, color: colors.textSecondary, marginTop: spacing.xs },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  statusSummary: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg, gap: spacing.md },
  stat: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  statLabel: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs },

  createForm: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  createField: { gap: spacing.sm },
  createLabel: { ...type.caption, color: colors.textSecondary },
  createInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 48,
  },
  frequencyRow: { flexDirection: "row", gap: spacing.sm },
  frequencyChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: "center",
  },
  frequencyChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  frequencyChipLabel: { ...type.caption, color: colors.textSecondary, fontWeight: "600" },
  frequencyChipLabelActive: { color: colors.accentStrong },
  timesRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  timesButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  timesButtonText: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  timesValue: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, minWidth: 30, textAlign: "center" },
  daysRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  dayChipLabel: { ...type.caption, color: colors.textSecondary, fontWeight: "600" },
  dayChipLabelActive: { color: colors.accentStrong },

  createActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  createCancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  createCancelText: { ...type.item, color: colors.textSecondary, fontWeight: "600" },
  createSubmit: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  createSubmitDisabled: { opacity: 0.5 },
  createSubmitText: { ...type.item, color: colors.onAccent, fontWeight: "700" },

  filterTabs: { flexDirection: "row", marginBottom: spacing.lg, gap: spacing.sm },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  filterTabActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  filterTabLabel: { ...type.caption, color: colors.textSecondary, fontWeight: "600" },
  filterTabLabelActive: { color: colors.accentStrong },
  filterTabCount: { ...type.caption, color: colors.textMuted, fontWeight: "500" },
  filterTabCountActive: { color: colors.accentStrong },

  section: { marginBottom: spacing.xl },
  sectionLabel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sectionTitle: { ...type.caption, color: colors.accent, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  sectionCount: { ...type.caption, color: colors.textMuted },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 52,
  },
  rowCompleted: { borderColor: colors.successSoft, backgroundColor: colors.surface },
  rowDisabled: { opacity: 0.45 },
  check: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  checkDone: { backgroundColor: colors.successSoft },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  rowBody: { flex: 1 },
  rowTitle: { ...type.item, color: colors.textPrimary },
  rowTitleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  rowMeta: { ...type.meta, color: colors.textMuted, marginTop: 2 },

  emptyState: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...type.item, color: colors.textSecondary, marginTop: spacing.sm },
  emptySub: { ...type.meta, color: colors.textMuted, textAlign: "center" },
  emptyAction: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  emptyActionText: { ...type.caption, color: colors.accentStrong, fontWeight: "600" },
});