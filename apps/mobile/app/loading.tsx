import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7aa2c4" />
      <Text style={styles.text}>Loading Life Pulse...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080c12",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  text: {
    color: "#6b7280",
    fontSize: 14,
  },
});
