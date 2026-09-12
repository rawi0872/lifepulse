import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "../lib/supabase";
import { colors, spacing, radii, type } from "../lib/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://lifepulse-sand.vercel.app/reset-password",
      });
      if (resetError) {
        setSent(true);
        return;
      }
      setSent(true);
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>Enter the email for your Life Pulse account. If an account exists, we&apos;ll send a reset link.</Text>
        </View>

        {sent ? (
          <View style={styles.sentBox}>
            <Text style={styles.sentText}>If an account exists for that email, we sent a password reset link.</Text>
            <Link href="/login" asChild>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Back to login</Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{loading ? "Sending…" : "Send reset link"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!sent ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Remember your password? <Link href="/login" style={styles.footerLink}>Sign in</Link>
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingTop: 48, paddingBottom: 32 },
  header: { alignItems: "center", marginBottom: spacing.xxl },
  title: { ...type.screen, color: colors.textPrimary, textAlign: "center" },
  subtitle: { ...type.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 18 },
  form: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { ...type.caption, color: colors.textSecondary, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 48,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center", lineHeight: 18 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: "700" },
  sentBox: { gap: spacing.lg },
  sentText: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  footer: { alignItems: "center", marginTop: spacing.xl },
  footerText: { ...type.caption, color: colors.textMuted, textAlign: "center" },
  footerLink: { color: colors.accent, fontWeight: "600" },
});
