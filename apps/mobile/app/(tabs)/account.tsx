import React, { useEffect, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Share } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { spacing, radii, type } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { useLifePulseTheme } from "../../lib/theme-provider";
import { Logout, Send } from "../../src/icons";
import { SectionLabel, MenuRow, BackLink, FooterNote } from "../../src/components/ui";

export default function AccountScreen() {
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const version = (Constants.expoConfig?.version as string) ?? "0.1.7";
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const displayName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const handleFeedback = async () => {
    const message = `Life Pulse Alpha feedback\n\nVersion: ${version} (Alpha)\n\n1. What confused you?\n2. What was useful?\n3. What looked unfinished?\n4. Was anything slow or broken?\n5. Would you use Life Pulse again tomorrow?\n6. What one thing would make it more useful?\n`;
    try {
      await Share.share({ message, title: "Life Pulse Alpha feedback" });
    } catch {
      // Share cancelled or unavailable — no error shown to tester
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BackLink label="More" onPress={() => router.back()} />

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName?.[0]?.toUpperCase() || "L"}</Text>
        </View>
        <View style={styles.profileBody}>
          <Text style={styles.profileTitle}>{displayName || "Life Pulse member"}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? "—"}</Text>
        </View>
      </View>

      <SectionLabel>SUPPORT</SectionLabel>
      <MenuRow
        icon={<Send size={20} color={colors.accent} />}
        title="Send Alpha feedback"
        meta="Share via WhatsApp, email, etc. — your choice"
        onPress={handleFeedback}
        accessibilityLabel="Send Alpha feedback"
      />

      <SectionLabel>ACCOUNT</SectionLabel>
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Sign out">
        <Logout size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <FooterNote>Life Pulse v{version} · Alpha</FooterNote>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: colors.accentStrong },
  profileBody: { flex: 1 },
  profileTitle: { ...type.item, color: colors.textPrimary, fontSize: 16 },
  profileEmail: { ...type.meta, color: colors.textSecondary, marginTop: 2 },

  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    paddingVertical: 14,
    minHeight: 52,
  },
  signOutText: { ...type.item, color: colors.danger, fontWeight: "600" },
});
}