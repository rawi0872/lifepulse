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
}

interface Habit {
  id: string;
  title: string;
  frequency: string;
}

export default function TodayScreen() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [profile, setProfile] = useState<{ first_name: string | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const loadData = useCallback(async () => {
    if (!user) return;

    const [profileRes, tasksRes, habitsRes] = await Promise.all([
      supabase.from("profiles").select("first_name").eq("user_id", user.id).single(),
      supabase
        .from("tasks")
        .select("id, title, priority, due_date, status")
        .eq("user_id", user.id)
        .eq("status", "todo")
        .order("due_date", { ascending: true })
        .limit(20),
      supabase
        .from("habits")
        .select("id, title, frequency")
        .eq("user_id", user.id)
        .limit(20),
    ]);

    if (mountedRef.current) {
      setProfile(profileRes.data);
      setTasks(tasksRes.data ?? []);
      setHabits(habitsRes.data ?? []);
      setLoading(false);
    }
  }, [user]);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7aa2c4" />}
    >
      <Text style={styles.greeting}>
        {profile?.first_name ? `Hello, ${profile.first_name}` : "Today"}
      </Text>
      <Text style={styles.date}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tasks ({tasks.length})</Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : tasks.length === 0 ? (
          <Text style={styles.emptyText}>No tasks due today</Text>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.card}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.cardMeta}>
                {task.priority} {task.due_date ? `· ${task.due_date}` : ""}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Habits ({habits.length})</Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : habits.length === 0 ? (
          <Text style={styles.emptyText}>No habits tracked</Text>
        ) : (
          habits.map((habit) => (
            <View key={habit.id} style={styles.card}>
              <Text style={styles.cardTitle}>{habit.title}</Text>
              <Text style={styles.cardMeta}>{habit.frequency}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.proof}>
        Same account, same data, same RLS protection.
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
  },
  greeting: {
    fontSize: 28,
    fontWeight: "600",
    color: "#f0f4f8",
  },
  date: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  section: {
    marginTop: 32,
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
  loadingText: {
    color: "#4b5563",
    fontSize: 13,
  },
  emptyText: {
    color: "#4b5563",
    fontSize: 13,
  },
  proof: {
    color: "#374151",
    fontSize: 11,
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
  },
});
