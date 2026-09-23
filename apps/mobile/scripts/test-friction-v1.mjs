// Life Pulse premium friction-v1 focused tests.
// Deterministic logic + structure assertions (no snapshots, no network).
// Run: `node --test scripts/test-friction-v1.mjs` from apps/mobile.
// Node 24 strips types, so domain TS modules import directly.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  buildTaskUpdatePayload,
  buildHabitUpdatePayload,
  normalizeHabitSchedule,
  WEEKDAY_DAYS,
  removeDeletedById,
  isDeletedEverywhere,
  createSingleFlight,
  normalizeItemTitle,
  isValidItemTitle,
  groupTasksByDate,
  isHabitDueOnDate,
} from "../../../packages/domain/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const read = (rel) => readFileSync(path.join(appDir, rel), "utf8");
const mobileSrc = (rel) => read(rel);
const migration = (name) =>
  readFileSync(path.join(appDir, "..", "..", "supabase", "migrations", name), "utf8");

// ---------------------------------------------------------------- tasks ---

describe("tasks — edit updates the same row, never duplicates", () => {
  const current = { title: "Prepare report", priority: "medium", due_date: "2026-09-12" };

  it("edit returns an update payload (no id, no insert fields)", () => {
    const built = buildTaskUpdatePayload(current, {
      title: "Prepare report v2",
      priority: "high",
      dueDate: "2026-09-13",
    });
    assert.equal(built.ok, true);
    assert.ok(built.ok);
    assert.deepEqual(Object.keys(built.payload).sort(), ["due_date", "priority", "title"]);
    assert.ok(!("id" in built.payload), "id must never be in the payload");
    assert.ok(!("user_id" in built.payload), "user_id must never be in the payload");
    assert.ok(!("status" in built.payload), "status must never be in the payload");
    assert.equal(built.changed, true);
  });

  it("unchanged values short-circuit without a write", () => {
    const built = buildTaskUpdatePayload(current, {
      title: "Prepare report",
      priority: "medium",
      dueDate: "2026-09-12",
    });
    assert.ok(built.ok);
    assert.equal(built.changed, false);
  });

  it("empty title is rejected (no blank update, no duplicate)", () => {
    const built = buildTaskUpdatePayload(current, { title: "   ", priority: "medium", dueDate: "" });
    assert.equal(built.ok, false);
  });

  it("invalid due date is rejected with guidance", () => {
    const built = buildTaskUpdatePayload(current, { title: "T", priority: "medium", dueDate: "tomorrow" });
    assert.equal(built.ok, false);
    assert.ok(built.error.includes("YYYY-MM-DD"));
    const cleared = buildTaskUpdatePayload(current, { title: "T", priority: "medium", dueDate: "" });
    assert.ok(cleared.ok);
    assert.equal(cleared.payload.due_date, null);
  });

  it("title is trimmed and capped, never blank-whitespace", () => {
    assert.equal(normalizeItemTitle("  hello  "), "hello");
    assert.equal(isValidItemTitle("   "), false);
    assert.equal(isValidItemTitle("x".repeat(121)), false);
    assert.equal(isValidItemTitle("x".repeat(120)), true);
  });
});

describe("tasks — delete removes own task and clears presented state", () => {
  const list = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" },
  ];

  it("optimistic removal drops exactly the deleted id, order preserved", () => {
    assert.deepEqual(removeDeletedById(list, "b").map((t) => t.id), ["a", "c"]);
    assert.equal(list.length, 3, "input is not mutated");
  });

  it("deleted task is gone from every presenting list (Tasks + Today)", () => {
    const after = removeDeletedById(list, "b");
    const todayList = removeDeletedById(list, "b");
    assert.equal(isDeletedEverywhere([after, todayList], "b"), true);
    assert.equal(isDeletedEverywhere([after, list], "b"), false);
  });

  it("grouping no longer surfaces a deleted task", () => {
    const tasks = [
      { id: "keep", priority: "medium", due_date: "2026-09-12", status: "todo", completed_at: null },
      { id: "gone", priority: "high", due_date: "2026-09-12", status: "todo", completed_at: null },
    ];
    const before = groupTasksByDate(tasks, "2026-09-12");
    assert.equal(before.dueToday.length, 2);
    const after = groupTasksByDate(removeDeletedById(tasks, "gone"), "2026-09-12");
    assert.deepEqual(after.dueToday.map((t) => t.id), ["keep"]);
  });
});

