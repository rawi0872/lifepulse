import React, { useCallback, useEffect, useState, useMemo } from "react";
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
import { loadNextronHealthPermissions, setNextronHealthMetricPermission } from "../lib/nextron-health-permissions";
import { useAuth } from "../lib/auth";
import { spacing, radii, type } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { useLifePulseTheme } from "../lib/theme-provider";
import type { HealthMetricType } from "@lifepulse/domain";

type Availability = "available" | "unavailable" | "not_configured";

const GROUPS: Array<{ title: string; metrics: Array<{ key: HealthMetricType; label: string }> }> = [
  { title: "Activity", metrics: [{ key: "steps", label: "Steps" }, { key: "exercise_minutes", label: "Exercise" }] },
  { title: "Recovery", metrics: [{ key: "sleep_duration", label: "Sleep" }, { key: "resting_heart_rate", label: "Resting heart rate" }] },
  { title: "Body", metrics: [{ key: "weight", label: "Weight" }] },
];

export default function HealthScreen() {
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<Availability>("unavailable");
  const [granted, setGranted] = useState<HealthMetricType[]>([]);
  const [allowed, setAllowed] = useState<HealthMetricType[]>([]);
  const [nextronAllowed, setNextronAllowed] = useState<HealthMetricType[]>([]);
  const [nextronSchemaAvailable, setNextronSchemaAvailable] = useState(true);
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
      const nx = await loadNextronHealthPermissions();
      setNextronAllowed(nx.nextronAllowed);
      setNextronSchemaAvailable(nx.schemaAvailable);
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
        <Text style={styles.cardTitle}>NEXTRON ACCESS</Text>
        <Text style={styles.cardDetail}>Allow NEXTRON to use selected summarized Body data when answering you. Default off.</Text>
        {!nextronSchemaAvailable ? (
          <Text style={[styles.cardDetail, { color: colors.warning }]}>Update pending — NEXTRON access will be available after the next data update.</Text>
        ) : (
          GROUPS.flatMap((g) => g.metrics).map((m) => {
            const storageOn = allowed.includes(m.key);
            const nxOn = nextronAllowed.includes(m.key);
            const disabled = !storageOn;
            return (
              <View key={`nx-${m.key}`} style={styles.metricRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, disabled && { opacity: 0.5 }]}>{m.label}</Text>
                  <Text style={styles.metricSub}>{disabled ? "Enable storage first" : nxOn ? "NEXTRON can use" : "NEXTRON off"}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleButton, nxOn ? styles.toggleOn : styles.toggleOff, disabled && { opacity: 0.45 }]}
                  disabled={disabled}
                  onPress={async () => {
                    const r = await setNextronHealthMetricPermission(m.key, !nxOn);
                    if (r.ok) setNextronAllowed((prev) => (!nxOn ? [...prev, m.key] : prev.filter((x) => x !== m.key)));
                  }}
                >
                  <Text style={styles.toggleText}>{nxOn ? "On" : "Off"}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <Link href="/(tabs)/account" style={styles.backLink}>Back to Account</Link>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },
  title: { ...type.screen, color: colors.textPrimary },
  subtitle: { ...type.body, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.lg },
  cardTitle: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1.4 },
  cardStatus: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginTop: spacing.sm },
  cardDetail: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 16 },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, gap: spacing.md },
  metricSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  detailLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: "500" },
  actionButton: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: "center", justifyContent: "center", minHeight: 48, marginTop: spacing.sm },
  actionButtonText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  toggleButton: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minWidth: 56, minHeight: 36, justifyContent: "center", alignItems: "center" },
  toggleOn: { backgroundColor: colors.successSoft, borderColor: colors.success },
  toggleOff: {},
  toggleText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  syncButton: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: "center", marginTop: spacing.lg, minHeight: 52, justifyContent: "center" },
  buttonDisabled: { opacity: 0.5 },
  syncButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: "700" },
  syncMessage: { fontSize: 12, marginTop: spacing.sm, textAlign: "center", color: colors.textSecondary },
  backLink: { color: colors.accent, fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: spacing.lg, minHeight: 44 },
});
}