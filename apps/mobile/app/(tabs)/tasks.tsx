import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { getLocalTodayDateString, formatTaskDueStatus, groupTasksByDate } from "@lifepulse/domain";
import type { TodayTask } from "@lifepulse/domain";

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const localDate = getLocalTodayDateString();
  const groups = groupTasksByDate(tasks, localDate);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7aa2c4" />}
    >
      {groups.overdue.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.overdue]}>Overdue ({groups.overdue.length})</Text>
          {groups.overdue.map((task) => (
            <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Due Today ({groups.dueToday.length})</Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : groups.dueToday.length === 0 ? (
          <Text style={styles.emptyText}>No tasks due today</Text>
        ) : (
          groups.dueToday.map((task) => (
            <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
          ))
        )}
      </View>

      {groups.upcoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming ({groups.upcoming.length})</Text>
          {groups.upcoming.map((task) => (
            <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
          ))}
        </View>
      )}

      {groups.unscheduled.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unscheduled ({groups.unscheduled.length})</Text>
          {groups.unscheduled.map((task) => (
            <TaskRow key={task.id} task={task} localDate={localDate} onComplete={completeTask} />
          ))}
        </View>
      )}

      {groups.completedToday.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed Today ({groups.completedToday.length})</Text>
          {groups.completedToday.map((task) => (
            <TaskRow key={task.id} task={task} localDate={localDate} onComplete={reopenTask} isCompleted />
          ))}
        </View>
      )}

      {!loading && tasks.length === 0 && (
        <Text style={styles.emptyText}>No tasks yet</Text>
      )}
    </ScrollView>
  );
}

function TaskRow({ task, localDate, onComplete, isCompleted }: { task: TodayTask; localDate: string; onComplete: (id: string) => void; isCompleted?: boolean }) {
  const status = formatTaskDueStatus(task.due_date, localDate, task.status === "done");
  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, isCompleted && styles.cardTitleCompleted]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={styles.cardMeta}>
          {task.priority} · {status}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.checkButton, isCompleted && styles.checkButtonCompleted]}
        onPress={() => onComplete(task.id)}
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
  overdue: {
    color: "#ef4444",
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
    opacity: 0.5,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  checkButtonCompleted: {
    borderColor: "rgba(107, 114, 128, 0.3)",
  },
  checkButtonText: {
    color: "#7aa2c4",
    fontSize: 14,
  },
  checkButtonTextCompleted: {
    color: "#6b7280",
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
