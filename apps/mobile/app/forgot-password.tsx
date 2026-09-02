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
                placeholderTextColor="rgba(240,244,248,0.35)"
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
  container: { flex: 1, backgroundColor: "#080c12" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 },
  header: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 22, fontWeight: "700", color: "#f0f4f8", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 8, lineHeight: 18 },
  form: { gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: "#9ca3af", letterSpacing: 0.3, textTransform: "uppercase" },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f0f4f8",
    fontSize: 15,
    minHeight: 48,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: "#fca5a5", fontSize: 13, textAlign: "center", lineHeight: 18 },
  button: {
    backgroundColor: "#7aa2c4",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#071018", fontSize: 15, fontWeight: "700" },
  sentBox: { gap: 16 },
  sentText: {
    backgroundColor: "rgba(122,162,196,0.08)",
    borderWidth: 1,
    borderColor: "rgba(122,162,196,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: "#9ca3af",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  footer: { alignItems: "center", marginTop: 28 },
  footerText: { color: "#6b7280", fontSize: 12, textAlign: "center" },
  footerLink: { color: "#7aa2c4", fontWeight: "600" },
});
