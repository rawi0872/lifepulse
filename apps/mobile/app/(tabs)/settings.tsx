import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import Constants from "expo-constants";
import { colors, spacing } from "../../lib/theme";
import { ChevronRight, BellIcon, MoonIcon, HealthIcon } from "../../src/icons";
import { ScreenHeader, SectionLabel, MenuRow, BackLink } from "../../src/components/ui";

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
      <BackLink label="More" onPress={() => router.back()} />

      <ScreenHeader title="Settings" sub="How Life Pulse behaves on this device." />

      <SectionLabel>PREFERENCES</SectionLabel>
      <MenuRow
        icon={<BellIcon size={20} color={colors.accent} />}
        title="Notifications"
        meta="Managed in system settings"
        accessibilityLabel="Notifications, managed in system settings"
      />

      <MenuRow
        icon={<MoonIcon size={20} color={colors.accent} />}
        title="Appearance"
        meta="Dark mode (system default)"
        accessibilityLabel="Appearance, dark mode follows system"
      />

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },
});
