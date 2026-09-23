// ---------------------------------------------------------------------------
// Life Pulse canonical copy map (web ↔ mobile convergence).
// ---------------------------------------------------------------------------
// One home for product terminology both clients must use. Presentation
// components should prefer these over local literals for realm names,
// habit frequencies, and Today section labels. Deliberately small — do
// NOT abstract every string in the product.
// ---------------------------------------------------------------------------

export const REALM_NAMES = {
  body: "Body",
  wealth: "Wealth",
  realms: "Realms",
} as const;

export type CanonicalRealmKey = keyof typeof REALM_NAMES;

export const HABIT_FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
};

export const HABIT_FREQUENCY_DESCRIPTIONS: Record<string, string> = {
  daily: "Every day",
  weekdays: "Specific days",
  weekly: "Times per week",
};

export const TODAY_LABELS = {
  upNext: "Up Next",
  focus: "Today's Focus",
  tasksDue: "Tasks",
  habitsDue: "Habits",
  askNextron: "Ask NEXTRON about today",
} as const;

export const THEME_LABELS = {
  system: "System",
  systemHint: "Follows device",
  light: "Light",
  lightHint: "Warm Human",
  dark: "Dark",
  darkHint: "Signature Pulse",
} as const;

export type ThemePreference = "system" | "light" | "dark";

/** localStorage (web) / AsyncStorage (mobile) key — same contract. */
export const APPEARANCE_STORAGE_KEY = "lifepulse:appearance";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
