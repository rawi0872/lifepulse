// Life Pulse PLAN V1 (Prompt 1/3) tests.
// Domain rules evaluated against @lifepulse/domain (shared truth) plus
// static guards that web + mobile expose the same weekly-plan capability.
// Run from repo root: `node --test scripts/test-plan-v1.mjs`

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_WEEKLY_OUTCOMES,
  applyMustWin,
  buildWeeklyOutcomeInsert,
  buildWeeklyOutcomeUpdate,
  buildWeeklyPlanInsert,
  getCurrentPlanWeekRange,
  getPlanWeekRange,
  getPlanWeekStart,
  isPlanWeekStart,
  isValidOutcomeText,
  nextOutcomePosition,
  orderOutcomes,
  summarizePlanEvidence,
  validateWeeklyPlanSnapshot,
} from "../packages/domain/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const MONDAY = "2026-10-05"; // a Monday
const SUNDAY = "2026-10-11";

function makeSnapshot() {
  return {
    plan: {
      id: "plan-1",
      user_id: "user-1",
      week_start: MONDAY,
      week_end: SUNDAY,
      intention: "Ship the plan",
      created_at: "2026-10-05T00:00:00Z",
      updated_at: "2026-10-05T00:00:00Z",
    },
    outcomes: [
      { id: "o1", user_id: "user-1", plan_id: "plan-1", position: 1, text: "Finish geometry", done: false, must_win: true, goal_id: null, project_id: null, created_at: "", updated_at: "" },
      { id: "o2", user_id: "user-1", plan_id: "plan-1", position: 2, text: "Publish outreach", done: false, must_win: false, goal_id: "g1", project_id: null, created_at: "", updated_at: "" },
    ],
    links: [
      { id: "l1", user_id: "user-1", plan_id: "plan-1", linked_type: "task", linked_id: "t1", created_at: "" },
      { id: "l2", user_id: "user-1", plan_id: "plan-1", linked_type: "habit", linked_id: "h1", created_at: "" },
    ],
  };
}

describe("plan week semantics (local Monday week, shared)", () => {
  it("week range is Monday..Sunday", () => {
    assert.deepEqual(getPlanWeekRange("2026-10-07"), { weekStart: MONDAY, weekEnd: SUNDAY });
    assert.deepEqual(getPlanWeekRange(MONDAY), { weekStart: MONDAY, weekEnd: SUNDAY });
    assert.deepEqual(getPlanWeekRange(SUNDAY), { weekStart: MONDAY, weekEnd: SUNDAY });
  });

  it("only Mondays are valid week starts (Weekly Review convention)", () => {
    assert.equal(getPlanWeekStart("2026-10-07"), MONDAY);
    assert.ok(isPlanWeekStart(MONDAY));
    assert.ok(!isPlanWeekStart("2026-10-07"));
    assert.ok(!isPlanWeekStart(SUNDAY));
  });

  it("current week range wraps today", () => {
    const { weekStart, weekEnd } = getCurrentPlanWeekRange();
    assert.ok(isPlanWeekStart(weekStart));
    assert.equal(getPlanWeekRange(weekStart).weekEnd, weekEnd);
  });
});

describe("weekly outcome constraints", () => {
  it("max 3 outcomes, positions fill 1-3 in order", () => {
    assert.equal(MAX_WEEKLY_OUTCOMES, 3);
    assert.equal(nextOutcomePosition([]), 1);
    assert.equal(nextOutcomePosition([{ position: 1 }, { position: 3 }]), 2);
    assert.equal(nextOutcomePosition([{ position: 1 }, { position: 2 }, { position: 3 }]), null);
  });

  it("outcome text follows task title rules (never blank)", () => {
    assert.ok(isValidOutcomeText("Finish geometry"));
    assert.ok(!isValidOutcomeText("   "));
    assert.ok(!isValidOutcomeText(""));
  });

  it("outcomes order canonically by position", () => {
    const ordered = orderOutcomes([{ position: 3 }, { position: 1 }, { position: 2 }]);
    assert.deepEqual(ordered.map((o) => o.position), [1, 2, 3]);
  });
});

