// Life Pulse PLAN V1 (Prompt 2/3) tests.
// Morning Plan + Midday Reset + Today execution: domain rules (shared truth)
// plus static guards that web + mobile expose the same daily-planning
// capability. Run from repo root: `node --test scripts/test-plan-v2.mjs`

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_DAILY_PRIORITIES,
  DAILY_PLAN_EVENT_TYPES,
  applyDailyMustWin,
  buildPlanEventInsert,
  buildPriorityInsert,
  buildPriorityUpdate,
  getDayPlanDate,
  nextPriorityPosition,
  orderDailyPriorities,
  priorityReferenceKind,
  rankMorningCandidates,
  summarizeDayPlan,
  validateDayPriorities,
} from "../packages/domain/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

function dayPriority(overrides = {}) {
  return {
    id: "p1",
    user_id: "u",
    local_date: "2026-10-07",
    position: 1,
    text: "Finish geometry",
    task_id: "t1",
    habit_id: null,
    outcome_id: null,
    is_must_win: false,
    done: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("daily big 3 constraints", () => {
  it("max 3 daily priorities, positions fill 1-3", () => {
    assert.equal(MAX_DAILY_PRIORITIES, 3);
    assert.equal(nextPriorityPosition([]), 1);
    assert.equal(nextPriorityPosition([{ position: 1 }, { position: 3 }]), 2);
    assert.equal(nextPriorityPosition([{ position: 1 }, { position: 2 }, { position: 3 }]), null);
  });

  it("order canonically by position", () => {
    assert.deepEqual(orderDailyPriorities([{ position: 2 }, { position: 1 }]).map((p) => p.position), [1, 2]);
  });

  it("insert requires non-blank text, valid position, single reference", () => {
    assert.equal(buildPriorityInsert("u", "2026-10-07", 1, { text: "  " }), null);
    assert.equal(buildPriorityInsert("u", "2026-10-07", 4, { text: "x" }), null);
    assert.equal(
      buildPriorityInsert("u", "2026-10-07", 1, { text: "x", task_id: "t", habit_id: "h" }),
      null,
    );
    const payload = buildPriorityInsert("u", "2026-10-07", 2, { text: "  Win  ", outcome_id: "o" });
    assert.equal(payload.text, "Win");
    assert.equal(payload.position, 2);
    assert.equal(payload.outcome_id, "o");
  });

  it("update short-circuits without a write", () => {
    const current = dayPriority();
    assert.equal(buildPriorityUpdate(current, {}), null);
    assert.equal(buildPriorityUpdate(current, { text: "Finish geometry" }), null);
    assert.equal(buildPriorityUpdate(current, { text: "  " }), null);
    assert.deepEqual(buildPriorityUpdate(current, { done: true }), { done: true });
  });

  it("validation rejects overflow, dupes, blanks, double refs, double must-win", () => {
    assert.deepEqual(validateDayPriorities([dayPriority()]), []);
    assert.ok(validateDayPriorities([dayPriority(), dayPriority({ id: "p2", position: 2 }), dayPriority({ id: "p3", position: 3 }), dayPriority({ id: "p4", position: 1 })]).some((p) => p.includes("at most 3")));
    assert.ok(validateDayPriorities([dayPriority(), dayPriority({ id: "p2", position: 1 })]).some((p) => p.includes("unique")));
    assert.ok(validateDayPriorities([dayPriority({ text: " " })]).some((p) => p.includes("blank")));
    assert.ok(validateDayPriorities([dayPriority({ habit_id: "h", outcome_id: "o" })]).some((p) => p.includes("at most one")));
    assert.ok(validateDayPriorities([dayPriority({ is_must_win: true }), dayPriority({ id: "p2", position: 2, is_must_win: true })]).some((p) => p.includes("Must Win")));
  });

  it("reference kind resolves task/habit/outcome/text", () => {
    assert.equal(priorityReferenceKind(dayPriority()), "task");
    assert.equal(priorityReferenceKind(dayPriority({ task_id: null, habit_id: "h" })), "habit");
    assert.equal(priorityReferenceKind(dayPriority({ task_id: null, outcome_id: "o" })), "outcome");
    assert.equal(priorityReferenceKind(dayPriority({ task_id: null })), "text");
  });
});

describe("daily must win (max 1, distinct from weekly)", () => {
  it("applyDailyMustWin keeps exactly the chosen priority flagged", () => {
    const rows = [dayPriority({ id: "a", is_must_win: true }), dayPriority({ id: "b", position: 2 })];
    assert.deepEqual(applyDailyMustWin(rows, "b").map((r) => r.is_must_win), [false, true]);
    assert.deepEqual(applyDailyMustWin(rows, null).map((r) => r.is_must_win), [false, false]);
  });
});

describe("deterministic morning candidates", () => {
  const base = {
    localDate: "2026-10-07",
    plannedTaskIds: new Set(),
    plannedHabitIds: new Set(),
    plannedOutcomeIds: new Set(),
  };

  it("orders overdue → due-today → outcome work → habits → outcomes", () => {
    const ranked = rankMorningCandidates({
      ...base,
      tasks: [
        { id: "t-due", title: "Due", due_date: "2026-10-07", status: "todo", priority: "medium" },
        { id: "t-over", title: "Over", due_date: "2026-10-05", status: "todo", priority: "low" },
        { id: "t-out", title: "Out", due_date: null, status: "todo", priority: "medium", outcome_id: "o1", outcome_title: "Geometry" },
        { id: "t-done", title: "Done", due_date: "2026-10-07", status: "done", priority: "high" },
      ],
      habitsDue: [{ id: "h1", title: "Gym" }],
      outcomes: [{ id: "o1", title: "Geometry", done: false }],
    });
    const ids = ranked.map((c) => c.id);
    assert.deepEqual(ids, ["t-over", "t-due", "t-out", "h1", "o1"]);
    assert.equal(ranked[0].reason, "Overdue");
    assert.equal(ranked[2].reason, "Supports: Geometry");
  });

  it("weekly Must Win support is called out, done items excluded", () => {
    const ranked = rankMorningCandidates({
      ...base,
      tasks: [{ id: "t", title: "T", due_date: "2026-10-07", status: "todo", priority: "high", supportsWeeklyMustWin: true }],
      habitsDue: [],
      outcomes: [{ id: "o", title: "O", done: true }],
    });
    assert.equal(ranked.length, 1);
    assert.ok(ranked[0].reason.includes("Must Win"));
  });

  it("already-planned items never resurface", () => {
    const ranked = rankMorningCandidates({
      localDate: "2026-10-07",
      plannedTaskIds: new Set(["t1"]),
      plannedHabitIds: new Set(["h1"]),
      plannedOutcomeIds: new Set(["o1"]),
      tasks: [{ id: "t1", title: "T", due_date: "2026-10-07", status: "todo", priority: "high" }],
      habitsDue: [{ id: "h1", title: "H" }],
      outcomes: [{ id: "o1", title: "O", done: false }],
    });
    assert.deepEqual(ranked, []);
  });

  it("works with no weekly plan (empty inputs, free text still allowed)", () => {
    const ranked = rankMorningCandidates({
      localDate: "2026-10-07",
      plannedTaskIds: new Set(),
      plannedHabitIds: new Set(),
      plannedOutcomeIds: new Set(),
      tasks: [],
      habitsDue: [],
      outcomes: [],
    });
    assert.deepEqual(ranked, []);
  });
});

describe("local-date semantics", () => {
  it("day plan date defaults to local today and passes through", () => {
    assert.match(getDayPlanDate(), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(getDayPlanDate("2026-10-07"), "2026-10-07");
  });
});

describe("midday reset + history evidence", () => {
  it("keep writes nothing (no keep event type exists)", () => {
    assert.ok(!DAILY_PLAN_EVENT_TYPES.includes("midday_keep"));
    assert.ok(DAILY_PLAN_EVENT_TYPES.includes("midday_reset"));
    assert.ok(DAILY_PLAN_EVENT_TYPES.includes("morning_plan_confirmed"));
  });

  it("event payloads validate type and trim detail", () => {
    assert.equal(buildPlanEventInsert("u", "2026-10-07", "bogus"), null);
    const payload = buildPlanEventInsert("u", "2026-10-07", "priority_replaced", "p1", '  a → b  ');
    assert.equal(payload.event_type, "priority_replaced");
    assert.equal(payload.detail, "a → b");
    const bare = buildPlanEventInsert("u", "2026-10-07", "midday_reset");
    assert.equal(bare.priority_id, null);
    assert.equal(bare.detail, null);
  });

  it("summary is factual counts and titles only", () => {
    const summary = summarizeDayPlan([
      dayPriority({ text: "A", done: true, is_must_win: true }),
      dayPriority({ id: "p2", position: 2, text: "B", task_id: null }),
    ]);
    assert.deepEqual(summary, {
      planned: ["A", "B"],
      completed: ["A"],
      remaining: ["B"],
      mustWin: "A",
      total: 2,
      doneCount: 1,
    });
    assert.ok(!("score" in summary) && !("percent" in summary));
  });
});

describe("daily planning schema (00045)", () => {
  const migration = read("supabase/migrations/00045_daily_planning.sql");

  it("extends priorities without a competing table", () => {
    assert.ok(migration.includes("habit_id"), "missing habit reference");
    assert.ok(migration.includes("outcome_id"), "missing outcome reference");
    assert.ok(migration.includes("is_must_win"), "missing daily must win");
    assert.ok(!migration.includes("create table") || !migration.match(/create table if not exists public\.daily_priorities/), "competing daily table created");
  });

  it("enforces single reference and single must win in SQL", () => {
    assert.ok(migration.includes("today_priorities_single_reference"), "missing single-reference check");
    assert.ok(migration.includes("where is_must_win"), "missing partial unique must-win index");
  });

  it("destination-parent ownership enforced like 00044", () => {
    assert.ok(migration.includes("weekly_outcome_belongs_to_user"), "missing outcome ownership helper");
    const count = (migration.match(/weekly_outcome_belongs_to_user\(outcome_id\)/g) ?? []).length;
    assert.ok(count >= 2, `outcome ownership enforced in only ${count} checks`);
  });

  it("history is append-only and owner-scoped", () => {
    assert.ok(migration.includes("daily_plan_events"), "missing events table");
    assert.ok(migration.includes("grant select, insert on table public.daily_plan_events"), "events must be append-only");
    assert.ok(!migration.includes("daily_plan_events_update_own"), "events must not be updatable");
    assert.ok(!migration.includes("daily_plan_events_delete_own"), "events must not be deletable");
  });
});

describe("daily planning surfaces on both clients", () => {
  it("web plan hosts the morning planner", () => {
    const page = read("src/app/plan/page.tsx");
    assert.ok(page.includes("TodayPlanner"), "web plan missing Today section");
    assert.ok(page.includes('id="today-plan-heading"') || page.includes("today-plan-heading"), "web plan TODAY section missing");
  });

  it("web planner covers pick, must win, adjust, reset, evidence", () => {
    const planner = read("src/components/plan/TodayPlanner.tsx");
    for (const needle of [
      "rankMorningCandidates",
      "setDailyMustWin",
      "morning_plan_confirmed",
      "midday_reset",
      "priority_replaced",
      "Still the right plan?",
      "Today&apos;s Must Win",
    ]) {
      assert.ok(planner.includes(needle), `web planner missing: ${needle}`);
    }
  });

  it("web today shows must win, progress, and adjust entry", () => {
    const today = read("src/app/today/page.tsx");
    assert.ok(today.includes("TodayPlanBlock"), "web today missing plan block");
    assert.ok(today.includes("Adjust plan"), "web today missing adjust entry");
    assert.ok(today.includes("priorities complete"), "web today missing factual progress");
  });

  it("web shutdown reviews planned/completed/remaining", () => {
    const shutdown = read("src/components/today/EveningShutdown.tsx");
    assert.ok(shutdown.includes("PlanReviewBlock"), "shutdown missing plan review");
    assert.ok(shutdown.includes("summarizeDayPlan"), "shutdown not using shared summary");
  });

  it("mobile plan hosts the same morning planner capability", () => {
    const screen = read("apps/mobile/app/(tabs)/plan.tsx");
    for (const needle of [
      "rankMorningCandidates",
      "setDailyMustWin",
      "morning_plan_confirmed",
      "midday_reset",
      "Reset today",
      "TODAY",
    ]) {
      assert.ok(screen.includes(needle), `mobile plan missing: ${needle}`);
    }
    const layout = read("apps/mobile/app/(tabs)/_layout.tsx");
    const tabs = (layout.match(/<Tabs\.Screen name="(\w+)" \/>/g) ?? []).length;
    assert.equal(tabs, 5, `mobile tab bar must stay at five (found ${tabs})`);
  });

  it("mobile today shows must win, progress, and adjust entry", () => {
    const today = read("apps/mobile/app/(tabs)/today.tsx");
    assert.ok(today.includes("TodayPlanSummary"), "mobile today missing plan summary");
    assert.ok(today.includes("Adjust plan"), "mobile today missing adjust entry");
    assert.ok(today.includes("priorities complete"), "mobile today missing factual progress");
  });

  it("parity matrix documents Prompt 2 capabilities", () => {
    const matrix = read("docs/PARITY_MATRIX.md");
    for (const needle of ["Morning Plan", "Daily Must Win", "Midday Reset", "adjustment history", "Today Must Win"]) {
      assert.ok(matrix.includes(needle), `matrix missing: ${needle}`);
    }
  });
});
