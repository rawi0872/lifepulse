import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Link, Stack } from "expo-router";
import { getHealthCapability, healthStatusLabel } from "../lib/health";

export default function HealthScreen() {
  const cap = getHealthCapability();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Health", headerStyle: { backgroundColor: "#080c12" }, headerTintColor: "#f0f4f8" }} />
      <Text style={styles.title}>Health Connections</Text>
      <Text style={styles.subtitle}>Connect Apple Health or Health Connect when you choose. Life Pulse stores only what you explicitly allow.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Apple Health</Text>
        <Text style={styles.cardStatus}>{healthStatusLabel(cap.appleHealth)}</Text>
        <Text style={styles.cardDetail}>
          {cap.appleHealth === "not_configured" ? "Available on iPhone with a development build. No data is read until you connect." : "HealthKit is read on-device. The server does not fetch Apple Health as a cloud API."}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Connect</Text>
        <Text style={styles.cardStatus}>{healthStatusLabel(cap.healthConnect)}</Text>
        <Text style={styles.cardDetail}>
          {cap.healthConnect === "not_configured"
            ? "Available on Android with Health Connect installed. No data is read until you connect."
            : "Health Connect is read on-device. Requires Android 9+ and Health Connect app."}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>NEXTRON health access</Text>
        <Text style={[styles.cardStatus, { color: "#6b7280" }]}>Off</Text>
        <Text style={styles.cardDetail}>Connecting a health source does not automatically allow NEXTRON to read health data. You will choose separately.</Text>
      </View>

      <Text style={styles.footer}>AI interprets. Life Pulse verifies. You authorize. No health data is used for notifications or background AI in this phase.</Text>
      <Link href="/(tabs)/account" style={styles.backLink}>
        Back to Account
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080c12" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#f0f4f8" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 6, lineHeight: 18 },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  cardTitle: { fontSize: 13, fontWeight: "600", color: "#7aa2c4", textTransform: "uppercase", letterSpacing: 0.5 },
  cardStatus: { fontSize: 14, fontWeight: "600", color: "#f0f4f8", marginTop: 6 },
  cardDetail: { fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 16 },
  footer: { fontSize: 11, color: "#374151", textAlign: "center", marginTop: 24, lineHeight: 14 },
  backLink: { color: "#7aa2c4", fontSize: 13, textAlign: "center", marginTop: 16 },
});
