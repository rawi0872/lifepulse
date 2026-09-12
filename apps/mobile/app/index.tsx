import { useMemo } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import type { ThemeColors } from "../lib/theme";
import { useLifePulseTheme } from "../lib/theme-provider";

export default function Index() {
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/today" />;
  }

  return <Redirect href="/login" />;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
});
}