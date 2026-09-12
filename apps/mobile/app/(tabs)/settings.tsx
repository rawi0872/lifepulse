import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link, useRouter } from "expo-router";
import Constants from "expo-constants";
import { spacing, radii, type } from "../../lib/theme";
import type { ThemeColors, ThemeMode } from "../../lib/theme";
import { useLifePulseTheme } from "../../lib/theme-provider";
import { ChevronRight, BellIcon, MoonIcon, HealthIcon } from "../../src/icons";
import { ScreenHeader, SectionLabel, MenuRow, BackLink } from "../../src/components/ui";

const APPEARANCE_OPTIONS: Array<{ value: ThemeMode; label: string; hint: string }> = [
  { value: "system", label: "System", hint: "Follows device" },
  { value: "light", label: "Light", hint: "Warm Human" },
  { value: "dark", label: "Dark", hint: "Signature Pulse" },
];

/**
 * Settings — app preferences and permissions. Only surfaces what exists
 * today; rows without a destination are honest static rows, not dead ends.
 * Reached from the More hub; not a permanent tab.
 */
export default function SettingsScreen() {
  const { colors, mode, resolvedMode, setMode } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const version = (Constants.expoConfig?.version as string) ?? "0.1.7";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BackLink label="More" onPress={() => router.back()} />

      <ScreenHeader title="Settings" sub="How Life Pulse behaves on this device." />

      <SectionLabel>PREFERENCES</SectionLabel>
      <MenuRow
        icon={<BellIcon size={20} color={colors.accent} />}
        title="Notifications"
        meta="Managed in system settings"
        accessibilityLabel="Notifications, managed in system settings"
      />

      <View style={styles.appearanceCard} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
        <View style={styles.appearanceHead}>
          <View style={styles.appearanceIcon}>
            <MoonIcon size={20} color={colors.accent} />
          </View>
          <View style={styles.appearanceTitles}>
            <Text style={styles.appearanceTitle}>Appearance</Text>
            <Text style={styles.appearanceMeta}>
              {mode === "system" ? `System · now ${resolvedMode}` : mode === "light" ? "Light · Warm Human" : "Dark · Signature Pulse"}
            </Text>
          </View>
        </View>
        <View style={styles.segment}>
          {APPEARANCE_OPTIONS.map((opt) => {
            const selected = mode === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setMode(opt.value)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Appearance ${opt.label}`}
              >
                <View style={[styles.dot, selected && styles.dotSelected]} />
                <View style={styles.optionBody}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{opt.label}</Text>
                  <Text style={styles.optionHint}>{opt.hint}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <SectionLabel>CONNECTIONS</SectionLabel>
      <Link href="/health" asChild>
        <MenuRow
          icon={<HealthIcon size={20} color={colors.accent} />}
          title="Health Connections"
          meta="Manage connected health sources"
          chevron={<ChevronRight size={18} color={colors.textMuted} />}
          accessibilityLabel="Open Health Connections"
        />
      </Link>

      <SectionLabel>ABOUT</SectionLabel>
      <MenuRow title="Life Pulse" meta={`v${version} · Alpha`} />
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },
    appearanceCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    appearanceHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
    appearanceIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    appearanceTitles: { flex: 1 },
    appearanceTitle: { ...type.item, color: colors.textPrimary },
    appearanceMeta: { ...type.meta, color: colors.textMuted, marginTop: 2 },
    segment: { flexDirection: "row", gap: spacing.sm },
    option: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      minHeight: 56,
    },
    optionSelected: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
    dot: { width: 12, height: 12, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.textMuted },
    dotSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    optionBody: { flex: 1 },
    optionLabel: { ...type.caption, color: colors.textSecondary, fontWeight: "700" },
    optionLabelSelected: { color: colors.textPrimary },
    optionHint: { ...type.caption, color: colors.textMuted, fontSize: 10, marginTop: 1 },
  });
}
