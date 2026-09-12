// Life Pulse dual premium theme tokens.
// Dark  = "Signature Pulse"  (deep calm navy, electric blue accent)
// Light = "Warm Human Premium" (warm ivory, calm medium blue accent)
//
// lib/theme.ts stays free of react-native imports so node tests can import
// the pure helpers (resolveThemeMode, themeFor, completeness checks).

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedMode = "light" | "dark";

export interface ThemeColors {
  // Backgrounds (tonal depth)
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceOverlay: string;
  navSurface: string;

  // Borders
  border: string;
  borderStrong: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;

  // Accent (Life Pulse blue — selective, not everywhere)
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentBorder: string;

  // State
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;

  // Realm identity — confined to Realm iconography, never general UI.
  realmBody: string;
  realmBodySoft: string;
  realmBodyBorder: string;
  realmWealth: string;
  realmWealthSoft: string;
  realmWealthBorder: string;

  // Muted fills for dots/badges/tracks.
  mutedSoft: string;

  // Overlays
  backdrop: string;

  // On-accent (text on filled accent buttons)
  onAccent: string;

  // On-danger (text on filled destructive buttons — white in both modes)
  onDanger: string;

  // Hero / illustration atmosphere tokens (never baked text, only washes)
  heroGlow: string;
  heroRidge: string;
  heroSky: string;

  // Status bar style for expo-status-bar + Android bars
  statusBar: "light" | "dark";
}

// ---------------------------------------------------------------------------
// DARK — "Signature Pulse"
// Deep calm navy, NOT flat pure black. Electric Life Pulse blue accent.
// ---------------------------------------------------------------------------
export const darkColors: ThemeColors = {
  bg: "#030A13",
  surface: "#0A1626",
  surfaceElevated: "#0E1E33",
  surfaceOverlay: "#152A45",
  navSurface: "#071120",

  border: "rgba(148, 184, 220, 0.12)",
  borderStrong: "rgba(148, 184, 220, 0.22)",

  textPrimary: "#F2F7FD",
  textSecondary: "#A9BCD2",
  textMuted: "#6B7E96",
  textFaint: "#3A4A5E",

  accent: "#69B7FF",
  accentStrong: "#8FC2FF",
  accentSoft: "rgba(105, 183, 255, 0.12)",
  accentBorder: "rgba(105, 183, 255, 0.34)",

  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.12)",
  danger: "#ef4444",
  dangerSoft: "rgba(239, 68, 68, 0.12)",
  dangerBorder: "rgba(239, 68, 68, 0.28)",
  warning: "#f59e0b",
  warningSoft: "rgba(245, 158, 11, 0.12)",
  warningBorder: "rgba(245, 158, 11, 0.3)",

  realmBody: "#ef4444",
  realmBodySoft: "rgba(239, 68, 68, 0.12)",
  realmBodyBorder: "rgba(239, 68, 68, 0.25)",
  realmWealth: "#38bdf8",
  realmWealthSoft: "rgba(56, 189, 248, 0.12)",
  realmWealthBorder: "rgba(56, 189, 248, 0.25)",

  mutedSoft: "rgba(148, 184, 220, 0.12)",

  backdrop: "rgba(0, 0, 0, 0.6)",

  onAccent: "#04101F",
  onDanger: "#FFFFFF",

  heroGlow: "rgba(105, 183, 255, 0.16)",
  heroRidge: "#0B1D33",
  heroSky: "#06121F",

  statusBar: "light",
};

