import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Link, Stack } from "expo-router";
import { healthStatusLabel } from "../lib/health";
import {
  checkHealthConnectAvailability,
  getGrantedHealthPermissions,
  requestHealthPermissions,
  openSystemHealthSettings,
} from "../lib/health-connect-adapter";
import { getStorageConsent, setMetricConsent, syncSelectedHealthMetrics } from "../lib/health-sync";
import { useAuth } from "../lib/auth";
import { colors, spacing, radii } from "../lib/theme";
import type { HealthMetricType } from "@lifepulse/domain";

type Availability = "available" | "unavailable" | "not_configured";

const GROUPS: Array<{ title: string; metrics: Array<{ key: HealthMetricType; label: string }> }> = [
  { title: "Activity", metrics: [{ key: "steps", label: "Steps" }, { key: "exercise_minutes", label: "Exercise" }] },
  { title: "Recovery", metrics: [{ key: "sleep_duration", label: "Sleep" }, { key: "resting_heart_rate", label: "Resting heart rate" }] },
  { title: "Body", metrics: [{ key: "weight", label: "Weight" }] },
];

export default function HealthScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<Availability>("unavailable");
  const [granted, setGranted] = useState<HealthMetricType[]>([]);
  const [allowed, setAllowed] = useState<HealthMetricType[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (Platform.OS === "android") {
        const avail = await checkHealthConnectAvailability();
        setAvailability(avail as Availability);
        const perm = await getGrantedHealthPermissions();
        setGranted(perm.granted as HealthMetricType[]);
      } else {
        setAvailability("unavailable");
        setGranted([]);
      }
      const consent = await getStorageConsent();
      setAllowed((consent?.allowedMetrics as HealthMetricType[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const handleToggle = async (metric: HealthMetricType, next: boolean) => {
    if (next) {
      // storage consent requires native permission first
      const hasPerm = granted.includes(metric);
      if (!hasPerm && Platform.OS === "android") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await requestHealthPermissions([metric as any]);
        setGranted(result.granted as HealthMetricType[]);
        if (!result.granted.includes(metric)) {
          // denied — do not enable storage
          setSyncMessage(`Permission for ${metric} denied. You can retry later.`);
          return;
        }
      }
    }
    const ok = await setMetricConsent(metric, next);
    if (ok) setAllowed((prev) => (next ? [...prev, metric] : prev.filter((m) => m !== metric)));
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const selected = allowed;
      if (selected.length === 0) { setSyncMessage("Enable at least one metric to sync."); setSyncing(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { results } = await syncSelectedHealthMetrics(selected as any);
      const synced = results.filter((r) => r.status === "synced").length;
      const noData = results.filter((r) => r.status === "no_data").length;
      if (synced > 0) setSyncMessage(`${synced} synced${noData ? ` · ${noData} had no data` : ""}`);
      else if (noData === results.length) setSyncMessage("No new data for selected metrics.");
      else setSyncMessage(results.map((r) => `${r.metric}: ${r.status}`).join(" · "));
    } catch {
      setSyncMessage("Sync failed. Try again.");
    } finally { setSyncing(false); }
  };

  const hcStatus = availability === "available" ? "Health Connect available" : availability === "not_configured" ? "Needs provider update" : healthStatusLabel(availability);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Health", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }} />
      <Text style={styles.title}>Health Connections</Text>
      <Text style={styles.subtitle}>Life Pulse reads only what you explicitly allow. Storage and NEXTRON access are separate.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Apple Health</Text>
        <Text style={styles.cardStatus}>{Platform.OS === "ios" ? "Not configured" : "Unavailable on this platform"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Connect</Text>
        {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : <Text style={styles.cardStatus}>{hcStatus}</Text>}
        {Platform.OS === "android" && availability !== "unavailable" && !loading ? (
          <TouchableOpacity style={styles.actionButton} onPress={() => openSystemHealthSettings()}>
            <Text style={styles.actionButtonText}>Open Health Connect settings</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {GROUPS.map((g) => (
        <View key={g.title} style={styles.card}>
          <Text style={styles.cardTitle}>{g.title}</Text>
          {g.metrics.map((m) => {
            const permGranted = granted.includes(m.key);
            const consentOn = allowed.includes(m.key);
            return (
              <View key={m.key} style={styles.metricRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>{m.label}</Text>
                  <Text style={styles.metricSub}>
                    Permission {permGranted ? "granted" : "not granted"} · Storage {consentOn ? "on" : "off"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleButton, consentOn ? styles.toggleOn : styles.toggleOff]}
                  onPress={() => void handleToggle(m.key, !consentOn)}
                  disabled={loading}
                >
                  <Text style={styles.toggleText}>{consentOn ? "On" : "Off"}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync</Text>
        <TouchableOpacity style={[styles.syncButton, syncing && styles.buttonDisabled]} onPress={handleSync} disabled={syncing}>
          {syncing ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.syncButtonText}>Sync now</Text>}
        </TouchableOpacity>
        {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
        <Text style={styles.cardDetail}>Syncs only metrics you have enabled. One metric failing does not affect others.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>NEXTRON health access</Text>
        <Text style={[styles.cardStatus, { color: colors.textMuted }]}>Off by default</Text>
        <Text style={styles.cardDetail}>Enable storage first, then grant NEXTRON access separately in Body settings.</Text>
      </View>

      <Link href="/(tabs)/account" style={styles.backLink}>Back to Account</Link>
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
  cardStatus: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginTop: 6 },
  cardDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 16 },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 },
  metricSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  detailLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: "500" },
  actionButton: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  actionButtonText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  toggleButton: { borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 8, minWidth: 56, minHeight: 36, justifyContent: "center", alignItems: "center" },
  toggleOn: { backgroundColor: colors.success },
  toggleOff: { backgroundColor: colors.surfaceElevated },
  toggleText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  syncButton: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 12, alignItems: "center", marginTop: 14, minHeight: 44, justifyContent: "center" },
  buttonDisabled: { opacity: 0.45 },
  syncButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: "700" },
  syncMessage: { fontSize: 12, marginTop: 10, textAlign: "center", color: colors.textSecondary },
  backLink: { color: colors.accent, fontSize: 13, textAlign: "center", marginTop: 16 },
});