describe("tasks — interaction safety", () => {
  it("repeated save taps run once (single-flight guard)", async () => {
    const guard = createSingleFlight();
    let calls = 0;
    const work = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return "done";
    };
    const [first, second] = await Promise.all([guard.run(work), guard.run(work)]);
    assert.equal(first.started, true);
    assert.equal(first.result, "done");
    assert.equal(second.started, false);
    assert.equal(calls, 1);
    const third = await guard.run(work);
    assert.equal(third.started, true, "guard releases after settle");
    assert.equal(calls, 2);
  });

  it("long-press opens actions; short-press completion path is untouched", () => {
    const src = mobileSrc("app/(tabs)/tasks.tsx");
    assert.ok(src.includes("onLongPress={() => onOpenActions(task)"), "row long-press wires the action sheet");
    assert.ok(src.includes("visible={actionTask !== null}"), "sheet visibility is driven by the long-pressed task");
    assert.ok(src.includes("<ItemActionSheet"), "shared action sheet is used (not a native popup)");
    assert.ok(src.includes("onPress={() => onComplete(task.id)}"), "checkbox short-press still completes");
    assert.ok(!/onPress=\{\(\) => onOpenActions/.test(src), "long-press target has no tap handler that could conflict");
  });

  it("mutations stay scoped to the owner (no cross-user access)", () => {
    const src = mobileSrc("app/(tabs)/tasks.tsx");
    for (const op of [".update(", ".delete()", ".insert("]) {
      assert.ok(src.includes(op), `expected a ${op} call`);
    }
    const scopedUpdates = (src.match(/\.eq\("user_id", user\.id\)/g) ?? []).length;
    assert.ok(scopedUpdates >= 4, `expected user scoping on every mutation, found ${scopedUpdates}`);
    const schema = migration("00001_schema.sql");
    for (const policy of ["tasks_update_own", "tasks_delete_own", "tasks_insert_own", "tasks_select_own"]) {
      assert.ok(schema.includes(policy), `missing RLS policy ${policy}`);
    }
  });
});

// ---------------------------------------------------------------- habits ---

describe("habits — edit preserves identity and history", () => {
  const current = { title: "Brush teeth", frequency: "daily", days_of_week: [], times_per_week: null };

  it("edit returns a definition-only payload (history untouched)", () => {
    const built = buildHabitUpdatePayload(current, {
      title: "Brush teeth nightly",
      frequency: "daily",
      daysOfWeek: [],
      timesPerWeek: 3,
    });
    assert.ok(built.ok);
    assert.deepEqual(Object.keys(built.payload).sort(), ["days_of_week", "frequency", "times_per_week", "title"]);
    assert.ok(!("id" in built.payload));
    assert.ok(!("completedDates" in built.payload), "completion history must never be in the payload");
    assert.equal(built.changed, true);
  });

  it("leaving weekly clears a stale times_per_week target", () => {
    const weekly = { title: "Run", frequency: "weekly", days_of_week: [1, 3], times_per_week: 3 };
    const built = buildHabitUpdatePayload(weekly, {
      title: "Run",
      frequency: "daily",
      daysOfWeek: [],
      timesPerWeek: 3,
    });
    assert.ok(built.ok);
    assert.equal(built.payload.times_per_week, null);
  });

  it("weekly keeps a clamped times_per_week target", () => {
    const built = buildHabitUpdatePayload(current, {
      title: "Run",
      frequency: "weekly",
      daysOfWeek: [1, 3],
      timesPerWeek: 9,
    });
    assert.ok(built.ok);
    assert.equal(built.payload.times_per_week, 7);
    assert.equal(built.payload.frequency, "weekly");
  });

  it("deleted habit stops being presented Today", () => {
    const habits = [
      { id: "keep", frequency: "daily", days_of_week: null, title: "Keep" },
      { id: "gone", frequency: "daily", days_of_week: null, title: "Gone" },
    ];
    const today = "2026-09-12"; // a Saturday; daily habits are due
    const before = habits.filter((h) => isHabitDueOnDate(h, today, []));
    assert.equal(before.length, 2);
    const after = removeDeletedById(habits, "gone").filter((h) => isHabitDueOnDate(h, today, []));
    assert.deepEqual(after.map((h) => h.id), ["keep"]);
  });
});

