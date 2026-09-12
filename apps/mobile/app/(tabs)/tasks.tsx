import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Pressable, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors, spacing, radii, type } from "../../lib/theme";
import { Plus, Check } from "../../src/icons";
import { ItemActionSheet } from "../../src/components/ItemActionSheet";
import { ConfirmDeleteDialog } from "../../src/components/ConfirmDeleteDialog";
import { ScreenHeader, SectionLabel, EmptyState, ErrorBanner, FieldLabel, FieldInput } from "../../src/components/ui";
import {
  getLocalTodayDateString,
  formatTaskDueStatus,
  groupTasksByDate,
  isValidLocalDateString,
  buildTaskUpdatePayload,
  removeDeletedById,
  createSingleFlight,
  MAX_ITEM_TITLE_LENGTH,
} from "@lifepulse/domain";
import type { TodayTask } from "@lifepulse/domain";

const ROW_ACTIONS_HINT_KEY = "lifepulse:friction-v1:row-actions-hint-seen";

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TodayTask | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formPriority, setFormPriority] = useState<"high" | "medium" | "low">("medium");
  const [formDue, setFormDue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionTask, setActionTask] = useState<TodayTask | null>(null);
  const [deleteTask, setDeleteTask] = useState<TodayTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [completingIds, setCompletingIds] = useState<string[]>([]);
  const [showRowHint, setShowRowHint] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"today" | "upcoming" | "all">("today");
  const mountedRef = useRef(true);
  const saveGuardRef = useRef(createSingleFlight());
  const deleteGuardRef = useRef(createSingleFlight());

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, description, priority, due_date, status, completed_at, project_id")
      .eq("user_id", user.id)
      .in("status", ["todo", "done"])
      .order("due_date", { ascending: true })
      .limit(50);
    if (mountedRef.current) {
      if (error) {
        setLoadError(true);
      } else {
        setTasks(data ?? []);
      }
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    void loadTasks();
    AsyncStorage.getItem(ROW_ACTIONS_HINT_KEY).then((seen) => {
      if (mountedRef.current && seen !== "1") setShowRowHint(true);
    }).catch(() => {});
    return () => { mountedRef.current = false; };
  }, [loadTasks]);

  // Re-read on focus so edits/deletes from elsewhere (and Today) never go stale.
  useFocusEffect(useCallback(() => {
    void loadTasks();
  }, [loadTasks]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const markCompleting = (id: string, pending: boolean) =>
    setCompletingIds((prev) => (pending ? [...prev, id] : prev.filter((x) => x !== id)));

  const completeTask = async (taskId: string) => {
    if (!user || completingIds.includes(taskId)) return;
    markCompleting(taskId, true);
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .eq("status", "todo");
    if (mountedRef.current) markCompleting(taskId, false);
    if (error) {
      Alert.alert("Error", "Could not complete task.");
      return;
    }
    void loadTasks();
  };

  const reopenTask = async (taskId: string) => {
    if (!user || completingIds.includes(taskId)) return;
    markCompleting(taskId, true);
    const { error } = await supabase
      .from("tasks")
      .update({ status: "todo", completed_at: null })
      .eq("id", taskId)
      .eq("user_id", user.id)
      .eq("status", "done");
    if (mountedRef.current) markCompleting(taskId, false);
    if (error) {
      Alert.alert("Error", "Could not reopen task.");
      return;
    }
    void loadTasks();
  };

  const openCreate = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormPriority("medium");
    setFormDue("");
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (task: TodayTask) => {
    setActionTask(null);
    setEditingTask(task);
    setFormTitle(task.title);
    setFormPriority(task.priority === "high" || task.priority === "low" ? task.priority : "medium");
    setFormDue(task.due_date ?? "");
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingTask(null);
    setFormError(null);
  };

  const saveForm = async () => {
    if (!user || saving) return;
    const outcome = await saveGuardRef.current.run(async () => {
      setSaving(true);
      setFormError(null);
      try {
        if (editingTask) {
          // Edit: update the same row — never insert.
          const built = buildTaskUpdatePayload(editingTask, {
            title: formTitle,
            priority: formPriority,
            dueDate: formDue,
          });
          if (!built.ok) {
            setFormError(built.error);
            return;
          }
          if (!built.changed) {
            setShowForm(false);
            setEditingTask(null);
            return;
          }
          const { error } = await supabase
            .from("tasks")
            .update(built.payload)
            .eq("id", editingTask.id)
            .eq("user_id", user.id);
          if (error) {
            setFormError("Could not save changes. Try again.");
            return;
          }
          setTasks((prev) =>
            prev.map((t) => (t.id === editingTask.id ? { ...t, ...built.payload } : t)),
          );
          setShowForm(false);
          setEditingTask(null);
          void loadTasks();
        } else {
          if (!formTitle.trim()) return;
          const { error } = await supabase.from("tasks").insert({
            user_id: user.id,
            title: formTitle.trim().slice(0, MAX_ITEM_TITLE_LENGTH),
            priority: formPriority,
            due_date: formDue.trim() === "" ? null : formDue.trim(),
            status: "todo",
          });
          if (error) {
            setFormError("Could not create task. Try again.");
            return;
          }
          setFormTitle("");
          setFormDue("");
          setShowForm(false);
          void loadTasks();
        }
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    });
    if (!outcome.started) return;
  };

  const openActions = (task: TodayTask) => {
    setActionTask(task);
    if (showRowHint) {
      setShowRowHint(false);
      AsyncStorage.setItem(ROW_ACTIONS_HINT_KEY, "1").catch(() => {});
    }
  };

  const confirmDeleteTask = async () => {
    if (!user || !deleteTask || deleting) return;
    const target = deleteTask;
    const outcome = await deleteGuardRef.current.run(async () => {
      setDeleting(true);
      // Optimistic removal so the row disappears immediately.
      setTasks((prev) => removeDeletedById(prev, target.id));
      const { error } = await supabase.from("tasks").delete().eq("id", target.id).eq("user_id", user.id);
      if (mountedRef.current) setDeleting(false);
      if (error) {
        // Restore truthful state on failure.
        void loadTasks();
        Alert.alert("Error", "Could not delete task. Try again.");
        return;
      }
      if (mountedRef.current) setDeleteTask(null);
      void loadTasks();
    });
    if (!outcome.started) return;
  };

  const localDate = getLocalTodayDateString();
  const groups = groupTasksByDate(tasks, localDate);
  const hasAny = tasks.length > 0;
  const dueInputInvalid = formDue.trim() !== "" && !isValidLocalDateString(formDue.trim());
  const canSave = formTitle.trim().length > 0 && !saving && !dueInputInvalid;

  const filterTabs = [
    { key: "today", label: "Today", count: groups.dueToday.length },
    { key: "upcoming", label: "Upcoming", count: groups.upcoming.length },
    { key: "all", label: "All", count: tasks.length },
  ] as const;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitle}>
          <ScreenHeader title="Tasks" sub="Focus on what&apos;s due" />
        </View>
        <TouchableOpacity style={styles.createButton} onPress={openCreate} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Create task">
          <Plus size={18} color={colors.accentStrong} />
        </TouchableOpacity>
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

      {showRowHint && hasAny && !loading ? (
        <Text style={styles.hint}>Tip: long-press a task to edit or delete it.</Text>
      ) : null}

      {loadError && !loading ? (
        <ErrorBanner message="Couldn&apos;t load tasks." onRetry={() => void loadTasks()} />
      ) : null}

      {/* Create / edit form */}
      {showForm && (
        <View style={styles.createForm}>
          <Text style={styles.formTitle}>{editingTask ? "Edit task" : "New task"}</Text>
          <View style={styles.createField}>
            <FieldLabel>Title</FieldLabel>
            <FieldInput
              value={formTitle}
              onChangeText={(v) => { setFormTitle(v); if (formError) setFormError(null); }}
              placeholder="What needs to be done?"
              autoFocus
              returnKeyType="next"
              maxLength={MAX_ITEM_TITLE_LENGTH}
              editable={!saving}
              onSubmitEditing={saveForm}
            />
          </View>
          <View style={styles.createField}>
            <FieldLabel>Priority</FieldLabel>            <View style={styles.priorityRow}>
              {(["high", "medium", "low"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityChip, formPriority === p && styles.priorityChipActive]}
                  onPress={() => setFormPriority(p)}
                  activeOpacity={0.8}
                  disabled={saving}
                >
                  <Text style={[styles.priorityChipLabel, formPriority === p && styles.priorityChipLabelActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.createField}>
            <FieldLabel>Due date (optional)</FieldLabel>
            <FieldInput
              value={formDue}
              onChangeText={(v) => { setFormDue(v); if (formError) setFormError(null); }}
              placeholder="YYYY-MM-DD"
              keyboardType="numeric"
              returnKeyType="done"
              maxLength={10}
              editable={!saving}
              onSubmitEditing={saveForm}
            />
            {dueInputInvalid ? <Text style={styles.fieldHint}>Use YYYY-MM-DD, or leave empty.</Text> : null}
          </View>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <View style={styles.createActions}>
            <TouchableOpacity style={styles.createCancel} onPress={closeForm} activeOpacity={0.8} disabled={saving}>
              <Text style={styles.createCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createSubmit, !canSave && styles.createSubmitDisabled]}
              onPress={saveForm}
              disabled={!canSave}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={editingTask ? "Save task changes" : "Create task"}
            >
              <Text style={styles.createSubmitText}>
                {saving ? "Saving…" : editingTask ? "Save changes" : "Create task"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Task list */}
      {loading ? (
        <Text style={styles.emptyText}>Loading tasks…</Text>
      ) : !hasAny && !loadError ? (
        <EmptyState
          icon={<Check size={28} color={colors.textMuted} />}
          title="No tasks yet"
          sub="Tasks appear here when something needs doing."
          actionLabel="+ Create task"
          onAction={openCreate}
        />
      ) : (
        <>
          {activeFilter === "today" && groups.overdue.length > 0 && (
            <Section title="Overdue" count={groups.overdue.length} tone="danger">
              {groups.overdue.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  localDate={localDate}
                  pending={completingIds.includes(task.id)}
                  onComplete={completeTask}
                  onOpenActions={openActions}
                  onEdit={openEdit}
                  onDelete={(t) => { setActionTask(null); setDeleteTask(t); }}
                />
              ))}
            </Section>
          )}

          {activeFilter === "today" && (
            <Section title="Due Today" count={groups.dueToday.length}>
              {groups.dueToday.length === 0 ? (
                <EmptyState
                  icon={<Check size={28} color={colors.textMuted} />}
                  title="Nothing due today"
                  sub="You&apos;re clear for now."
                  actionLabel="+ Create task"
                  onAction={openCreate}
                />
              ) : (
                groups.dueToday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    localDate={localDate}
                    pending={completingIds.includes(task.id)}
                    onComplete={completeTask}
                    onOpenActions={openActions}
                    onEdit={openEdit}
                    onDelete={(t) => { setActionTask(null); setDeleteTask(t); }}
                  />
                ))
              )}
            </Section>
          )}

          {activeFilter === "upcoming" && (
            <Section title="Upcoming" count={groups.upcoming.length}>
              {groups.upcoming.length === 0 ? (
                <EmptyState
                  icon={<Check size={28} color={colors.textMuted} />}
                  title="Nothing upcoming"
                  sub="Future-dated tasks will show up here."
                  actionLabel="+ Create task"
                  onAction={openCreate}
                />
              ) : (
                groups.upcoming.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    localDate={localDate}
                    pending={completingIds.includes(task.id)}
                    onComplete={completeTask}
                    onOpenActions={openActions}
                    onEdit={openEdit}
                    onDelete={(t) => { setActionTask(null); setDeleteTask(t); }}
                  />
                ))
              )}
            </Section>
          )}

          {activeFilter === "all" && (
            <>
              {groups.unscheduled.length > 0 && (
                <Section title="Unscheduled" count={groups.unscheduled.length}>
                  {groups.unscheduled.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      localDate={localDate}
                      pending={completingIds.includes(task.id)}
                      onComplete={completeTask}
                      onOpenActions={openActions}
                      onEdit={openEdit}
                      onDelete={(t) => { setActionTask(null); setDeleteTask(t); }}
                    />
                  ))}
                </Section>
              )}
              {groups.completedToday.length > 0 && (
                <Section title="Completed Today" count={groups.completedToday.length}>
                  {groups.completedToday.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      localDate={localDate}
                      pending={completingIds.includes(task.id)}
                      onComplete={reopenTask}
                      isCompleted
                      onOpenActions={openActions}
                      onEdit={openEdit}
                      onDelete={(t) => { setActionTask(null); setDeleteTask(t); }}
                    />
                  ))}
                </Section>
              )}
              {groups.unscheduled.length === 0 && groups.completedToday.length === 0 && (
                <EmptyState
                  icon={<Check size={28} color={colors.textMuted} />}
                  title="No tasks yet"
                  sub="Tasks appear here when something needs doing."
                  actionLabel="+ Create task"
                  onAction={openCreate}
                />
              )}
            </>
          )}
        </>
      )}

      <ItemActionSheet
        visible={actionTask !== null}
        title={actionTask?.title ?? ""}
        kind="Task"
        onEdit={() => { if (actionTask) openEdit(actionTask); }}
        onDelete={() => { if (actionTask) { const t = actionTask; setActionTask(null); setDeleteTask(t); } }}
        onClose={() => setActionTask(null)}
      />
      <ConfirmDeleteDialog
        visible={deleteTask !== null}
        itemTitle={deleteTask?.title ?? ""}
        kind="Task"
        pending={deleting}
        onCancel={() => { if (!deleting) setDeleteTask(null); }}
        onConfirm={() => void confirmDeleteTask()}
      />
    </ScrollView>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone?: "danger"; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <SectionLabel tone={tone === "danger" ? "danger" : "accent"}>{title}</SectionLabel>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

