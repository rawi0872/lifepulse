// Daily Quote — deterministic selection based on local date
// Curated original Life Pulse lines; no famous/copyrighted quotes

export const DAILY_QUOTES = [
  "Small steps today, a brighter tomorrow.",
  "Progress starts with what you do next.",
  "Make today easier for your future self.",
  "Consistency beats intensity.",
  "One clear priority can change the day.",
  "Build the life you want, one day at a time.",
  "Calm progress is still progress.",
  "Do the important thing first.",
  "Better days are built, not found.",
  "Your next choice matters more than your last mistake.",
  "Focus on the step in front of you.",
  "A single good habit outlasts a burst of motivation.",
  "Done is better than perfect.",
  "The day is yours to shape.",
  "Small wins compound into big changes.",
  "Rest is part of the work.",
  "Show up for yourself, even in small ways.",
  "What matters gets done; what gets done matters.",
  "Start where you are. Use what you have.",
  "Peace comes from doing the next right thing.",
] as const;

/**
 * Deterministically selects a daily quote based on the local date string.
 * The same quote is returned for the same date, regardless of render count,
 * navigation, or theme changes. Changes only when the local date changes.
 */
export function getDailyQuote(localDate: string): string {
  // Create a deterministic hash from the date string
  let hash = 0;
  for (let i = 0; i < localDate.length; i++) {
    const char = localDate.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Ensure positive index
  const index = Math.abs(hash) % DAILY_QUOTES.length;
  return DAILY_QUOTES[index];
}