import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../lib/auth";
import { ThemeProvider, useLifePulseTheme } from "../lib/theme-provider";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useMemo } from "react";

function RootLayoutInner() {
  const { loading } = useAuth();
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="health" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}

function ThemedStatusBar() {
  const { resolvedMode } = useLifePulseTheme();
  return <StatusBar style={resolvedMode === "light" ? "dark" : "light"} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <RootLayoutInner />
      </AuthProvider>
    </ThemeProvider>
  );
}

import type { ThemeColors } from "../lib/theme";

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
