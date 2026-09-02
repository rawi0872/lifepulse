import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7aa2c4" />
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
    backgroundColor: "#080c12",
    justifyContent: "center",
    alignItems: "center",
  },
});
