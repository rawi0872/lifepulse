export interface WeeklyReviewReflection {
  wentWell: string;
  movedForward: string;
  gotInTheWay: string;
  learned: string;
  continueDoing: string;
  changeNextWeek: string;
  focusNextWeek: string;
}

interface EncodedWeeklyReviewReflection extends WeeklyReviewReflection {
  weekStart: string;
}

const WEEKLY_REVIEW_START_PREFIX = "<!-- LIFE_PULSE_WEEKLY_REVIEW_START";
const WEEKLY_REVIEW_END = "<!-- LIFE_PULSE_WEEKLY_REVIEW_END -->";
const EVENING_SHUTDOWN_START = "<!-- LIFE_PULSE_EVENING_SHUTDOWN_START -->";
const LEGACY_WEEKLY_REVIEW_MARKER = "**Weekly Reflection (";

function markerStart(weekStart: string): string {
  return `${WEEKLY_REVIEW_START_PREFIX} ${weekStart} -->`;
}

function cleanField(value: string, maxLength = 1400): string {
  return value.trim().slice(0, maxLength);
}

function encodeField(value: string): string {
  return encodeURIComponent(value);
}

function decodeField(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readableField(value: string): string {
  return value
    .replaceAll(WEEKLY_REVIEW_START_PREFIX, "LIFE_PULSE_WEEKLY_REVIEW_START")
    .replaceAll(WEEKLY_REVIEW_END, "LIFE_PULSE_WEEKLY_REVIEW_END");
}

export function normalizeWeeklyReviewReflection(reflection: WeeklyReviewReflection): WeeklyReviewReflection {
  return {
    wentWell: cleanField(reflection.wentWell),
    movedForward: cleanField(reflection.movedForward),
    gotInTheWay: cleanField(reflection.gotInTheWay),
    learned: cleanField(reflection.learned),
    continueDoing: cleanField(reflection.continueDoing),
    changeNextWeek: cleanField(reflection.changeNextWeek),
    focusNextWeek: cleanField(reflection.focusNextWeek, 500),
  };
}

export function emptyWeeklyReviewReflection(): WeeklyReviewReflection {
  return {
    wentWell: "",
    movedForward: "",
    gotInTheWay: "",
    learned: "",
    continueDoing: "",
    changeNextWeek: "",
    focusNextWeek: "",
  };
}

export function hasWeeklyReviewContent(reflection: WeeklyReviewReflection): boolean {
  return Object.values(reflection).some((value) => value.trim().length > 0);
}

export function buildWeeklyReviewBlock(weekStart: string, reflection: WeeklyReviewReflection): string {
  const clean = normalizeWeeklyReviewReflection(reflection);
  const encoded: EncodedWeeklyReviewReflection = {
    weekStart,
    wentWell: encodeField(clean.wentWell),
    movedForward: encodeField(clean.movedForward),
    gotInTheWay: encodeField(clean.gotInTheWay),
    learned: encodeField(clean.learned),
    continueDoing: encodeField(clean.continueDoing),
    changeNextWeek: encodeField(clean.changeNextWeek),
    focusNextWeek: encodeField(clean.focusNextWeek),
  };

  const readable = [
    "**Weekly Review**",
    clean.wentWell && `## What went well?\n${readableField(clean.wentWell)}`,
    clean.movedForward && `## What moved forward?\n${readableField(clean.movedForward)}`,
    clean.gotInTheWay && `## What got in the way?\n${readableField(clean.gotInTheWay)}`,
    clean.learned && `## What did I learn?\n${readableField(clean.learned)}`,
    clean.continueDoing && `## What should I continue?\n${readableField(clean.continueDoing)}`,
    clean.changeNextWeek && `## What should I change?\n${readableField(clean.changeNextWeek)}`,
    clean.focusNextWeek && `## What matters most next week?\n${readableField(clean.focusNextWeek)}`,
  ].filter(Boolean).join("\n\n");

  return [markerStart(weekStart), JSON.stringify(encoded), readable, WEEKLY_REVIEW_END].join("\n").trim();
}

function findMarkedBlock(content: string): { start: number; end: number } | null {
  const start = content.indexOf(WEEKLY_REVIEW_START_PREFIX);
  if (start < 0) return null;
  const endMarkerStart = content.indexOf(`\n${WEEKLY_REVIEW_END}`, start + WEEKLY_REVIEW_START_PREFIX.length);
  if (endMarkerStart <= start) return null;
  return { start, end: endMarkerStart + 1 + WEEKLY_REVIEW_END.length };
}

function removeLegacyWeeklyReviewBlock(content: string): string {
  const legacyStart = content.indexOf(LEGACY_WEEKLY_REVIEW_MARKER);
  if (legacyStart < 0) return content;

  const before = content.slice(0, legacyStart).trimEnd();
  const eveningStart = content.indexOf(EVENING_SHUTDOWN_START, legacyStart + LEGACY_WEEKLY_REVIEW_MARKER.length);
  const legacyEnd = eveningStart >= 0 ? eveningStart : content.length;
  const after = content.slice(legacyEnd).trimStart();
  return [before, after].filter(Boolean).join("\n\n");
}

export function mergeWeeklyReviewBlock(existingContent: string, block: string): string {
  const existing = existingContent.trimEnd();
  const marked = findMarkedBlock(existing);

  if (marked) {
    const before = existing.slice(0, marked.start).trimEnd();
    const after = existing.slice(marked.end).trimStart();
    return [before, block, after].filter(Boolean).join("\n\n");
  }

  const withoutLegacy = removeLegacyWeeklyReviewBlock(existing).trimEnd();
  if (!withoutLegacy) return block;
  return `${withoutLegacy}\n\n${block}`;
}

export function removeWeeklyReviewBlock(content: string): string {
  const marked = findMarkedBlock(content);
  if (!marked) return removeLegacyWeeklyReviewBlock(content);
  const before = content.slice(0, marked.start).trimEnd();
  const after = content.slice(marked.end).trimStart();
  return [before, after].filter(Boolean).join("\n\n");
}

export function removeCurrentWeeklyReviewBlock(content: string): string {
  const marked = findMarkedBlock(content);
  if (!marked) return content;
  const before = content.slice(0, marked.start).trimEnd();
  const after = content.slice(marked.end).trimStart();
  return [before, after].filter(Boolean).join("\n\n");
}

export function hasCurrentWeeklyReviewBlock(content: string): boolean {
  return findMarkedBlock(content) !== null;
}

export function getWeeklyReviewWeekStart(content: string): string | null {
  const marked = findMarkedBlock(content);
  if (!marked) return null;
  const startLine = content.slice(marked.start, marked.end).split("\n")[0] ?? "";
  const match = startLine.match(/^<!-- LIFE_PULSE_WEEKLY_REVIEW_START\s+(\d{4}-\d{2}-\d{2})\s+-->$/);
  return match?.[1] ?? null;
}

function parseMarkedReflection(content: string): WeeklyReviewReflection | null {
  const marked = findMarkedBlock(content);
  if (!marked) return null;
  const body = content.slice(marked.start, marked.end).replace(/^<!-- LIFE_PULSE_WEEKLY_REVIEW_START[^>]*-->/, "").replace(WEEKLY_REVIEW_END, "").trim();
  const firstLine = body.split("\n")[0]?.trim();
  if (!firstLine) return null;

  try {
    const parsed = JSON.parse(firstLine) as Partial<EncodedWeeklyReviewReflection>;
    return normalizeWeeklyReviewReflection({
      wentWell: decodeField(parsed.wentWell),
      movedForward: decodeField(parsed.movedForward),
      gotInTheWay: decodeField(parsed.gotInTheWay),
      learned: decodeField(parsed.learned),
      continueDoing: decodeField(parsed.continueDoing),
      changeNextWeek: decodeField(parsed.changeNextWeek),
      focusNextWeek: decodeField(parsed.focusNextWeek),
    });
  } catch {
    return null;
  }
}

function extractLegacySection(content: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"));
  return match?.[1]?.trim() ?? "";
}

export function parseWeeklyReviewReflection(content: string): WeeklyReviewReflection {
  const parsed = parseMarkedReflection(content);
  if (parsed) return parsed;

  return normalizeWeeklyReviewReflection({
    wentWell: extractLegacySection(content, "What went well"),
    movedForward: "",
    gotInTheWay: extractLegacySection(content, "What felt difficult"),
    learned: "",
    continueDoing: "",
    changeNextWeek: extractLegacySection(content, "Reduce or avoid"),
    focusNextWeek: extractLegacySection(content, "Next week focus"),
  });
}
