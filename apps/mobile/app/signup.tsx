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
import { Link, Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { colors, spacing, radii, type } from "../lib/theme";

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("user already registered") || m.includes("already exists")) return "This email is already registered. Try signing in.";
  if (m.includes("invalid email")) return "Enter a valid email address.";
  if (m.includes("password should be at least")) return "Password must be at least 6 characters.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a moment.";
  if (m.includes("weak password")) return "Password is too weak.";
  if (m.includes("network") || m.includes("fetch") || m.includes("connect")) return "Unable to connect. Check internet.";
  return "Failed to create account. Try again.";
}

export default function SignupScreen() {
  const { session } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/(tabs)/today" />;

  const validate = (): string | null => {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!email.trim()) return "Email is required.";
    if (!email.includes("@") || !email.includes(".")) return "Enter a valid email.";
    if (!password || password.length < 6) return "Password must be at least 6 characters.";
    if (!birthDate) return "Birth date is required (YYYY-MM-DD).";
    const bd = new Date(birthDate);
    if (isNaN(bd.getTime())) return "Enter a valid birth date (YYYY-MM-DD).";
    if (bd > new Date()) return "Birth date cannot be in the future.";
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            birth_date: birthDate,
            display_name: displayName,
          },
        },
      });
      if (signUpError) { setError(friendlyError(signUpError.message)); setLoading(false); return; }
      if (data.session) {
        // Auto-confirmed (email confirmation disabled) — auth state will redirect
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Unable to connect. Check internet.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>Account created. Check your inbox to confirm your email, then return to Life Pulse and sign in.</Text>
            <Text style={styles.hint}>If you don&apos;t see it, check spam. Confirmation keeps your beta access secure.</Text>
          </View>
          <Link href="/login" asChild>
            <TouchableOpacity style={styles.button} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Go to sign in</Text>
            </TouchableOpacity>
          </Link>
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setSuccess(false)} activeOpacity={0.85}>
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Use another email</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.subtitle}>Create your Life Pulse account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>First name</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} autoComplete="given-name" editable={!loading} placeholder="Jane" placeholderTextColor={colors.textFaint} />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Last name</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} autoComplete="family-name" editable={!loading} placeholder="Doe" placeholderTextColor={colors.textFaint} />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Birth date</Text>
            <TextInput style={styles.input} value={birthDate} onChangeText={setBirthDate} editable={!loading} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textFaint} autoComplete="birthdate-full" keyboardType="numbers-and-punctuation" />
            <Text style={styles.fieldHint}>Used to personalize setup. Not shown publicly.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" editable={!loading} placeholder="you@example.com" placeholderTextColor={colors.textFaint} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" editable={!loading} placeholder="••••••••" placeholderTextColor={colors.textFaint} />
          </View>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{loading ? "Creating..." : "Create account"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? <Link href="/login" style={styles.footerLink}>Sign in</Link></Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingTop: 48, paddingBottom: 32 },
  header: { alignItems: "center", marginBottom: spacing.xxl },
  title: { ...type.screen, color: colors.textPrimary, textAlign: "center" },
  subtitle: { ...type.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  hint: { ...type.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  form: { gap: spacing.lg },
  field: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md },
  label: { ...type.caption, color: colors.textSecondary },
  fieldHint: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, minHeight: 48 },
  errorBox: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: "rgba(239,68,68,0.15)", borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center", lineHeight: 18 },
  button: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 15, alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: "700" },
  buttonTextSecondary: { color: colors.textPrimary },
  footer: { alignItems: "center", marginTop: spacing.xl },
  footerText: { ...type.caption, color: colors.textMuted, textAlign: "center" },
  footerLink: { color: colors.accent, fontWeight: "600" },
});
