// Life Pulse Results — Contract constants and validation (Phase 1)
// No UI, no hooks, no Supabase queries, no templates, no adapters

/** Supported domains. */
export type ResultDomain =
  | 'body'
  | 'mind'
  | 'finance'
  | 'business'
  | 'learning'
  | 'skills'
  | 'passions'
  | 'goals'
  | 'custom';

/** Supported value kinds. */
export type ResultValueKind =
  | 'number'
  | 'count'
  | 'percentage'
  | 'duration'
  | 'currency'
  | 'rating';

/** Target directions. */
export type ResultTargetDirection =
  | 'increase'
  | 'decrease'
  | 'maintain'
  | 'none';

/** Recording cadences. */
export type ResultCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom'
  | 'none';

/** Supported domains array. */
export const RESULT_DOMAINS: readonly ResultDomain[] = [
  'body','mind','finance','business','learning','skills','passions','goals','custom'
] as const;

/** Supported value kinds array. */
export const RESULT_VALUE_KINDS: readonly ResultValueKind[] = [
  'number','count','percentage','duration','currency','rating'
] as const;

/** Target directions array. */
export const RESULT_TARGET_DIRECTIONS: readonly ResultTargetDirection[] = [
  'increase','decrease','maintain','none'
] as const;

/** Recording cadences array. */
export const RESULT_CADENCES: readonly ResultCadence[] = [
  'daily','weekly','monthly','quarterly','yearly','custom','none'
] as const;

/** Numeric precision for all stored values. */
export const NUMERIC_PRECISION = 6;
export const NUMERIC_SCALE = 6;
export const NUMERIC_MAX = 9_999_999_999.999999;
export const NUMERIC_MIN = -9_999_999_999.999999;
export const NUMERIC_ABS_MAX = 9_999_999_999.999999;
export const NUMERIC_ABS_MIN = -9_999_999_999.999999;

/** Percentage: stored 0–100 with 2 decimals. */
export const PERCENTAGE_MIN = 0;
export const PERCENTAGE_MAX = 100;
export const PERCENTAGE_DECIMALS = 2;

/** Duration: stored as integer minutes. */
export const DURATION_MIN = 0;
export const DURATION_MAX = 525_600;

/** Count bounds. */
export const COUNT_MIN = 0;
export const COUNT_MAX = 1_000_000;

/** Rating bounds (fixed 1–10 Phase 1). */
export const RATING_MIN = 1;
export const RATING_MAX = 10;

/** Text limits. */
export const NAME_MAX = 80;
export const UNIT_MAX = 20;
export const DESCRIPTION_MAX = 1000;
export const NOTES_MAX = 5000;

/** Default values. */
export const DEFAULT_TARGET_DIRECTION: ResultTargetDirection = 'none';
export const DEFAULT_CADENCE: ResultCadence = 'none';
export const DEFAULT_ARCHIVED = false;

/** Type guards. */
export function isResultDomain(v: string): v is ResultDomain {
  return ['body','mind','finance','business','learning','skills','passions','goals','custom'].includes(v);
}

export function isResultValueKind(v: string): v is ResultValueKind {
  return ['number','count','percentage','duration','currency','rating'].includes(v);
}

export function isResultTargetDirection(v: string): v is ResultTargetDirection {
  return ['increase','decrease','maintain','none'].includes(v);
}

export function isResultCadence(v: string): v is ResultCadence {
  return ['daily','weekly','monthly','quarterly','yearly','custom','none'].includes(v);
}

export function getDefaultTargetDirection(): ResultTargetDirection {
  return 'none';
}

export function getDefaultCadence(): ResultCadence {
  return 'none';
}

export function getDefaultArchived(): boolean {
  return false;
}



