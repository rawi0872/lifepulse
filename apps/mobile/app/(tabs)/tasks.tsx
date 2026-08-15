import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

interface Task {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
}

export default function TasksScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const loadTasks = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("tasks")
      .select("id, title, priority, due_date, status, completed_at")
      .eq("user_id", user.id)
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

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7aa2c4" />}
    >
      <Text style={styles.title}>Tasks</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>To Do ({todoTasks.length})</Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : todoTasks.length === 0 ? (
          <Text style={styles.emptyText}>No tasks</Text>
        ) : (
          todoTasks.map((task) => (
            <View key={task.id} style={styles.card}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.cardMeta}>
                {task.priority} {task.due_date ? `· due ${task.due_date}` : "· no due date"}
              </Text>
            </View>
          ))
        )}
      </View>

      {doneTasks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed ({doneTasks.length})</Text>
          {doneTasks.slice(0, 10).map((task) => (
            <View key={task.id} style={[styles.card, styles.cardDone]}>
              <Text style={styles.cardTitleDone}>{task.title}</Text>
            </View>
          ))}
        </View>
      )}
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
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#f0f4f8",
  },
  section: {
    marginTop: 24,
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
  },
  cardDone: {
    opacity: 0.5,
  },
  cardTitle: {
    color: "#f0f4f8",
    fontSize: 15,
    fontWeight: "500",
  },
  cardTitleDone: {
    color: "#6b7280",
    fontSize: 15,
    textDecorationLine: "line-through",
  },
  cardMeta: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
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
