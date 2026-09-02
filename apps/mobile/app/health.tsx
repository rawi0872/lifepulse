import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Link, Stack } from "expo-router";
import { healthStatusLabel } from "../lib/health";
import {
  checkHealthConnectAvailability,
  getGrantedStepsPermission,
  requestStepsPermission,
  openSystemHealthSettings,
} from "../lib/health-connect-adapter";
import { getStorageConsent, setStepsConsent, syncTodaySteps } from "../lib/health-sync";
import { useAuth } from "../lib/auth";
import { colors, spacing, radii } from "../lib/theme";

type Availability = "available" | "unavailable" | "not_configured";

export default function HealthScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<Availability>("unavailable");
  const [stepsPermission, setStepsPermission] = useState<"allowed" | "not_allowed" | "unknown">("unknown");
  const [stepsConsent, setStepsConsentState] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (Platform.OS === "android") {
        const avail = await checkHealthConnectAvailability();
        setAvailability(avail as Availability);
        const perm = await getGrantedStepsPermission();
        setStepsPermission(perm.granted.length > 0 ? "allowed" : "not_allowed");
      } else {
        setAvailability("unavailable");
        setStepsPermission("not_allowed");
      }
      const consent = await getStorageConsent();
      setStepsConsentState(consent?.stepsAllowed ?? false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function handleConnect() {
    if (Platform.OS !== "android") return;
    setLoading(true);
    try {
      const result = await requestStepsPermission();
      setStepsPermission(result.granted.length > 0 ? "allowed" : "not_allowed");
      if (result.granted.length === 0) {
        openSystemHealthSettings();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleConsent(next: boolean) {
    const ok = await setStepsConsent(next);
    if (ok) setStepsConsentState(next);
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncMessage(null);
    setSyncOk(null);
    try {
      const result = await syncTodaySteps();
      setSyncOk(result.ok);
      if (result.ok) {
        const ts = new Date().toLocaleTimeString();
        setLastSyncedAt(ts);
        setSyncMessage(
          result.insertedCount && result.insertedCount > 0
            ? `Synced today's steps.`
            : "No steps data for today yet.",
        );
      } else {
        const reasonMap: Record<string, string> = {
          CONSENT_REQUIRED: "Turn on 'Sync steps into Life Pulse' first.",
          PERMISSION_REQUIRED: "Allow Steps access in Health Connect first.",
          HC_UNAVAILABLE: "Health Connect is not available on this device.",
          PLATFORM_UNSUPPORTED: "Only supported on Android.",
          SOURCE_UNAVAILABLE: "Could not create the Health Connect source.",
          AUTH_REQUIRED: "Sign in to sync.",
        };
        setSyncMessage(reasonMap[result.reason ?? ""] ?? "Sync failed. Try again.");
      }
    } catch {
      setSyncOk(false);
      setSyncMessage("Unexpected sync error.");
    } finally {
      setSyncing(false);
    }
  }

  const hcStatusText =
    availability === "available"
      ? stepsPermission === "allowed"
        ? "Connected"
        : "Available — permission not granted"
      : availability === "not_configured"
        ? "Needs provider update"
        : healthStatusLabel(availability);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Health", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }} />
      <Text style={styles.title}>Health Connections</Text>
      <Text style={styles.subtitle}>Connect Apple Health or Health Connect when you choose. Life Pulse stores only what you explicitly allow.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Apple Health</Text>
        <Text style={styles.cardStatus}>{Platform.OS === "ios" ? "Not configured" : "Unavailable on this platform"}</Text>
        <Text style={styles.cardDetail}>HealthKit is read on-device and will be added separately. The server does not fetch Apple Health as a cloud API.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Connect</Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
        ) : Platform.OS === "android" ? (
          <>
            <Text style={[styles.cardStatus, availability === "available" && stepsPermission === "allowed" && styles.statusConnected]}>{hcStatusText}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Steps permission</Text>
              <Text style={[styles.detailValue, stepsPermission === "allowed" ? styles.valueAllowed : styles.valueDenied]}>
                {stepsPermission === "allowed" ? "Allowed" : stepsPermission === "not_allowed" ? "Not allowed" : "Unknown"}
              </Text>
            </View>
            {stepsPermission !== "allowed" && availability !== "unavailable" && (
              <TouchableOpacity style={styles.actionButton} onPress={() => void handleConnect()} disabled={loading}>
                <Text style={styles.actionButtonText}>Allow Steps Access</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.cardStatus}>{hcStatusText}</Text>
            <Text style={styles.cardDetail}>Requires Android with Health Connect installed.</Text>
          </>
        )}
      </View>

      {Platform.OS === "android" && availability !== "unavailable" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Life Pulse storage</Text>
          <View style={styles.consentRow}>
            <Text style={styles.detailLabel}>Sync steps into Life Pulse</Text>
            <TouchableOpacity
              style={[styles.toggleButton, stepsConsent ? styles.toggleOn : styles.toggleOff]}
              onPress={() => void handleToggleConsent(!stepsConsent)}
              disabled={loading}
            >
              <Text style={styles.toggleText}>{stepsConsent ? "On" : "Off"}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardDetail}>
            OS permission is separate from this setting. Turning it off stops future ingestion; already-stored records remain.
          </Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last synced</Text>
            <Text style={styles.detailValue}>{lastSyncedAt ?? "Never"}</Text>
          </View>

          <TouchableOpacity
            style={[styles.syncButton, syncing || !stepsConsent ? styles.buttonDisabled : null]}
            onPress={() => void handleSyncNow()}
            disabled={syncing || !stepsConsent}
          >
            {syncing ? (
              <ActivityIndicator color="#071018" />
            ) : (
              <Text style={styles.syncButtonText}>{stepsConsent ? "Sync now" : "Enable storage to sync"}</Text>
            )}
          </TouchableOpacity>

          {syncMessage ? <Text style={[styles.syncMessage, syncOk === true ? styles.messageOk : syncOk === false ? styles.messageError : null]}>{syncMessage}</Text> : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>NEXTRON health access</Text>
        <Text style={[styles.cardStatus, { color: colors.textMuted }]}>Off</Text>
        <Text style={styles.cardDetail}>Connecting a health source does not automatically allow NEXTRON to read health data. You will choose separately.</Text>
      </View>

      <Text style={styles.footer}>AI interprets. Life Pulse verifies. You authorize. No background health sync or notifications in this phase.</Text>
      <Link href="/(tabs)/account" style={styles.backLink}>
        Back to Account
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  cardTitle: { fontSize: 13, fontWeight: "600", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  cardStatus: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginTop: 6 },
  statusConnected: { color: colors.success },
  cardDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 16 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  detailLabel: { fontSize: 13, color: colors.textSecondary },
  detailValue: { fontSize: 13, color: colors.textPrimary, fontWeight: "500" },
  valueAllowed: { color: colors.success },
  valueDenied: { color: colors.warning },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  actionButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: "700" },
  consentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  toggleButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 56,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleOn: { backgroundColor: colors.success },
  toggleOff: { backgroundColor: colors.surfaceElevated },
  toggleText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  syncButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
    minHeight: 44,
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.45 },
  syncButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: "700" },
  syncMessage: { fontSize: 12, marginTop: 10, textAlign: "center", lineHeight: 16 },
  messageOk: { color: colors.success },
  messageError: { color: colors.warning },
  footer: { fontSize: 11, color: colors.textFaint, textAlign: "center", marginTop: 24, lineHeight: 14 },
  backLink: { color: colors.accent, fontSize: 13, textAlign: "center", marginTop: 16 },
});
