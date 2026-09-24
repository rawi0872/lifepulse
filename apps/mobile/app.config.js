module.exports = () => {
  return {
    expo: {
      name: "Life Pulse",
      slug: "lifepulse-mobile",
      version: "0.6.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#080c12"
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: "app.lifepulse.mobile",
        infoPlist: {
          NSHealthShareUsageDescription: "Life Pulse reads sleep, steps, and heart rate from Apple Health only when you choose to connect. Data stays private and is not shared with NEXTRON without separate permission."
        },
        entitlements: {
          "com.apple.developer.healthkit": true
        }
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#080c12"
        },
        package: "app.lifepulse.mobile",
        versionCode: 15,
        permissions: [
          "android.permission.health.READ_STEPS",
          "android.permission.health.READ_SLEEP",
          "android.permission.health.READ_RESTING_HEART_RATE",
          "android.permission.health.READ_WEIGHT",
          "android.permission.health.READ_EXERCISE"
        ],
        blockedPermissions: [
          "android.permission.READ_EXTERNAL_STORAGE",
          "android.permission.WRITE_EXTERNAL_STORAGE",
          "android.permission.SYSTEM_ALERT_WINDOW"
        ]
      },
      plugins: [
        "expo-router",
        "react-native-health-connect",
        [
          "expo-build-properties",
          {
            android: {
              minSdkVersion: 26
            }
          }
        ],
        "expo-asset",
        "expo-font"
      ],
      extra: {
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://pvmrpknuvqsxdzoeowmh.supabase.co",
        supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2bXJwa251dnFzeGR6b2Vvd21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTE5NjIsImV4cCI6MjA5MTU4Nzk2Mn0.ZGqostjk_uZuUNraezG6UyekTs2TIYMxyBcqC1WI4a4"
      }
    }
  };
};