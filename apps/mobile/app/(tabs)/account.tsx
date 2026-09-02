import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Share } from "react-native";
import { Link } from "expo-router";
import Constants from "expo-constants";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors, spacing, radii, type } from "../../lib/theme";
import { ChevronRight, Logout, BellIcon, MoonIcon, HealthIcon, Send } from "../../src/icons";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
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
    const version = (Constants.expoConfig?.version as string) ?? "0.1.7";
    const message = `Life Pulse Alpha feedback\n\nVersion: ${version} (Alpha)\n\n1. What confused you?\n2. What was useful?\n3. What looked unfinished?\n4. Was anything slow or broken?\n5. Would you use Life Pulse again tomorrow?\n6. What one thing would make it more useful?\n`;
    try {
      await Share.share({ message, title: "Life Pulse Alpha feedback" });
    } catch {
      // Share cancelled or unavailable — no error shown to tester
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName?.[0]?.toUpperCase() || "L"}</Text>
        </View>
        <View style={styles.profileBody}>
          <Text style={styles.profileTitle}>{displayName || "Life Pulse member"}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? "—"}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>CONNECTIONS</Text>
      <Link href="/health" asChild>
        <TouchableOpacity style={styles.row} activeOpacity={0.7}>
          <View style={styles.rowIcon}>
            <HealthIcon size={20} color={colors.accent} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Health Connections</Text>
            <Text style={styles.rowMeta}>Manage connected health sources</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Link>

      <Text style={styles.sectionTitle}>PREFERENCES</Text>
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <BellIcon size={20} color={colors.accent} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>Notifications</Text>
          <Text style={styles.rowMeta}>Manage notification preferences</Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <MoonIcon size={20} color={colors.accent} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>Appearance</Text>
          <Text style={styles.rowMeta}>Dark mode (system default)</Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>

      <Text style={styles.sectionTitle}>SUPPORT</Text>
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleFeedback}>
        <View style={styles.rowIcon}>
          <Send size={20} color={colors.accent} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>Send Alpha feedback</Text>
          <Text style={styles.rowMeta}>Share via WhatsApp, email, etc. — your choice</Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
        <Logout size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Life Pulse v0.1.7 · Alpha</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.xl,
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

  sectionTitle: {
    ...type.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 60,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1 },
  rowTitle: { ...type.item, color: colors.textPrimary },
  rowMeta: { ...type.meta, color: colors.textMuted, marginTop: 2 },

  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: radii.md,
    paddingVertical: 14,
    minHeight: 52,
    marginTop: spacing.xl,
  },
  signOutText: { ...type.item, color: colors.danger, fontWeight: "600" },

  footer: { ...type.caption, color: colors.textFaint, textAlign: "center", marginTop: spacing.lg },
});