// ---------------------------------------------------------------------------
// LIGHT — "Warm Human Premium"
// Warm ivory base, deep navy text (NOT black), calm medium blue accent.
// ---------------------------------------------------------------------------
export const lightColors: ThemeColors = {
  bg: "#FBF8F2",
  surface: "#FFFDF8",
  surfaceElevated: "#FFFFFF",
  surfaceOverlay: "#FFFFFF",
  navSurface: "#FFFDF8",

  border: "rgba(75, 100, 140, 0.10)",
  borderStrong: "rgba(75, 100, 140, 0.20)",

  textPrimary: "#0B1930",
  textSecondary: "#4A5D75",
  textMuted: "#7D8EA6",
  textFaint: "#A9B8CC",

  accent: "#4F83B8",
  accentStrong: "#3A6A99",
  accentSoft: "rgba(79, 131, 184, 0.12)",
  accentBorder: "rgba(79, 131, 184, 0.30)",

  success: "#0E9F6E",
  successSoft: "rgba(14, 159, 110, 0.12)",
  danger: "#DC2626",
  dangerSoft: "rgba(220, 38, 38, 0.08)",
  dangerBorder: "rgba(220, 38, 38, 0.25)",
  warning: "#D97706",
  warningSoft: "rgba(217, 119, 6, 0.10)",
  warningBorder: "rgba(217, 119, 6, 0.28)",

  realmBody: "#DC2626",
  realmBodySoft: "rgba(220, 38, 38, 0.08)",
  realmBodyBorder: "rgba(220, 38, 38, 0.22)",
  realmWealth: "#0284C7",
  realmWealthSoft: "rgba(2, 132, 199, 0.10)",
  realmWealthBorder: "rgba(2, 132, 199, 0.22)",

  mutedSoft: "rgba(75, 100, 140, 0.10)",

  backdrop: "rgba(11, 25, 48, 0.45)",

  onAccent: "#FFFFFF",
  onDanger: "#FFFFFF",

  heroGlow: "rgba(118, 183, 239, 0.20)",
  heroRidge: "#EADDC8",
  heroSky: "#F6EDDD",

  statusBar: "dark",
};

// Every key a screen/component may need — both sets must stay complete.
export const THEME_COLOR_KEYS = [
  "bg",
  "surface",
  "surfaceElevated",
  "surfaceOverlay",
  "navSurface",
  "border",
  "borderStrong",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "textFaint",
  "accent",
  "accentStrong",
  "accentSoft",
  "accentBorder",
  "success",
  "successSoft",
  "danger",
  "dangerSoft",
  "dangerBorder",
  "warning",
  "warningSoft",
  "warningBorder",
  "realmBody",
  "realmBodySoft",
  "realmBodyBorder",
  "realmWealth",
  "realmWealthSoft",
  "realmWealthBorder",
  "mutedSoft",
  "backdrop",
  "onAccent",
  "onDanger",
  "heroGlow",
  "heroRidge",
  "heroSky",
  "statusBar",
] as const;

export const THEME_STORAGE_KEY = "lifepulse:appearance";

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

/** Resolve user choice + OS scheme into a concrete light/dark theme. */
export function resolveThemeMode(mode: ThemeMode, systemScheme: string | null | undefined): ResolvedMode {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return systemScheme === "light" ? "light" : "dark";
}

export function themeFor(resolved: ResolvedMode): ThemeColors {
  return resolved === "light" ? lightColors : darkColors;
}

export function statusBarFor(resolved: ResolvedMode): "light" | "dark" {
  return themeFor(resolved).statusBar;
}

// --- Shared non-color tokens (mode-independent) -----------------------------

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

export interface ThemeShadow {
  card: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  dock: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

/** Warm shallow shadows in light mode, soft dark depth in dark mode. */
export function shadowFor(resolved: ResolvedMode): ThemeShadow {
  if (resolved === "light") {
    return {
      card: {
        shadowColor: "#1E2A3A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      },
      dock: {
        shadowColor: "#1E2A3A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.10,
        shadowRadius: 16,
        elevation: 8,
      },
    };
  }
  return {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    dock: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
      elevation: 12,
    },
  };
}

// Legacy default kept for any not-yet-migrated import; new code must use
// useLifePulseTheme() so switching is immediate.
export const colors = darkColors;
export const shadow = shadowFor("dark");
