import React from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radii, type } from "../../lib/theme";
import { Edit, Close } from "../icons";

interface ItemActionSheetProps {
  visible: boolean;
  /** Item title shown at the top of the sheet. */
  title: string;
  /** "Task" | "Habit" — small caption above the title. */
  kind: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Polished cross-platform contextual sheet for long-press row actions.
 * Tap-outside dismisses, Android back dismisses via onRequestClose.
 */
export function ItemActionSheet({ visible, title, kind, onEdit, onDelete, onClose }: ItemActionSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <Text style={styles.kind}>{kind}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${kind.toLowerCase()}`}
          >
            <View style={styles.actionIcon}>
              <Edit size={18} color={colors.accentStrong} />
            </View>
            <Text style={styles.actionLabel}>Edit</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${kind.toLowerCase()}`}
          >
            <View style={[styles.actionIcon, styles.actionIconDanger]}>
              <Close size={18} color={colors.danger} />
            </View>
            <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Delete</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.actionPressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  kind: {
    ...type.caption,
    color: colors.textMuted,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: { ...type.item, color: colors.textPrimary, fontSize: 17, marginTop: 4, marginBottom: spacing.lg },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  actionPressed: { backgroundColor: colors.surfaceElevated },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconDanger: { backgroundColor: colors.dangerSoft },
  actionLabel: { ...type.item, color: colors.textPrimary },
  actionLabelDanger: { color: colors.danger },
  cancel: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  cancelLabel: { ...type.item, color: colors.textSecondary, fontWeight: "600" },
});
