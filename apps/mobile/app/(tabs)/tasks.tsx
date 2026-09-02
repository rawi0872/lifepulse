import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert, TextInput } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors, spacing, radii, type } from "../../lib/theme";
import { Plus, Check } from "../../src/icons";
import { getLocalTodayDateString, formatTaskDueStatus, groupTasksByDate } from "@lifepulse/domain";
import type { TodayTask } from "@lifepulse/domain";

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [newTaskDue, setNewTaskDue] = useState("");
  const mountedRef = useRef(true);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, priority, due_date, status, completed_at, project_id")
      .eq("user_id", user.id)
      .in("status", ["todo", "done"])
      .order("due_date", { ascending: true })
      .limit(50);
    if (mountedRef.current) {
      setTasks(data ?? []);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    void loadTasks();
    return () => { mountedRef.current = false; };
  }, [loadTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
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
    void loadTasks();
  };

  const reopenTask = async (taskId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("tasks")
      .update({ status: "todo", completed_at: null })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .eq("status", "done");
    if (error) {
      Alert.alert("Error", "Could not reopen task.");
      return;
    }
    void loadTasks();
  };

  const createTask = async () => {
    if (!user || !newTaskTitle.trim()) return;
    const { error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        due_date: newTaskDue || null,
        status: "todo",
      });
    if (error) {
      Alert.alert("Error", "Could not create task.");
      return;
    }
    setNewTaskTitle("");
    setNewTaskDue("");
    setShowCreate(false);
    void loadTasks();
  };

  const localDate = getLocalTodayDateString();
  const groups = groupTasksByDate(tasks, localDate);
  const hasAny = tasks.length > 0;

  const filterTabs = [
    { key: "today", label: "Today", count: groups.dueToday.length },
    { key: "upcoming", label: "Upcoming", count: groups.upcoming.length },
    { key: "all", label: "All", count: tasks.length },
  ] as const;
  const [activeFilter, setActiveFilter] = useState<"today" | "upcoming" | "all">("today");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.greeting}>Tasks</Text>
          <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
            <Plus size={18} color={colors.accentStrong} />
          </TouchableOpacity>
        </View>
        <Text style={styles.date}>Focus on what&apos;s due</Text>
      </View>

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

      {/* Create task form */}
      {showCreate && (
        <View style={styles.createForm}>
          <View style={styles.createField}>
            <Text style={styles.createLabel}>Title</Text>
            <TextInput
              style={styles.createInput}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="next"
            />
          </View>
          <View style={styles.createField}>
            <Text style={styles.createLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {(["high", "medium", "low"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityChip, newTaskPriority === p && styles.priorityChipActive]}
                  onPress={() => setNewTaskPriority(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.priorityChipLabel, newTaskPriority === p && styles.priorityChipLabelActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.createField}>
            <Text style={styles.createLabel}>Due date (optional)</Text>
            <TextInput
              style={styles.createInput}
              value={newTaskDue}
              onChangeText={setNewTaskDue}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
          <View style={styles.createActions}>
            <TouchableOpacity style={styles.createCancel} onPress={() => { setShowCreate(false); setNewTaskTitle(""); }} activeOpacity={0.8}>
              <Text style={styles.createCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createSubmit, !newTaskTitle.trim() && styles.createSubmitDisabled]}
              onPress={createTask}
              disabled={!newTaskTitle.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.createSubmitText}>Create task</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Task list */}
      {!loading && !hasAny ? (
        <EmptyState
          icon={<Check size={28} color={colors.textMuted} />}
          title="No tasks yet"
          sub="Tasks appear here when something needs doing."
          actionLabel="+ Create task"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <>
          {activeFilter === "today" && groups.overdue.length > 0 && (
            <Section title="Overdue" count={groups.overdue.length} tone="danger">
              {groups.overdue.map((task) => (
                <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
              ))}
            </Section>
          )}

          {activeFilter === "today" && (
            <Section title="Due Today" count={groups.dueToday.length}>
              {loading ? (
                <Text style={styles.emptyText}>Loading…</Text>
              ) : groups.dueToday.length === 0 ? (
                <EmptyState
                  icon={<Check size={28} color={colors.textMuted} />}
                  title="Nothing due today"
                  sub="You&apos;re clear for now."
                  actionLabel="+ Create task"
                  onAction={() => setShowCreate(true)}
                />
              ) : (
                groups.dueToday.map((task) => (
                  <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
                ))
              )}
            </Section>
          )}

          {activeFilter === "upcoming" && groups.upcoming.length > 0 && (
            <Section title="Upcoming" count={groups.upcoming.length}>
              {groups.upcoming.map((task) => (
                <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
              ))}
            </Section>
          )}

          {activeFilter === "all" && (
            <>
              {groups.unscheduled.length > 0 && (
                <Section title="Unscheduled" count={groups.unscheduled.length}>
                  {groups.unscheduled.map((task) => (
                    <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
                  ))}
                </Section>
              )}
              {groups.completedToday.length > 0 && (
                <Section title="Completed Today" count={groups.completedToday.length}>
                  {groups.completedToday.map((task) => (
                    <TaskRow key={task.id} task={task} localDate={localDate} onComplete={reopenTask} isCompleted />
                  ))}
                </Section>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone?: "danger"; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabel}>
        <Text style={[styles.sectionTitle, tone === "danger" && styles.sectionTitleDanger]}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

function TaskRow({ task, localDate, onComplete, isCompleted }: { task: TodayTask; localDate: string; onComplete: (id: string) => void; isCompleted?: boolean }) {
  const status = formatTaskDueStatus(task.due_date, localDate, task.status === "done");
  return (
    <View style={[styles.row, isCompleted && styles.rowCompleted]}>
      <TouchableOpacity
        style={[styles.check, isCompleted && styles.checkDone]}
        onPress={() => onComplete(task.id)}
        activeOpacity={0.7}
      >
        {isCompleted ? (
          <Check size={20} color={colors.success} />
        ) : (
          <View style={styles.checkCircle} />
        )}
      </TouchableOpacity>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, isCompleted && styles.rowTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={styles.rowMeta}>
          {task.priority ? `${task.priority} · ` : ""}{status}
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
  priorityRow: { flexDirection: "row", gap: spacing.sm },
  priorityChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: "center",
  },
  priorityChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  priorityChipLabel: { ...type.caption, color: colors.textSecondary, fontWeight: "600" },
  priorityChipLabelActive: { color: colors.accentStrong },

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

  section: { marginBottom: spacing.xl },
  sectionLabel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sectionTitle: { ...type.caption, color: colors.accent, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  sectionTitleDanger: { color: colors.danger },
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
  rowCompleted: { opacity: 0.55 },
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
  emptyText: { ...type.meta, color: colors.textMuted, paddingVertical: spacing.sm },
});