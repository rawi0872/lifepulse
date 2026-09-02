import { Tabs, Redirect } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { colors, spacing } from "../../lib/theme";
import { Home, NextronIcon, ChecklistIcon, Habits, Account } from "../../src/icons";

// Single source of truth — screens use NAV_BAR_HEIGHT for spacing when needed.
export const NAV_BAR_HEIGHT = 60;

type TabKey = "today" | "nextron" | "tasks" | "habits" | "account";

const TABS: Record<TabKey, { Icon: React.FC<{ size?: number; color?: string }>; label: string }> = {
  today: { Icon: Home, label: "Today" },
  nextron: { Icon: NextronIcon, label: "NEXTRON" },
  tasks: { Icon: ChecklistIcon, label: "Tasks" },
  habits: { Icon: Habits, label: "Habits" },
  account: { Icon: Account, label: "Account" },
};

function LifePulseTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.divider} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tab = TABS[route.name as TabKey] ?? TABS.today;
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
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  divider: {
    // subtle top divider already via borderTop; no extra view needed but kept for visual stack clarity
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
    borderRadius: 8,
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
