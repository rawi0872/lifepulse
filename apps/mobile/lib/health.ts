import { Platform } from "react-native";

// Platform capability abstraction — no NEXTRON logic, no fake data

export type HealthPlatformStatus = "available" | "unavailable" | "not_configured";

export interface HealthCapability {
  appleHealth: HealthPlatformStatus;
  healthConnect: HealthPlatformStatus;
  nextronHealthAccess: "off" | "on";
}

export function getHealthCapability(): HealthCapability {
  // HealthKit is iOS-only and requires a development build + entitlements.
  // Health Connect is Android-only and requires emulator/device with Health Connect.
  // This spike does not claim connected; it only reports capability.
  const appleHealth: HealthPlatformStatus = Platform.OS === "ios" ? "not_configured" : "unavailable";
  const healthConnect: HealthPlatformStatus = Platform.OS === "android" ? "not_configured" : "unavailable";
  return {
    appleHealth,
    healthConnect,
    nextronHealthAccess: "off",
  };
}

export function healthStatusLabel(status: HealthPlatformStatus): string {
  if (status === "available") return "Available";
  if (status === "not_configured") return "Not connected";
  return "Unavailable on this platform";
}
