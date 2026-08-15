import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

interface Habit {
  id: string;
  title: string;
  frequency: string;
  description: string | null;
}

export default function HabitsScreen() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const loadHabits = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("habits")
      .select("id, title, frequency, description")
      .eq("user_id", user.id)
      .order("title", { ascending: true });

    if (mountedRef.current) {
      setHabits(data ?? []);
      setLoading(false);
    }
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7aa2c4" />}
    >
      <Text style={styles.title}>Habits</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tracked ({habits.length})</Text>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : habits.length === 0 ? (
          <Text style={styles.emptyText}>No habits tracked</Text>
        ) : (
          habits.map((habit) => (
            <View key={habit.id} style={styles.card}>
              <Text style={styles.cardTitle}>{habit.title}</Text>
              <Text style={styles.cardMeta}>{habit.frequency}</Text>
              {habit.description && (
                <Text style={styles.cardDesc}>{habit.description}</Text>
              )}
            </View>
          ))
        )}
      </View>
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
  cardDesc: {
    color: "#4b5563",
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
