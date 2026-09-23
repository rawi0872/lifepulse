import { Platform } from "react-native";

// Canonical web destinations shared by mobile entry points (parity with
// web dynamic-origin links). Production default matches the deployed web
// app; local dev can override via EXPO_PUBLIC_WEB_URL.
export function getWebBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL || process.env.EXPO_PUBLIC_NEXT_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (__DEV__) {
    return Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";
  }
  return "https://lifepulse-sand.vercel.app";
}

export function getPasswordResetRedirect(): string {
  return `${getWebBaseUrl()}/reset-password`;
}
