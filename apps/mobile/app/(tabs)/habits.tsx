import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
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

  const today = getLocalTodayDateString();
  const weekStart = getWeekStartForDate(today);

  const dueToday = habits.filter((habit) => {
    const completed = habit.completedDates.filter((d) => d === today).length > 0;
    return completed || isHabitDueOnDate(habit, today, habit.completedDates);
  });

  const completedToday = dueToday.filter((habit) =>
    habit.completedDates.some((d) => d === today)
  );

  const incompleteToday = dueToday.filter((habit) =>
    !habit.completedDates.some((d) => d === today)
  );

  const notDueToday = habits.filter((habit) =>
    !dueToday.some((h) => h.id === habit.id)
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7aa2c4" />}
    >
      {incompleteToday.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due Today ({incompleteToday.length})</Text>
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
        </View>
      )}

      {completedToday.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed ({completedToday.length})</Text>
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
        </View>
      )}

      {notDueToday.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Not Due Today ({notDueToday.length})</Text>
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
        </View>
      )}

      {!loading && habits.length === 0 && (
        <Text style={styles.emptyText}>No habits yet</Text>
      )}
    </ScrollView>
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
    <View style={[styles.card, isCompleted && styles.cardCompleted, disabled && styles.cardDisabled]}>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, isCompleted && styles.cardTitleCompleted]} numberOfLines={1}>
          {habit.title}
        </Text>
        <Text style={styles.cardMeta}>
          {habit.frequency}
          {streak > 0 ? ` · ${streak}-day streak` : ""}
          {weeklyProgress ? ` · ${weeklyProgress.completed}/${weeklyProgress.target} this week` : ""}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.checkButton, isCompleted && styles.checkButtonCompleted]}
        onPress={() => isCompleted ? onUndo(habit.id) : onComplete(habit.id)}
        disabled={disabled}
      >
        <Text style={[styles.checkButtonText, isCompleted && styles.checkButtonTextCompleted]}>
          {isCompleted ? "↩" : "✓"}
        </Text>
      </TouchableOpacity>
    </View>
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
  cardCompleted: {
    opacity: 0.6,
    borderColor: "rgba(34, 197, 94, 0.2)",
    backgroundColor: "rgba(34, 197, 94, 0.05)",
  },
  cardDisabled: {
    opacity: 0.4,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: "#f0f4f8",
    fontSize: 15,
    fontWeight: "500",
  },
  cardTitleCompleted: {
    textDecorationLine: "line-through",
    color: "#6b7280",
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
  checkButtonCompleted: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  checkButtonText: {
    color: "#7aa2c4",
    fontSize: 14,
  },
  checkButtonTextCompleted: {
    color: "#22c55e",
  },
  loadingText: {
    color: "#4b5563",
    fontSize: 13,
  },
  emptyText: {
    color: "#4b5563",
    fontSize: 13,
  },
});
