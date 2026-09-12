import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

export default function Index() {
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
});
