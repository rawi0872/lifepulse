// ---------------------------------------------------------------------------
// Life Pulse canonical theme palette (web ↔ mobile convergence).
// ---------------------------------------------------------------------------
// ONE palette contract for the product. Mobile `lib/theme.ts` consumes these
// values; web CSS variables derive from them. Do NOT fork the palette —
// update values here and sync both clients.
//
// Pure TypeScript: no React Native imports, no DOM imports.
// ---------------------------------------------------------------------------

export type CanonicalStatusBar = "light" | "dark";

export type DayCyclePhase = "morning" | "afternoon" | "evening" | "night";

export interface CanonicalThemePalette {
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceOverlay: string;
  navSurface: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentBorder: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  realmBody: string;
  realmBodySoft: string;
  realmBodyBorder: string;
  realmWealth: string;
  realmWealthSoft: string;
  realmWealthBorder: string;
  mutedSoft: string;
  backdrop: string;
  onAccent: string;
  onDanger: string;
  heroGlow: string;
  heroRidge: string;
  heroSky: string;
  statusBar: CanonicalStatusBar;
}

// ---------------------------------------------------------------------------
// DARK — "Signature Pulse"
// Deep calm navy, NOT flat pure black. Electric Life Pulse blue accent.
// ---------------------------------------------------------------------------
export const canonicalDarkPalette: CanonicalThemePalette = {
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
export const canonicalLightPalette: CanonicalThemePalette = {
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

// ---------------------------------------------------------------------------
// MORNING — soft sunrise, warm ivory, gentle gold/blue
// ---------------------------------------------------------------------------
export const canonicalMorningPalette: CanonicalThemePalette = {
  bg: "#FAF6F0",
  surface: "#FFFDF6",
  surfaceElevated: "#FFFFFF",
  surfaceOverlay: "#FEF9F0",
  navSurface: "#FFF8ED",
  border: "rgba(180, 150, 90, 0.12)",
  borderStrong: "rgba(180, 150, 90, 0.22)",
  textPrimary: "#1A1620",
  textSecondary: "#5D5548",
  textMuted: "#8A8272",
  textFaint: "#C8C0AC",
  accent: "#D4A53A",
  accentStrong: "#C4962E",
  accentSoft: "rgba(212, 165, 58, 0.12)",
  accentBorder: "rgba(212, 165, 58, 0.30)",
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
  mutedSoft: "rgba(180, 150, 90, 0.10)",
  backdrop: "rgba(26, 22, 32, 0.45)",
  onAccent: "#1A1620",
  onDanger: "#FFFFFF",
  heroGlow: "rgba(212, 165, 58, 0.18)",
  heroRidge: "#F0E6D0",
  heroSky: "#FDF6E8",
  statusBar: "dark",
};

// ---------------------------------------------------------------------------
// AFTERNOON — brighter warm daylight, clearer blue/gold, still calm
// ---------------------------------------------------------------------------
export const canonicalAfternoonPalette: CanonicalThemePalette = {
  bg: "#F8F5EE",
  surface: "#FFFDF5",
  surfaceElevated: "#FFFFFF",
  surfaceOverlay: "#FEFBF0",
  navSurface: "#FFF8E8",
  border: "rgba(140, 130, 80, 0.12)",
  borderStrong: "rgba(140, 130, 80, 0.22)",
  textPrimary: "#0F1A2A",
  textSecondary: "#4A4538",
  textMuted: "#7A7468",
  textFaint: "#B8B0A0",
  accent: "#3D8BC7",
  accentStrong: "#2E75A8",
  accentSoft: "rgba(61, 139, 199, 0.12)",
  accentBorder: "rgba(61, 139, 199, 0.28)",
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
  mutedSoft: "rgba(140, 130, 80, 0.10)",
  backdrop: "rgba(15, 20, 30, 0.45)",
  onAccent: "#FFFFFF",
  onDanger: "#FFFFFF",
  heroGlow: "rgba(61, 139, 199, 0.18)",
  heroRidge: "#E8E0D0",
  heroSky: "#F0E8D8",
  statusBar: "dark",
};

// ---------------------------------------------------------------------------
// EVENING — warm amber/dusk blue, sunset feeling
// ---------------------------------------------------------------------------
export const canonicalEveningPalette: CanonicalThemePalette = {
  bg: "#F0EDE8",
  surface: "#FAF8F3",
  surfaceElevated: "#FFFFFF",
  surfaceOverlay: "#F5F0E8",
  navSurface: "#F0EDE8",
  border: "rgba(160, 120, 90, 0.14)",
  borderStrong: "rgba(160, 120, 90, 0.24)",
  textPrimary: "#1A1220",
  textSecondary: "#5A4A38",
  textMuted: "#8A7A68",
  textFaint: "#B8A898",
  accent: "#E88D2E",
  accentStrong: "#D47A1E",
  accentSoft: "rgba(232, 141, 46, 0.14)",
  accentBorder: "rgba(232, 141, 46, 0.32)",
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
  mutedSoft: "rgba(160, 120, 90, 0.12)",
  backdrop: "rgba(26, 18, 32, 0.50)",
  onAccent: "#1A1220",
  onDanger: "#FFFFFF",
  heroGlow: "rgba(232, 141, 46, 0.20)",
  heroRidge: "#E8DDCC",
  heroSky: "#F5E8D8",
  statusBar: "dark",
};

// NIGHT reuses Signature Pulse.
export const canonicalNightPalette: CanonicalThemePalette = canonicalDarkPalette;

export const canonicalPalettes: Record<"light" | "dark" | DayCyclePhase, CanonicalThemePalette> = {
  light: canonicalLightPalette,
  dark: canonicalDarkPalette,
  morning: canonicalMorningPalette,
  afternoon: canonicalAfternoonPalette,
  evening: canonicalEveningPalette,
  night: canonicalNightPalette,
};

export function paletteForDayCyclePhase(phase: DayCyclePhase): CanonicalThemePalette {
  return canonicalPalettes[phase];
}

/** Local-hour (0-23) → Day Cycle phase. Windows: 05–11 morning, 12–16 afternoon, 17–20 evening, else night. */
export function phaseForHour(hour: number): DayCyclePhase {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Day Cycle phase from a Date using local time. */
export function phaseForDate(date: Date): DayCyclePhase {
  return phaseForHour(date.getHours());
}
