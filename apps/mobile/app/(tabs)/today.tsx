import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  normalizeTodayData,
  selectMorningPlanFirstAction,
  getLocalTodayDateString,
  getWeekStartForDate,
  resolveIntendedUse,
  getCurrentStreak,
} from "@lifepulse/domain";
import type {
  TodayModel,
  TodayDataSnapshot,
  TodayDateContext,
  TodayHabit,
  TodayTask,
} from "@lifepulse/domain";

export default function TodayScreen() {
  const { user } = useAuth();
  const [model, setModel] = useState<TodayModel | null>(null);
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

  const upNext = model ? selectMorningPlanFirstAction(model, []) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7aa2c4" />}
    >
      <Text style={styles.date}>{model?.date.displayDate ?? "Today"}</Text>

      {upNext && (
        <View style={styles.upNextSection}>
          <Text style={styles.upNextLabel}>UP NEXT</Text>
          <View style={styles.upNextCard}>
            <Text style={styles.upNextTitle} numberOfLines={2}>{upNext.title}</Text>
            <Text style={styles.upNextReason}>{upNext.reason}</Text>
            {upNext.type === "task" && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => void completeTask(upNext.id)}
              >
                <Text style={styles.completeButtonText}>Complete</Text>
              </TouchableOpacity>
            )}
            {upNext.type === "habit" && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => void completeHabit(upNext.id)}
              >
                <Text style={styles.completeButtonText}>Log habit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {!upNext && !loading && (
        <View style={styles.emptyUpNext}>
          <Text style={styles.emptyUpNextText}>No actionable work right now</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Tasks ({model?.tasks.dueToday.length ?? 0} due today)
        </Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (model?.tasks.dueToday.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>No tasks due today</Text>
        ) : (
          model?.tasks.dueToday.map((task) => (
            <View key={task.id} style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
                <Text style={styles.cardMeta}>
                  {task.priority} {task.due_date ? `· ${task.due_date}` : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.checkButton}
                onPress={() => void completeTask(task.id)}
              >
                <Text style={styles.checkButtonText}>✓</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Habits ({model?.habits.incompleteToday.length ?? 0} due today)
        </Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (model?.habits.incompleteToday.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>All habits completed or not due</Text>
        ) : (
          model?.habits.incompleteToday.map((habit) => {
            const streak = getCurrentStreak([], habit.frequency, habit.days_of_week);
            return (
              <View key={habit.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{habit.title}</Text>
                  <Text style={styles.cardMeta}>
                    {habit.frequency}
                    {streak > 0 ? ` · ${streak}-day streak` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.checkButton}
                  onPress={() => void completeHabit(habit.id)}
                >
                  <Text style={styles.checkButtonText}>✓</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <Text style={styles.footer}>
        {model ? `${model.tasks.doneCount} tasks done today · ${model.habits.completedCount} habits logged` : ""}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080c12",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  date: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
  },
  upNextSection: {
    marginBottom: 28,
  },
  upNextLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7aa2c4",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  upNextCard: {
    backgroundColor: "rgba(122, 162, 196, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(122, 162, 196, 0.2)",
    borderRadius: 12,
    padding: 16,
  },
  upNextTitle: {
    color: "#f0f4f8",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  upNextReason: {
    color: "#7aa2c4",
    fontSize: 12,
    marginTop: 4,
  },
  completeButton: {
    marginTop: 12,
    backgroundColor: "rgba(122, 162, 196, 0.15)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  completeButtonText: {
    color: "#7aa2c4",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyUpNext: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 28,
    alignItems: "center",
  },
  emptyUpNextText: {
    color: "#4b5563",
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7aa2c4",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: "#f0f4f8",
    fontSize: 15,
    fontWeight: "500",
  },
  cardMeta: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  checkButtonText: {
    color: "#7aa2c4",
    fontSize: 14,
  },
  loadingText: {
    color: "#4b5563",
    fontSize: 13,
  },
  emptyText: {
    color: "#4b5563",
    fontSize: 13,
  },
  footer: {
    color: "#374151",
    fontSize: 11,
    textAlign: "center",
    marginTop: 20,
  },
});
