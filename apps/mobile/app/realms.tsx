import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link, Stack } from "expo-router";
import { colors, spacing, radii, type } from "../lib/theme";
import { WealthIcon } from "../src/icons/WealthIcon";
import { Pulse } from "../src/icons";

function BodyGlyph({ color }: { color: string }) {
  // minimal body mark using Pulse
  return <Pulse size={20} color={color} />;
}

export default function RealmsScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Realms", headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }} />
      <Text style={styles.eyebrow}>LIFE AREAS</Text>
      <Text style={styles.title}>Realms</Text>
      <Text style={styles.sub}>Choose a realm to focus your attention.</Text>

      <Link href="/body" asChild>
        <TouchableOpacity style={styles.card} activeOpacity={0.85}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.22)" }]}><BodyGlyph color="#ef4444" /></View>
          <View style={styles.cardBody}><Text style={styles.cardTitle}>Body</Text><Text style={styles.cardDesc}>Fitness, sleep, health</Text></View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </Link>

      <Link href="/wealth" asChild>
        <TouchableOpacity style={styles.card} activeOpacity={0.85}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(14,165,233,0.12)", borderColor: "rgba(14,165,233,0.22)" }]}><WealthIcon size={20} color="#0ea5e9" /></View>
          <View style={styles.cardBody}><Text style={styles.cardTitle}>Wealth</Text><Text style={styles.cardDesc}>Accounts, net worth, cash flow</Text></View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </Link>

      <View style={styles.future}>
        <Text style={styles.futureLabel}>More realms coming</Text>
        <Text style={styles.futureDesc}>Mind · Work · Relationships · Growth — not yet active</Text>
      </View>

      <Link href="/(tabs)/today" asChild><TouchableOpacity style={styles.back} activeOpacity={0.7}><Text style={styles.backText}>Back to Today</Text></TouchableOpacity></Link>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, paddingTop: 56 },
  eyebrow: { ...type.caption, color: colors.textMuted, letterSpacing: 1.6, fontWeight: "700" },
  title: { ...type.screen, color: colors.textPrimary, marginTop: 6 },
  sub: { ...type.body, color: colors.textSecondary, marginTop: 8 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.lg },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cardBody: { flex: 1 },
  cardTitle: { ...type.item, color: colors.textPrimary },
  cardDesc: { ...type.meta, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted, paddingHorizontal: 4 },
  future: { marginTop: spacing.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.02)", borderRadius: radii.md, opacity: 0.7 },
  futureLabel: { ...type.caption, color: colors.textMuted, fontWeight: "600", letterSpacing: 0.6 },
  futureDesc: { ...type.meta, color: colors.textFaint, marginTop: 4 },
  back: { marginTop: spacing.lg, alignItems: "center" },
  backText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
});
