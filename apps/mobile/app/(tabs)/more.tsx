import React, { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Link } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "../../lib/auth";
import { spacing } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { useLifePulseTheme } from "../../lib/theme-provider";
import { ChevronRight, Settings, Account, Pulse } from "../../src/icons";
import { ScreenHeader, SectionLabel, MenuRow, FooterNote } from "../../src/components/ui";

/**
 * More hub — secondary navigation for less-frequent destinations.
 * Permanent tabs stay at five; Realms, Settings, and Account live here.
 */
export default function MoreScreen() {
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const version = (Constants.expoConfig?.version as string) ?? "0.1.7";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="More" sub="Realms, settings, and your account." />

      <SectionLabel>LIFE AREAS</SectionLabel>
      <Link href="/realms" asChild>
        <MenuRow
          icon={<Pulse size={20} color={colors.accent} />}
          title="Realms"
          meta="Body, Wealth, and what&apos;s next"
          chevron={<ChevronRight size={18} color={colors.textMuted} />}
          accessibilityLabel="Open Realms"
        />
      </Link>

      <SectionLabel>APP</SectionLabel>
      <Link href="/(tabs)/settings" asChild>
        <MenuRow
          icon={<Settings size={20} color={colors.accent} />}
          title="Settings"
          meta="Notifications, appearance, connections"
          chevron={<ChevronRight size={18} color={colors.textMuted} />}
          accessibilityLabel="Open Settings"
        />
      </Link>

      <SectionLabel>ACCOUNT</SectionLabel>
      <Link href="/(tabs)/account" asChild>
        <MenuRow
          icon={<Account size={20} color={colors.accent} />}
          title="Account"
          meta={user?.email ?? "Profile and sign out"}
          chevron={<ChevronRight size={18} color={colors.textMuted} />}
          accessibilityLabel="Open Account"
        />
      </Link>

      <FooterNote>Life Pulse v{version} · Alpha</FooterNote>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },
});
}