describe("must win invariant (max 1)", () => {
  it("applyMustWin keeps exactly the chosen outcome flagged", () => {
    const rows = [{ id: "a", must_win: true }, { id: "b", must_win: false }];
    assert.deepEqual(applyMustWin(rows, "b").map((r) => r.must_win), [false, true]);
    assert.deepEqual(applyMustWin(rows, null).map((r) => r.must_win), [false, false]);
  });

  it("snapshot validation rejects two must-wins", () => {
    const snapshot = makeSnapshot();
    assert.deepEqual(validateWeeklyPlanSnapshot(snapshot), []);
    const bad = {
      ...snapshot,
      outcomes: snapshot.outcomes.map((o) => ({ ...o, must_win: true })),
    };
    assert.ok(validateWeeklyPlanSnapshot(bad).some((p) => p.includes("Must Win")));
  });

  it("snapshot validation rejects bad weeks, positions, blanks, foreign rows", () => {
    const base = makeSnapshot();
    assert.ok(validateWeeklyPlanSnapshot({ ...base, plan: { ...base.plan, week_start: "2026-10-07" } }).length > 0);
    assert.ok(validateWeeklyPlanSnapshot({ ...base, plan: { ...base.plan, week_end: "2026-10-12" } }).length > 0);
    assert.ok(
      validateWeeklyPlanSnapshot({ ...base, outcomes: [...base.outcomes, { ...base.outcomes[0], id: "o3", position: 2 }] })
        .some((p) => p.includes("unique")),
    );
    assert.ok(
      validateWeeklyPlanSnapshot({ ...base, outcomes: [{ ...base.outcomes[0], text: "  " }] })
        .some((p) => p.includes("blank")),
    );
    assert.ok(
      validateWeeklyPlanSnapshot({ ...base, links: [{ ...base.links[0], linked_type: "project" }] })
        .some((p) => p.includes("tasks or habits")),
    );
  });
});

describe("plan write payloads", () => {
  it("plan insert normalizes to the Monday week", () => {
    const payload = buildWeeklyPlanInsert({ user_id: "u", week_start: "2026-10-07", week_end: "2026-10-07", intention: "  Win  " });
    assert.equal(payload.week_start, MONDAY);
    assert.equal(payload.week_end, SUNDAY);
    assert.equal(payload.intention, "Win");
  });

  it("plan insert drops blank intention", () => {
    const payload = buildWeeklyPlanInsert({ user_id: "u", week_start: MONDAY, week_end: SUNDAY, intention: "   " });
    assert.equal(payload.intention, null);
  });

  it("outcome insert rejects bad position and blank text", () => {
    assert.equal(buildWeeklyOutcomeInsert({ user_id: "u", plan_id: "p", position: 4, text: "x" }), null);
    assert.equal(buildWeeklyOutcomeInsert({ user_id: "u", plan_id: "p", position: 1, text: "  " }), null);
    const payload = buildWeeklyOutcomeInsert({ user_id: "u", plan_id: "p", position: 1, text: "  Win  " });
    assert.equal(payload.text, "Win");
    assert.equal(payload.goal_id, null);
  });

  it("outcome update short-circuits without a write", () => {
    const current = { text: "Win", done: false, must_win: false, goal_id: null, project_id: null };
    assert.equal(buildWeeklyOutcomeUpdate(current, {}), null);
    assert.equal(buildWeeklyOutcomeUpdate(current, { text: "Win" }), null);
    assert.equal(buildWeeklyOutcomeUpdate(current, { text: "   " }), null);
    assert.deepEqual(buildWeeklyOutcomeUpdate(current, { done: true }), { done: true });
  });
});

describe("honest plan evidence (counts only, never a score)", () => {
  it("counts linked task completion and in-week habit days", () => {
    const snapshot = makeSnapshot();
    const evidence = summarizePlanEvidence(
      snapshot,
      [{ id: "t1", status: "done" }, { id: "t9", status: "done" }],
      [
        { habit_id: "h1", completed_date: "2026-10-06" },
        { habit_id: "h1", completed_date: "2026-10-06" },
        { habit_id: "h1", completed_date: "2026-10-12" },
        { habit_id: "h9", completed_date: "2026-10-06" },
      ],
    );
    assert.equal(evidence.linkedTasksTotal, 1);
    assert.equal(evidence.linkedTasksDone, 1);
    assert.equal(evidence.supportingHabitLogDays, 1);
    assert.ok(!("score" in evidence) && !("percent" in evidence));
  });
});

