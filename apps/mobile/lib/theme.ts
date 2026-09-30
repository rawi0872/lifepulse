// Life Pulse dual premium theme tokens.
// Dark  = "Signature Pulse"  (deep calm navy, electric blue accent)
// Light = "Warm Human Premium" (warm ivory, calm medium blue accent)
//
// lib/theme.ts stays free of react-native imports so node tests can import
// the pure helpers (resolveThemeMode, themeFor, completeness checks).
//
// Palette values live in the shared contract (@lifepulse/domain theme-palette)
// so web and mobile resolve the identical colors. This module re-exports them
// under the mobile ThemeColors type.
import {
  canonicalAfternoonPalette,
  canonicalDarkPalette,
  canonicalEveningPalette,
  canonicalLightPalette,
  canonicalMorningPalette,
  phaseForHour,
} from "@lifepulse/domain";

export type ThemeMode = "system" | "light" | "dark" | "day_cycle";
export type ResolvedMode = "light" | "dark";
export type DayCyclePhase = "morning" | "afternoon" | "evening" | "night";

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
// DARK — "Signature Pulse" (canonical: @lifepulse/domain theme-palette)
// Deep calm navy, NOT flat pure black. Electric Life Pulse blue accent.
// ---------------------------------------------------------------------------
export const darkColors: ThemeColors = canonicalDarkPalette;

// ---------------------------------------------------------------------------
// LIGHT — "Warm Human Premium" (canonical: @lifepulse/domain theme-palette)
// Warm ivory base, deep navy text (NOT black), calm medium blue accent.
// ---------------------------------------------------------------------------
export const lightColors: ThemeColors = canonicalLightPalette;

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
  return value === "system" || value === "light" || value === "dark" || value === "day_cycle";
}

/** Resolve user choice + OS scheme into a concrete light/dark theme. */
export function resolveThemeMode(mode: ThemeMode, systemScheme: string | null | undefined, now: Date = new Date()): ResolvedMode {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (mode === "day_cycle") {
    const phase = resolveDayCyclePhase(now);
    return phase === "night" ? "dark" : "light";
  }
  return systemScheme === "light" ? "light" : "dark";
}

/** Resolve the day cycle phase from the current local time (shared contract). */
export function resolveDayCyclePhase(date: Date): DayCyclePhase {
  return phaseForHour(date.getHours());
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

// --- Day Cycle theme variants --------------------------------------------------

// MORNING — soft sunrise, warm ivory, gentle gold/blue (canonical: @lifepulse/domain)
export const morningColors: ThemeColors = canonicalMorningPalette;

// AFTERNOON — brighter warm daylight, clearer blue/gold, still calm (canonical: @lifepulse/domain)
export const afternoonColors: ThemeColors = canonicalAfternoonPalette;

// EVENING — warm amber/dusk blue, sunset feeling (canonical: @lifepulse/domain)
export const eveningColors: ThemeColors = canonicalEveningPalette;

// NIGHT — same as darkColors (Signature Pulse)
export const nightColors: ThemeColors = darkColors;

export function themeForDayCycle(phase: DayCyclePhase): ThemeColors {
  switch (phase) {
    case "morning": return morningColors;
    case "afternoon": return afternoonColors;
    case "evening": return eveningColors;
    case "night": return nightColors;
  }
}

// Legacy default kept for any not-yet-migrated import; new code must use
// useLifePulseTheme() so switching is immediate.
export const colors = darkColors;
export const shadow = shadowFor("dark");