function TaskRow({
  task,
  localDate,
  onComplete,
  isCompleted,
  pending,
  onOpenActions,
  onEdit,
  onDelete,
}: {
  task: TodayTask;
  localDate: string;
  onComplete: (id: string) => void;
  isCompleted?: boolean;
  pending: boolean;
  onOpenActions: (task: TodayTask) => void;
  onEdit: (task: TodayTask) => void;
  onDelete: (task: TodayTask) => void;
}) {
  const status = formatTaskDueStatus(task.due_date, localDate, task.status === "done");
  return (
    <Pressable
      style={[styles.row, isCompleted && styles.rowCompleted]}
      onLongPress={() => onOpenActions(task)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={task.title}
      accessibilityHint="Long press for edit and delete options"
      accessibilityActions={[
        { name: "edit", label: "Edit task" },
        { name: "delete", label: "Delete task" },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "edit") onEdit(task);
        else if (event.nativeEvent.actionName === "delete") onDelete(task);
      }}
    >
      <TouchableOpacity
        style={[styles.check, isCompleted && styles.checkDone]}
        onPress={() => onComplete(task.id)}
        disabled={pending}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!isCompleted, busy: pending }}
        accessibilityLabel={isCompleted ? `Reopen ${task.title}` : `Complete ${task.title}`}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  headerTitle: { flex: 1 },
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

  hint: { ...type.meta, color: colors.textMuted, marginBottom: spacing.md },

  createForm: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  formTitle: { ...type.item, color: colors.textPrimary },
  createField: { gap: spacing.sm },
  fieldHint: { ...type.meta, color: colors.danger },
  formError: { ...type.meta, color: colors.danger },
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
    minHeight: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  createSubmitDisabled: { opacity: 0.5 },
  createSubmitText: { ...type.item, color: colors.onAccent, fontWeight: "700" },

  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionCount: { ...type.caption, color: colors.textMuted, marginBottom: spacing.md },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  rowCompleted: { opacity: 0.55 },
  check: { width: 40, height: 40, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  checkDone: { backgroundColor: colors.successSoft },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  rowBody: { flex: 1 },
  rowTitle: { ...type.item, color: colors.textPrimary },
  rowTitleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  rowMeta: { ...type.meta, color: colors.textMuted, marginTop: 2 },
  emptyText: { ...type.meta, color: colors.textMuted, paddingVertical: spacing.sm },
});
