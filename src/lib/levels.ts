// ---------------------------------------------------------------------------
// Life Pulse XP/Level System
// ---------------------------------------------------------------------------
// Future customization: accept custom thresholds + title overrides by passing
// optional parameters to getLevelInfo() / getRealmTitle() / getOverallTitle().
// ---------------------------------------------------------------------------

// --- XP Thresholds (Balanced progression style) ---

export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  450,    // Level 4
  700,    // Level 5
  1000,   // Level 6
  1400,   // Level 7
  1900,   // Level 8
  2500,   // Level 9
  3200,   // Level 10
  4000,   // Level 11
  4900,   // Level 12
  5900,   // Level 13
  7000,   // Level 14
  8200,   // Level 15
  9500,   // Level 16
  10900,  // Level 17
  12400,  // Level 18
  14000,  // Level 19
  15700,  // Level 20
];

// Future: additional presets for customization
// export type ProgressionStyle = "balanced" | "fast" | "slow" | "custom";
// export const PROGRESSION_PRESETS: Record<ProgressionStyle, number[]> = {
//   balanced: LEVEL_THRESHOLDS,
//   fast: [0, 50, 120, 220, 350, 500, ...],
//   slow: [0, 200, 500, 900, 1400, 2000, ...],
// };

// --- LevelInfo ---

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpNeededForNext: number;
  progressPercent: number;
  isMaxKnownLevel: boolean;
}

/**
 * Calculate level info from total XP.
 * Future: accept custom thresholds array as second parameter.
 */
export function getLevelInfo(totalXp: number): LevelInfo {
  const levels = LEVEL_THRESHOLDS;

  let level = 1;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalXp >= levels[i]) {
      level = i + 1;
      break;
    }
  }

  const isMaxKnownLevel = level >= levels.length;
  const currentLevelXp = levels[level - 1];

  let nextLevelXp: number;
  if (isMaxKnownLevel) {
    const levelsBeyond = level - levels.length;
    const increment = 1000 + levelsBeyond * 200;
    nextLevelXp = currentLevelXp + increment;
  } else {
    nextLevelXp = levels[level];
  }

  const xpIntoLevel = Math.max(0, totalXp - currentLevelXp);
  const xpRange = nextLevelXp - currentLevelXp;
  const progressPercent = xpRange > 0
    ? Math.min(100, Math.round((xpIntoLevel / xpRange) * 100))
    : 0;
  const xpNeededForNext = Math.max(1, nextLevelXp - totalXp);

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeededForNext,
    progressPercent,
    isMaxKnownLevel,
  };
}

// --- Title Entries ---

export interface TitleEntry {
  minLevel: number;
  title: string;
}

/**
 * Default titles per realm + level range.
 * Future: overrides map can be stored in DB and passed to getRealmTitle().
 */

export const DEFAULT_REALM_TITLES: Record<string, TitleEntry[]> = {
  Mind: [
    { minLevel: 1, title: "Curious Mind" },
    { minLevel: 3, title: "Focused Thinker" },
    { minLevel: 5, title: "Sharp Strategist" },
    { minLevel: 8, title: "Mastermind" },
    { minLevel: 13, title: "Grand Strategist" },
    { minLevel: 18, title: "Sage of Reason" },
  ],
  Body: [
    { minLevel: 1, title: "Starting Athlete" },
    { minLevel: 3, title: "Consistent Mover" },
    { minLevel: 5, title: "Strong Foundation" },
    { minLevel: 8, title: "Peak Performer" },
    { minLevel: 13, title: "Iron Discipline" },
    { minLevel: 18, title: "Endurance Exemplar" },
  ],
  Career: [
    { minLevel: 1, title: "Beginner Builder" },
    { minLevel: 3, title: "Skill Builder" },
    { minLevel: 5, title: "Operator" },
    { minLevel: 8, title: "Visionary" },
    { minLevel: 13, title: "Industry Leader" },
    { minLevel: 18, title: "Legacy Builder" },
  ],
  Relationships: [
    { minLevel: 1, title: "Present Friend" },
    { minLevel: 3, title: "Trusted Connector" },
    { minLevel: 5, title: "Social Anchor" },
    { minLevel: 8, title: "Community Builder" },
    { minLevel: 13, title: "Circle Weaver" },
    { minLevel: 18, title: "Legacy of Care" },
  ],
  Finance: [
    { minLevel: 1, title: "Money Aware" },
    { minLevel: 3, title: "Budget Builder" },
    { minLevel: 5, title: "Wealth Planner" },
    { minLevel: 8, title: "Capital Allocator" },
    { minLevel: 13, title: "Portfolio Master" },
    { minLevel: 18, title: "Financial Sage" },
  ],
  Faith: [
    { minLevel: 1, title: "Grounded Seeker" },
    { minLevel: 3, title: "Steady Believer" },
    { minLevel: 5, title: "Inner Anchor" },
    { minLevel: 8, title: "Spirit Builder" },
    { minLevel: 13, title: "Deep Roots" },
    { minLevel: 18, title: "Guiding Light" },
  ],
};

export const FALLBACK_TITLES: TitleEntry[] = [
  { minLevel: 1, title: "Beginner" },
  { minLevel: 3, title: "Builder" },
  { minLevel: 5, title: "Advanced" },
  { minLevel: 8, title: "Master" },
  { minLevel: 13, title: "Grandmaster" },
  { minLevel: 18, title: "Legend" },
];

export const OVERALL_TITLES: TitleEntry[] = [
  { minLevel: 1, title: "Beginner" },
  { minLevel: 3, title: "Rising Builder" },
  { minLevel: 5, title: "Disciplined Operator" },
  { minLevel: 8, title: "Life Architect" },
  { minLevel: 13, title: "Purpose Driven" },
  { minLevel: 18, title: "Legacy in Motion" },
];

// --- Title helpers ---

export function getTitleForLevel(titles: TitleEntry[], level: number): string {
  let title = titles[0]?.title ?? "Beginner";
  for (const entry of titles) {
    if (level >= entry.minLevel) {
      title = entry.title;
    }
  }
  return title;
}

/**
 * Get the title for a given realm at a given level.
 * Future: accept overrides map as third parameter.
 */
export function getRealmTitle(realmName: string, level: number): string {
  const titles = DEFAULT_REALM_TITLES[realmName] ?? FALLBACK_TITLES;
  return getTitleForLevel(titles, level);
}

export function getOverallTitle(level: number): string {
  return getTitleForLevel(OVERALL_TITLES, level);
}
