// Life Pulse mobile design tokens.
// Dark, tonal-depth identity with a restrained blue accent used selectively.

export const colors = {
  // Backgrounds (tonal depth)
  bg: "#06080e", // app background — deep navy-black
  surface: "#0d1119", // primary card surface
  surfaceElevated: "#121826", // interactive/elevated surface
  surfaceOverlay: "#171d2b", // highest surface step

  // Borders
  border: "rgba(148, 163, 184, 0.10)",
  borderStrong: "rgba(148, 163, 184, 0.18)",

  // Text
  textPrimary: "#f4f7fb",
  textSecondary: "#9aa7b8",
  textMuted: "#5c6b7e",
  textFaint: "#3a4656",

  // Accent (Life Pulse blue — selective, not everywhere)
  accent: "#7aa2c4",
  accentStrong: "#8fb9dd",
  accentSoft: "rgba(106, 160, 205, 0.12)",
  accentBorder: "rgba(122, 162, 196, 0.28)",

  // State
  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.12)",
  danger: "#ef4444",
  dangerSoft: "rgba(239, 68, 68, 0.12)",
  warning: "#f59e0b",
  warningSoft: "rgba(245, 158, 11, 0.12)",

  // On-accent (text on filled accent buttons)
  onAccent: "#071018",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  section: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const type = {
  hero: { fontSize: 30, lineHeight: 36, fontWeight: "700" as const },
  screen: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  section: { fontSize: 13, lineHeight: 16, fontWeight: "600" as const },
  item: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: "500" as const },
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  dock: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },
};