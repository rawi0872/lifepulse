export const INTENDED_USE_VALUES = ["personal", "business", "team", "mixed"] as const;

export type IntendedUse = (typeof INTENDED_USE_VALUES)[number];

export function resolveIntendedUse(value: string | null | undefined): IntendedUse {
  return INTENDED_USE_VALUES.includes(value as IntendedUse) ? (value as IntendedUse) : "personal";
}
