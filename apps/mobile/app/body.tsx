import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { Link, Stack } from "expo-router";
import { colors, spacing, radii } from "../lib/theme";
import { loadBodyDailySummary } from "../lib/body-service";
import type { BodyDailySummary } from "@lifepulse/domain";
import { formatBodyMetricValue } from "@lifepulse/domain";

export default function BodyScreen() {
  const [summary, setSummary] = useState<BodyDailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadBodyDailySummary().then((s) => {
      if (active) { setSummary(s); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Body", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }} />
      <Text style={styles.title}>Body</Text>
      <Text style={styles.subtitle}>Overview — activity, sleep, weight, heart, goals, habits, trends.</Text>

      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}

      {!loading && summary && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today — {summary.date}</Text>
            <Text style={styles.meta}>Freshness: {summary.freshness} · {summary.activityLevel}</Text>
            <View style={styles.grid}>
              {(["steps","sleepDuration","weight","restingHeartRate"] as const).map((k) => {
                const m = summary.metrics[k];
                const display = m.value != null ? formatBodyMetricValue(k, m.value) : "—";
                return (
                  <View key={k} style={styles.metric}>
                    <Text style={styles.metricLabel}>{k}</Text>
                    <Text style={styles.metricValue}>{display}</Text>
                    <Text style={styles.metricQuality}>{m.quality} · {m.source}</Text>
                  </View>
                );
              })}
            </View>
            {summary.missingMetrics.length > 0 ? (
              <Text style={styles.note}>Missing: {summary.missingMetrics.join(", ")} — connect Health or log manually.</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Goals</Text>
            <Text style={styles.note}>Body goals reuse existing goals with realm = Body. Progress appears when a goal has a target metric.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Body habits</Text>
            <Text style={styles.note}>Habits whose realm is Body appear here — due, completed, consistency.</Text>
          </View>

          <Link href="/(tabs)/today" asChild>
            <TouchableOpacity style={styles.link}><Text style={styles.linkText}>Back to Today</Text></TouchableOpacity>
          </Link>
        </>
      )}

      {!loading && !summary ? <Text style={styles.note}>Sign in to view Body.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.lg },
  cardTitle: { fontSize: 13, fontWeight: "600", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: 12 },
  metric: { width: "48%", backgroundColor: colors.surfaceElevated, borderRadius: radii.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontSize: 11, color: colors.textMuted },
  metricValue: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
  metricQuality: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  note: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 16 },
  link: { marginTop: 16, alignItems: "center" },
  linkText: { color: colors.accent, fontSize: 13 },
});
