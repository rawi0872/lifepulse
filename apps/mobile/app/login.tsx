import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { Link, Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { colors, spacing, radii, type } from "../lib/theme";
import { getRememberedEmail, setRememberedEmail, normalizeEmail } from "../lib/remembered-email";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <View style={styles.eyeOuter}>
      <View style={styles.eyeInner}>
        <View style={styles.eyePupil} />
      </View>
      {!open && <View style={styles.eyeSlash} />}
    </View>
  );
}

export default function LoginScreen() {
  const { signIn, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill the email from the last successful sign-in (never the password).
  useEffect(() => {
    let active = true;
    void getRememberedEmail().then((saved) => {
      if (active && saved) setEmail(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  // Already authenticated → go straight to Today (no login form)
  if (session) {
    return <Redirect href="/(tabs)/today" />;
  }

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizeEmail(email);
      const result = await signIn(normalized, password);
      if (result.error) {
        setError(result.error);
      } else {
        void setRememberedEmail(normalized);
      }
    } catch {
      setError("Couldn't sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            {/* eslint-disable-next-line @typescript-eslint/no-require-imports, jsx-a11y/alt-text */}
            <Image source={require("../assets/icon.png")} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Life Pulse account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, error && !email.trim() ? styles.inputError : null]}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              importantForAutofill="yes"
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Link href="/forgot-password" asChild>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, error && !password ? styles.inputError : null]}
placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError(null);
                }}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="current-password"
                importantForAutofill="yes"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <EyeIcon open={showPassword} />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{loading ? "Signing in…" : "Sign in"}</Text>
          </TouchableOpacity>

          {loading ? <Text style={styles.hint}>This should take just a moment.</Text> : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Same account as web. No separate mobile identity.</Text>
          <Text style={styles.footerSub}>
            No account? <Link href="/signup" style={styles.footerLink}>Sign up</Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  logoImage: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
  },
  title: {
    ...type.screen,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    ...type.caption,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotLink: {
    ...type.caption,
    color: colors.accent,
    fontWeight: "500",
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.danger,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  eyeButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 0,
    borderTopRightRadius: radii.md,
    borderBottomRightRadius: radii.md,
    width: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  eyeOuter: {
    width: 22,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  eyeInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  eyePupil: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  eyeSlash: {
    position: "absolute",
    width: 24,
    height: 1.5,
    backgroundColor: colors.textMuted,
    transform: [{ rotate: "-35deg" }],
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  hint: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: -4,
  },
  footer: {
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  footerText: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  footerSub: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
  footerLink: {
    color: colors.accent,
    fontWeight: "600",
  },
});