describe("habits — interaction safety", () => {
  it("repeated save taps run once (single-flight guard)", async () => {
    const guard = createSingleFlight();
    let calls = 0;
    const [first, second] = await Promise.all([
      guard.run(async () => { calls += 1; return 1; }),
      guard.run(async () => { calls += 1; return 2; }),
    ]);
    assert.equal(first.started, true);
    assert.equal(second.started, false);
    assert.equal(calls, 1);
  });

  it("long-press opens actions without completing", () => {
    const src = mobileSrc("app/(tabs)/habits.tsx");
    assert.ok(src.includes("onLongPress={() => onOpenActions(habit)"), "row long-press wires the action sheet");
    assert.ok(src.includes("visible={actionHabit !== null}"), "sheet visibility is driven by the long-pressed habit");
    const openActions = src.slice(src.indexOf("const openActions"), src.indexOf("const confirmDeleteHabit"));
    assert.ok(!openActions.includes("onComplete"), "opening actions must not trigger completion");
    assert.ok(src.includes("onPress={() => (isCompleted ? onUndo(habit.id) : onComplete(habit.id))}"), "tap toggles completion as before");
  });

  it("completion stays idempotent (no double logs)", () => {
    const src = mobileSrc("app/(tabs)/habits.tsx");
    assert.ok(src.includes(".maybeSingle()"), "existing today-log is checked before insert");
    assert.ok(src.includes("if (!existing)"), "insert is skipped when a log already exists");
  });

  it("habit delete uses cascade semantics, scoped to the owner", () => {
    const schema = migration("00001_schema.sql");
    assert.ok(
      schema.includes("habit_id uuid not null references public.habits(id) on delete cascade"),
      "habit_logs must cascade when a habit is deleted (no orphans)",
    );
    for (const policy of ["habits_update_own", "habits_delete_own", "habit_logs_delete_own"]) {
      assert.ok(schema.includes(policy), `missing RLS policy ${policy}`);
    }
    const src = mobileSrc("app/(tabs)/habits.tsx");
    assert.ok(src.includes('.delete().eq("id", target.id).eq("user_id", user.id)'), "habit delete is owner-scoped");
  });
});

// --------------------------------------- habit schedule normalization ---

describe("habits — schedule normalization across mode switches", () => {
  it("weekly -> daily clears weekly-only values, keeps the same identity", () => {
    const current = { id: "h1", title: "Run", frequency: "weekly", days_of_week: [1, 3], times_per_week: 3 };
    const built = buildHabitUpdatePayload(current, {
      title: "Run",
      frequency: "daily",
      daysOfWeek: [1, 3],
      timesPerWeek: 3,
    });
    assert.ok(built.ok);
    assert.deepEqual(built.payload, { title: "Run", frequency: "daily", days_of_week: [], times_per_week: null });
    assert.ok(!("id" in built.payload), "id is carried by the caller scope, never the payload");
    assert.ok(!("completedDates" in built.payload), "history untouched");
    assert.equal(built.changed, true);
  });

  it("daily with stale days normalizes them away on save", () => {
    const schedule = normalizeHabitSchedule("daily", [0, 6], 4);
    assert.deepEqual(schedule, { frequency: "daily", days_of_week: [], times_per_week: null });
  });

  it("daily/weekly -> weekdays with no days falls back to Mon-Fri (never a dead habit)", () => {
    const schedule = normalizeHabitSchedule("weekdays", [], 3);
    assert.equal(schedule.frequency, "weekdays");
    assert.deepEqual(schedule.days_of_week, [1, 2, 3, 4, 5]);
    assert.deepEqual([...WEEKDAY_DAYS], [1, 2, 3, 4, 5]);
    assert.equal(schedule.times_per_week, null);
  });

  it("weekly -> weekdays keeps explicitly selected days", () => {
    const built = buildHabitUpdatePayload(
      { title: "Gym", frequency: "weekly", days_of_week: [2, 4], times_per_week: 2 },
      { title: "Gym", frequency: "weekdays", daysOfWeek: [2, 4], timesPerWeek: 2 },
    );
    assert.ok(built.ok);
    assert.deepEqual(built.payload.days_of_week, [2, 4]);
    assert.equal(built.payload.times_per_week, null);
  });

  it("weekdays keeps valid days and clears weekly targets", () => {
    const schedule = normalizeHabitSchedule("weekdays", [6, 0, 6, 9, -1], 5);
    assert.deepEqual(schedule.days_of_week, [0, 6], "only valid days survive, deduped and sorted");
    assert.equal(schedule.times_per_week, null);
  });

  it("weekly keeps entered days and clamps the target", () => {
    const schedule = normalizeHabitSchedule("weekly", [1, 3], 9);
    assert.deepEqual(schedule.days_of_week, [1, 3]);
    assert.equal(schedule.times_per_week, 7);
  });

  it("normalized schedules stay completable (due logic honors the mode)", () => {
    // Monday 2026-09-14, Sunday 2026-09-13.
    const monday = "2026-09-14";
    const sunday = "2026-09-13";
    const daily = normalizeHabitSchedule("daily", [0, 6], 3);
    assert.equal(isHabitDueOnDate({ ...daily }, monday, []), true);
    const weekdays = normalizeHabitSchedule("weekdays", [], 3);
    assert.equal(isHabitDueOnDate({ ...weekdays }, monday, []), true, "Mon-Fri default is due Monday");
    assert.equal(isHabitDueOnDate({ ...weekdays }, sunday, []), false, "Mon-Fri default is not due Sunday");
    const emptyWeekdaysInert = { frequency: "weekdays", days_of_week: [] };
    assert.equal(isHabitDueOnDate(emptyWeekdaysInert, monday, []), false, "empty days would be a dead habit");
    const weekly = normalizeHabitSchedule("weekly", [], 2);
    assert.equal(isHabitDueOnDate({ ...weekly, times_per_week: 2 }, monday, []), true);
    assert.equal(isHabitDueOnDate({ ...weekly, times_per_week: 2 }, monday, [monday]), true, "weekly target 2/week is not met by one completion");
    assert.equal(isHabitDueOnDate({ ...weekly, times_per_week: 2 }, "2026-09-15", [monday, "2026-09-15"]), false, "weekly target met for the week");
  });

  it("edit form offers day selection for weekdays and re-opens normalized state", () => {
    const src = mobileSrc("app/(tabs)/habits.tsx");
    assert.ok(
      src.includes('(formFrequency === "weekly" || formFrequency === "weekdays")'),
      "day picker is available for weekdays, not just weekly",
    );
    assert.ok(src.includes("normalizeHabitSchedule(formFrequency"), "create path normalizes too (no dead weekdays creates)");
  });
});

