import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { spacing, type } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { useLifePulseTheme } from "../lib/theme-provider";

export default function LoadingScreen() {
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.text}>Loading Life Pulse…</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
  },
  text: {
    ...type.body,
    color: colors.textMuted,
  },
});
}