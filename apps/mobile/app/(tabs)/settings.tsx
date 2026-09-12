import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Link, useRouter } from "expo-router";
import Constants from "expo-constants";
import { colors, spacing, radii, type } from "../../lib/theme";
import { ChevronRight, BellIcon, MoonIcon, HealthIcon } from "../../src/icons";

/**
 * Settings — app preferences and permissions. Only surfaces what exists
 * today; rows without a destination are honest static rows, not dead ends.
 * Reached from the More hub; not a permanent tab.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const version = (Constants.expoConfig?.version as string) ?? "0.1.7";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.back}
        onPress={() => router.back()}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Back to More"
      >
        <Text style={styles.backText}>‹ More</Text>
      </TouchableOpacity>

      <Text style={styles.greeting}>Settings</Text>
      <Text style={styles.sub}>How Life Pulse behaves on this device.</Text>

      <Text style={styles.sectionTitle}>PREFERENCES</Text>
      <View style={styles.row} accessibilityRole="text" accessibilityLabel="Notifications, managed in system settings">
        <View style={styles.rowIcon}>
          <BellIcon size={20} color={colors.accent} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>Notifications</Text>
          <Text style={styles.rowMeta}>Managed in system settings</Text>
        </View>
      </View>

      <View style={styles.row} accessibilityRole="text" accessibilityLabel="Appearance, dark mode follows system">
        <View style={styles.rowIcon}>
          <MoonIcon size={20} color={colors.accent} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>Appearance</Text>
          <Text style={styles.rowMeta}>Dark mode (system default)</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>CONNECTIONS</Text>
      <Link href="/health" asChild>
        <TouchableOpacity style={styles.row} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open Health Connections">
          <View style={styles.rowIcon}>
            <HealthIcon size={20} color={colors.accent} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Health Connections</Text>
            <Text style={styles.rowMeta}>Manage connected health sources</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Link>

      <Text style={styles.sectionTitle}>ABOUT</Text>
      <View style={styles.row}>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>Life Pulse</Text>
          <Text style={styles.rowMeta}>v{version} · Alpha</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },

  back: { alignSelf: "flex-start", paddingVertical: spacing.sm, paddingRight: spacing.lg, marginBottom: spacing.sm },
  backText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  greeting: { ...type.hero, color: colors.textPrimary },
  sub: { ...type.meta, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm },

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
});
