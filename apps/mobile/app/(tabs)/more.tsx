import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Link } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "../../lib/auth";
import { colors, spacing, radii, type } from "../../lib/theme";
import { ChevronRight, Settings, Account, Pulse } from "../../src/icons";

/**
 * More hub — secondary navigation for less-frequent destinations.
 * Permanent tabs stay at five; Realms, Settings, and Account live here.
 */
export default function MoreScreen() {
  const { user } = useAuth();
  const version = (Constants.expoConfig?.version as string) ?? "0.1.7";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>More</Text>
        <Text style={styles.sub}>Realms, settings, and your account.</Text>
      </View>

      <Text style={styles.sectionTitle}>LIFE AREAS</Text>
      <Link href="/realms" asChild>
        <TouchableOpacity style={styles.row} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open Realms">
          <View style={styles.rowIcon}>
            <Pulse size={20} color={colors.accent} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Realms</Text>
            <Text style={styles.rowMeta}>Body, Wealth, and what&apos;s next</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Link>

      <Text style={styles.sectionTitle}>APP</Text>
      <Link href="/(tabs)/settings" asChild>
        <TouchableOpacity style={styles.row} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open Settings">
          <View style={styles.rowIcon}>
            <Settings size={20} color={colors.accent} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Settings</Text>
            <Text style={styles.rowMeta}>Notifications, appearance, connections</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Link>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <Link href="/(tabs)/account" asChild>
        <TouchableOpacity style={styles.row} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open Account">
          <View style={styles.rowIcon}>
            <Account size={20} color={colors.accent} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Account</Text>
            <Text style={styles.rowMeta}>{user?.email ?? "Profile and sign out"}</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Link>

      <Text style={styles.footer}>Life Pulse v{version} · Alpha</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },

  header: { marginBottom: spacing.md, paddingTop: spacing.sm },
  greeting: { ...type.hero, color: colors.textPrimary },
  sub: { ...type.meta, color: colors.textSecondary, marginTop: spacing.xs },

  sectionTitle: {
    ...type.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 60,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1 },
  rowTitle: { ...type.item, color: colors.textPrimary },
  rowMeta: { ...type.meta, color: colors.textMuted, marginTop: 2 },

  footer: { ...type.caption, color: colors.textFaint, textAlign: "center", marginTop: spacing.xl },
});