// -------------------------------------------------------------- more nav ---
describe("more navigation — five tabs, hub, hidden children", () => {
  const layout = mobileSrc("app/(tabs)/_layout.tsx");

  it("exactly five permanent tabs ending in More", () => {
    assert.ok(layout.includes('"more"'), "more tab key exists");
    assert.ok(!/["']account["']\s*:\s*\{\s*Icon/.test(layout), "account is not a permanent tab");
    for (const key of ["today", "nextron", "tasks", "habits", "more"]) {
      assert.ok(layout.includes(`${key}: { Icon:`), `missing tab ${key}`);
    }
  });

  it("More uses an SVG ellipsis icon, no emoji, no icon font", () => {
    assert.ok(layout.includes('More } from "../../src/icons"'), "More icon comes from the SVG set");
    assert.ok(existsSync(path.join(appDir, "src", "icons", "More.tsx")), "More.tsx exists");
    const icon = mobileSrc("src/icons/More.tsx");
    assert.ok(icon.includes("react-native-svg"), "More icon is SVG-based");
    assert.ok(!/[^\x00-\x7F]/.test(icon), "no emoji/non-ascii in the icon");
    assert.ok(mobileSrc("src/icons/index.ts").includes('export { More } from "./More"'), "More is exported");
  });

  it("Account and Settings are reachable but never a sixth tab", () => {
    assert.ok(layout.includes('<Tabs.Screen name="account" options={{ href: null }}'), "account route hidden from bar");
    assert.ok(layout.includes('<Tabs.Screen name="settings" options={{ href: null }}'), "settings route hidden from bar");
    assert.ok(existsSync(path.join(appDir, "app", "(tabs)", "settings.tsx")), "settings screen exists");
    assert.ok(existsSync(path.join(appDir, "app", "(tabs)", "more.tsx")), "more hub exists");
  });

  it("More hub links Realms, Settings, and Account", () => {
    const more = mobileSrc("app/(tabs)/more.tsx");
    assert.ok(more.includes('href="/realms"'), "More links Realms");
    assert.ok(more.includes('href="/(tabs)/settings"'), "More links Settings");
    assert.ok(more.includes('href="/(tabs)/account"'), "More links Account");
  });

  it("hub children navigate back to More", () => {
    assert.ok(mobileSrc("app/(tabs)/settings.tsx").includes("router.back()"), "settings goes back");
    assert.ok(mobileSrc("app/(tabs)/account.tsx").includes("router.back()"), "account goes back");
  });
});
