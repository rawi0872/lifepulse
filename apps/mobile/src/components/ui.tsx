import React, { useState } from "react";
import { View, Text, TouchableOpacity, Pressable, TextInput, StyleSheet } from "react-native";
import type { TextInputProps } from "react-native";
import { colors, spacing, radii, type } from "../../lib/theme";

// ---------------------------------------------------------------------------
// Life Pulse shared interface kit (Prompt 2 visual system).
// Small, token-driven primitives: headers, labels, rows, buttons, fields,
// states. Screens compose these instead of redefining one-off styles.
// ---------------------------------------------------------------------------

export function ScreenHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={kit.header}>
      <Text style={kit.title}>{title}</Text>
      {sub ? <Text style={kit.sub}>{sub}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "muted" | "danger" }) {
  return (
    <Text style={[kit.sectionLabel, tone === "muted" && kit.sectionLabelMuted, tone === "danger" && kit.sectionLabelDanger]}>{children}</Text>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={kit.back}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
    >
      <Text style={kit.backText}>‹ {label}</Text>
    </TouchableOpacity>
  );
}

interface MenuRowProps {
  icon?: React.ReactNode;
  title: string;
  meta?: string;
  chevron?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function MenuRow({ icon, title, meta, chevron, onPress, accessibilityLabel }: MenuRowProps) {
  const body = (
    <>
      {icon ? <View style={kit.rowIcon}>{icon}</View> : null}
      <View style={kit.rowBody}>
        <Text style={kit.rowTitle}>{title}</Text>
        {meta ? <Text style={kit.rowMeta}>{meta}</Text> : null}
      </View>
      {chevron}
    </>
  );
  if (!onPress) {
    return (
      <View style={kit.row} accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? title}>
        {body}
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={kit.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {body}
    </TouchableOpacity>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  accessibilityLabel?: string;
}

export function PrimaryButton({ label, onPress, disabled, pending, pendingLabel, accessibilityLabel }: ButtonProps) {
  const off = disabled || pending;
  return (
    <Pressable
      style={({ pressed }) => [kit.primary, pressed && !off && kit.pressed, off && kit.disabled]}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={kit.primaryLabel}>{pending ? (pendingLabel ?? "Saving…") : label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, accessibilityLabel }: Omit<ButtonProps, "pending" | "pendingLabel">) {
  return (
    <Pressable
      style={({ pressed }) => [kit.secondary, pressed && !disabled && kit.pressed, disabled && kit.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={kit.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={kit.fieldLabel}>{children}</Text>;
}

export function FieldInput(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      style={[kit.fieldInput, focused && kit.fieldInputFocused, props.style]}
      placeholderTextColor={props.placeholderTextColor ?? colors.textMuted}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={kit.fieldError}>{children as string}</Text>;
}

export function EmptyState({
  icon,
  title,
  sub,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={kit.emptyState}>
      {icon}
      <Text style={kit.emptyTitle}>{title}</Text>
      <Text style={kit.emptySub}>{sub}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={kit.emptyAction} onPress={onAction} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={kit.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={kit.errorBanner}>
      <Text style={kit.errorText}>{message}</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Retry">
        <Text style={kit.errorRetry}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

export function FooterNote({ children }: { children: React.ReactNode }) {
  return <Text style={kit.footer}>{children}</Text>;
}

const kit = StyleSheet.create({
  header: { paddingTop: spacing.sm, marginBottom: spacing.md },
  title: { ...type.hero, color: colors.textPrimary },
  sub: { ...type.meta, color: colors.textSecondary, marginTop: spacing.xs },

  sectionLabel: {
    ...type.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionLabelMuted: { color: colors.textMuted },
  sectionLabelDanger: { color: colors.danger },

  back: { alignSelf: "flex-start", paddingVertical: spacing.sm, paddingRight: spacing.lg, marginBottom: spacing.sm },
  backText: { color: colors.accent, fontSize: 14, fontWeight: "600" },

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

  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    minHeight: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { ...type.item, color: colors.onAccent, fontWeight: "700" },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: { ...type.item, color: colors.textSecondary, fontWeight: "600" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  fieldLabel: { ...type.caption, color: colors.textSecondary },
  fieldInput: {
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
  fieldInputFocused: { borderColor: colors.accentBorder },
  fieldError: { ...type.meta, color: colors.danger },

  emptyState: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...type.item, color: colors.textSecondary, marginTop: spacing.sm },
  emptySub: { ...type.meta, color: colors.textMuted, textAlign: "center" },
  emptyAction: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  emptyActionText: { ...type.caption, color: colors.accentStrong, fontWeight: "600" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { ...type.caption, color: colors.danger, fontWeight: "600" },
  errorRetry: { ...type.caption, color: colors.textPrimary, fontWeight: "700" },

  footer: { ...type.caption, color: colors.textFaint, textAlign: "center", marginTop: spacing.lg },
});