describe("plan schema + RLS migration", () => {
  const migration = read("supabase/migrations/00043_weekly_plans.sql");

  it("creates plans, outcomes, and link tables without domain copies", () => {
    for (const table of ["weekly_plans", "weekly_outcomes", "weekly_plan_links"]) {
      assert.ok(migration.includes(`create table if not exists public.${table}`), `missing ${table}`);
    }
    assert.ok(!migration.includes("weekly_plan_tasks"), "plan must not copy tasks");
    assert.ok(!migration.includes("weekly_plan_habits"), "plan must not copy habits");
  });

  it("enforces one plan per user/week and max-3 positions", () => {
    assert.ok(migration.includes("weekly_plans_user_week_unique"), "missing one-plan-per-week unique");
    assert.ok(migration.includes("position >= 1 and position <= 3"), "missing position check");
    assert.ok(migration.includes("weekly_outcomes_plan_position_unique"), "missing position unique");
  });

  it("enforces max one Must Win at the database level", () => {
    assert.ok(migration.includes("where must_win"), "missing partial unique index for must_win");
  });

  it("week boundaries are Monday..Sunday in SQL", () => {
    assert.ok(migration.includes("extract(isodow from week_start) = 1"), "missing Monday check");
    assert.ok(migration.includes("week_end = week_start + 6"), "missing Sunday check");
  });

  it("deletes never destroy tasks, habits, goals, or projects", () => {
    assert.ok(migration.includes("on delete cascade"), "plan rows should cascade within the plan");
    assert.ok(migration.includes("on delete set null"), "goal/project links must null, not destroy");
    const linkSection = migration.slice(migration.indexOf("weekly_plan_links"));
    assert.ok(!linkSection.includes("references public.tasks"), "task links must not FK tasks");
    assert.ok(!linkSection.includes("references public.habits"), "habit links must not FK habits");
  });

  it("RLS is owner-only with cross-user link rejection", () => {
    for (const table of ["weekly_plans", "weekly_outcomes", "weekly_plan_links"]) {
      assert.ok(migration.includes(`alter table public.${table} enable row level security`), `RLS off for ${table}`);
      assert.ok(migration.includes(`"${table}_select_own"`), `missing select policy for ${table}`);
      assert.ok(migration.includes(`"${table}_insert_own"`), `missing insert policy for ${table}`);
      assert.ok(migration.includes(`"${table}_delete_own"`), `missing delete policy for ${table}`);
    }
    assert.ok(migration.includes("public.task_belongs_to_user(linked_id)"), "task link ownership unchecked");
    assert.ok(migration.includes("public.habit_belongs_to_user(linked_id)"), "habit link ownership unchecked");
    assert.ok(migration.includes("public.goal_belongs_to_user(goal_id)"), "goal link ownership unchecked");
    assert.ok(migration.includes("public.project_belongs_to_user(project_id)"), "project link ownership unchecked");
  });
});

describe("plan surfaces exist on both clients", () => {
  it("web /plan page offers outcomes, must win, links, and next step", () => {
    const page = read("src/app/plan/page.tsx");
    assert.ok(page.includes("Plan your week"), "web plan missing empty state");
    assert.ok(page.includes("Must Win") || page.includes("Must win"), "web plan missing Must Win");
    assert.ok(page.includes("loadWeeklyPlan"), "web plan never loads the week");
    assert.ok(page.includes("Prepare today"), "web plan missing Today bridge");
    assert.ok(page.includes("/today"), "web plan never links Today");
  });

  it("web plan is guarded and navigable", () => {
    assert.ok(read("src/proxy.ts").includes('"/plan"'), "proxy does not guard /plan");
    assert.ok(read("src/components/DashboardNav.tsx").includes('href: "/plan"'), "nav missing Plan");
  });

  it("mobile plan screen offers the same capability without a sixth tab", () => {
    const screen = read("apps/mobile/app/(tabs)/plan.tsx");
    assert.ok(screen.includes("Plan your week"), "mobile plan missing empty state");
    assert.ok(screen.includes("Must Win"), "mobile plan missing Must Win");
    assert.ok(screen.includes("loadWeeklyPlan"), "mobile plan never loads the week");
    const layout = read("apps/mobile/app/(tabs)/_layout.tsx");
    const tabs = (layout.match(/<Tabs\.Screen name="(\w+)" \/>/g) ?? []).length;
    assert.equal(tabs, 5, `mobile tab bar must stay at five (found ${tabs})`);
    assert.ok(layout.includes('<Tabs.Screen name="plan" options={{ href: null }} />'), "plan is not a hidden tab route");
    const more = read("apps/mobile/app/(tabs)/more.tsx");
    assert.ok(more.includes('/(tabs)/plan'), "More hub missing Plan");
    const today = read("apps/mobile/app/(tabs)/today.tsx");
    assert.ok(today.includes("/(tabs)/plan"), "mobile Today missing Plan bridge");
  });

  it("web Today links the weekly plan", () => {
    const today = read("src/app/today/page.tsx");
    assert.ok(today.includes('href="/plan"'), "web Today missing Plan bridge");
    assert.ok(today.includes("loadTodayPlanBridge"), "web Today never loads the plan bridge");
  });

  it("parity matrix documents PLAN on both clients", () => {
    const matrix = read("docs/PARITY_MATRIX.md");
    assert.ok(matrix.includes("## PLAN"), "matrix missing ## PLAN");
    assert.ok(matrix.includes("Must Win"), "matrix never mentions Must Win");
  });

  it("review contract exists for Prompt 3", () => {
    const contract = read("docs/PLAN_WEEKLY_REVIEW_CONTRACT.md");
    assert.ok(contract.includes("week_start"), "contract never keys on week_start");
    assert.ok(contract.includes("What slipped?"), "contract missing review questions");
  });
});
