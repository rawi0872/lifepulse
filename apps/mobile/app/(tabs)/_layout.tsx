import { Tabs, Redirect } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo } from "react";
import { useAuth } from "../../lib/auth";
import { spacing, radii } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { useLifePulseTheme } from "../../lib/theme-provider";
import { Home, NextronIcon, ChecklistIcon, Habits, More } from "../../src/icons";

// Single source of truth — screens use NAV_BAR_HEIGHT for spacing when needed.
export const NAV_BAR_HEIGHT = 60;

type TabKey = "today" | "nextron" | "tasks" | "habits" | "more";

// Account and Settings live under the More hub; they are real routes but
// never permanent tabs, so the bar renders exactly these five entries.
const TABS: Record<TabKey, { Icon: React.FC<{ size?: number; color?: string }>; label: string }> = {
  today: { Icon: Home, label: "Today" },
  nextron: { Icon: NextronIcon, label: "NEXTRON" },
  tasks: { Icon: ChecklistIcon, label: "Tasks" },
  habits: { Icon: Habits, label: "Habits" },
  more: { Icon: More, label: "More" },
};

const TAB_KEYS = Object.keys(TABS) as TabKey[];

// Hidden routes parented under More — visiting one keeps More highlighted.
const MORE_CHILD_ROUTES = new Set(["account", "settings"]);

function LifePulseTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const activeRoute = state.routes[state.index]?.name ?? "today";
  const focusedKey: TabKey = (TAB_KEYS as string[]).includes(activeRoute)
    ? (activeRoute as TabKey)
    : MORE_CHILD_ROUTES.has(activeRoute)
      ? "more"
      : "today";

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.divider} />
      <View style={styles.row}>
        {TAB_KEYS.map((key) => {
          const route = state.routes.find((r) => r.name === key);
          if (!route) return null;
          const isFocused = focusedKey === key;
          const tab = TABS[key];
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              onPress={onPress}
              activeOpacity={0.75}
              style={styles.item}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <tab.Icon size={22} color={isFocused ? colors.accentStrong : colors.textMuted} />
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { session, loading } = useAuth();
  if (!loading && !session) return <Redirect href="/login" />;
  return (
    <Tabs tabBar={(props) => <LifePulseTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="nextron" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="habits" />
      <Tabs.Screen name="more" />
      {/* More-hub children: reachable, never permanent tabs. */}
      <Tabs.Screen name="account" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.navSurface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    divider: {
      height: 0,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      height: NAV_BAR_HEIGHT,
      paddingHorizontal: spacing.sm,
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      minHeight: 44,
    },
    iconWrap: {
      width: 36,
      height: 28,
      borderRadius: radii.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrapActive: {
      backgroundColor: colors.accentSoft,
    },
    label: {
      fontSize: 10,
      fontWeight: "500",
      letterSpacing: 0.2,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.accentStrong,
      fontWeight: "600",
    },
  });
}
