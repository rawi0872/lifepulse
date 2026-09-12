import React, { useMemo } from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, radii, type } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { useLifePulseTheme } from "../../lib/theme-provider";

interface ConfirmDeleteDialogProps {
  visible: boolean;
  /** Item title named in the confirmation, e.g. Delete “Brush teeth”? */
  itemTitle: string;
  kind: string;
  /** Extra consequence line, e.g. habit history removal. */
  detail?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Explicit destructive confirmation. Never deletes on first tap — the caller
 * only runs the delete after onConfirm. Backdrop/back dismisses cancel.
 * Theme-aware surface, fields, and buttons in both modes.
 */
export function ConfirmDeleteDialog({
  visible,
  itemTitle,
  kind,
  detail,
  pending,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useLifePulseTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={pending ? undefined : onCancel}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={pending ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel delete"
        />
        <View style={[styles.card, { marginBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <Text style={styles.title} numberOfLines={3}>
            Delete “{itemTitle}”?
          </Text>
          <Text style={styles.message}>
            This removes this {kind.toLowerCase()} permanently.
            {detail ? ` ${detail}` : ""}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              onPress={onCancel}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.confirm, pressed && !pending && styles.confirmPressed, pending && styles.disabled]}
              onPress={onConfirm}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel={pending ? "Deleting" : `Delete ${kind.toLowerCase()}`}
            >
              <Text style={styles.confirmLabel}>{pending ? "Deleting…" : "Delete"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end", paddingHorizontal: spacing.xl },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.backdrop },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radii.lg,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    title: { ...type.item, color: colors.textPrimary, fontSize: 17 },
    message: { ...type.body, color: colors.textSecondary },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    cancel: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    pressed: { opacity: 0.7 },
    cancelLabel: { ...type.item, color: colors.textSecondary, fontWeight: "600" },
    confirm: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
      borderRadius: radii.md,
      backgroundColor: colors.danger,
    },
    confirmPressed: { opacity: 0.85 },
    disabled: { opacity: 0.6 },
    confirmLabel: { ...type.item, color: colors.onDanger, fontWeight: "700" },
  });
}
