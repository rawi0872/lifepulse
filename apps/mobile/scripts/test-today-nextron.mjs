// Life Pulse Today + NEXTRON experience tests (Prompt 3).
// Deterministic: ranking rules (max one hero, dedupe, fair competition,
// analytical never hero), NEXTRON presentation helpers, and source-structure
// assertions proving no ranking/backend changes. No snapshots, no network.
// Run: `node --loader ./scripts/ts-extension-loader.mjs --test scripts/test-today-nextron.mjs`
// from apps/mobile.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  selectTodayPrimaryCandidate,
  selectMorningPlanFirstAction,
  deriveWealthSignalsV2,
  groupTasksByDate,
} from "../../../packages/domain/index.ts";
import { toCalmNextronError, buildNextronContextSummary } from "../lib/nextron-ui.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const read = (rel) => readFileSync(path.join(appDir, rel), "utf8");

const TODAY = "2026-09-12";

function ordinaryTask(id, title, reason = "Due today") {
  return {
    type: "task",
    id,
    title,
    reason,
    task: { id, title, description: null, priority: "medium", due_date: TODAY, status: "todo", completed_at: null, project_id: null },
  };
}

function wealthBill(id, dueDate) {
  return { kind: "wealth_bill_due", priority: 10, title: "Rent", rationale: `Scheduled ${dueDate}`, dueDate, sourceId: id, strength: "strong" };
}

// ---------------------------------------------------------------- ranking ---

describe("today ranking — one hero, fair competition, dedupe", () => {
  it("max one primary candidate (single object, never a list)", () => {
    const r = selectTodayPrimaryCandidate({ ordinaryUpNext: ordinaryTask("t1", "Write report"), wealthCandidate: wealthBill("w1", TODAY), todayStr: TODAY });
    assert.ok(r.chosen && typeof r.chosen === "object" && !Array.isArray(r.chosen));
    assert.ok(["ordinary", "wealth"].includes(r.source));
  });

  it("empty day selects nothing (quiet, no invented work)", () => {
    const r = selectTodayPrimaryCandidate({ ordinaryUpNext: null, wealthCandidate: null, todayStr: TODAY });
    assert.equal(r.source, null);
    assert.equal(r.chosen, null);
  });

  it("single-sided inputs pass through unchanged", () => {
    const ord = ordinaryTask("t1", "Write report");
    const onlyOrd = selectTodayPrimaryCandidate({ ordinaryUpNext: ord, wealthCandidate: null, todayStr: TODAY });
    assert.equal(onlyOrd.source, "ordinary");
    assert.equal(onlyOrd.chosen.id, "t1");
    const bill = wealthBill("w1", TODAY);
    const onlyWealth = selectTodayPrimaryCandidate({ ordinaryUpNext: null, wealthCandidate: bill, todayStr: TODAY });
    assert.equal(onlyWealth.source, "wealth");
    assert.equal(onlyWealth.chosen.title, "Rent");
  });

  it("strong bill due today beats an ordinary due-today task", () => {
    const r = selectTodayPrimaryCandidate({ ordinaryUpNext: ordinaryTask("t1", "Tidy desk"), wealthCandidate: wealthBill("w1", TODAY), todayStr: TODAY });
    assert.equal(r.source, "wealth", "bill urgency 9 outranks due-today medium 15");
  });

  it("ordinary overdue-high beats a far-off subscription", () => {
    const overdueHigh = { ...ordinaryTask("t1", "Fix leak"), reason: "Overdue" };
    const sub = { kind: "wealth_subscription_due", priority: 15, title: "Music", rationale: "Scheduled", dueDate: "2026-09-20", sourceId: "s1", strength: "strong" };
    const r = selectTodayPrimaryCandidate({ ordinaryUpNext: overdueHigh, wealthCandidate: sub, todayStr: TODAY });
    assert.equal(r.source, "ordinary", "overdue-high 10 outranks distant subscription 17");
  });

  it("ties resolve to ordinary (stability, no wealth slot)", () => {
    const dueTodayHigh = { ...ordinaryTask("t1", "File taxes"), reason: "Due today", task: { ...ordinaryTask("t1", "File taxes").task, priority: "high" } };
    const oldBill = wealthBill("w1", "2026-09-01"); // >7d overdue -> urgency 14, ties 14
    const r = selectTodayPrimaryCandidate({ ordinaryUpNext: dueTodayHigh, wealthCandidate: oldBill, todayStr: TODAY });
    assert.equal(r.source, "ordinary");
  });

  it("duplicate (same underlying item) collapses to ordinary", () => {
    const ord = ordinaryTask("shared-1", "Pay rent");
    const dupe = { ...wealthBill("shared-1", TODAY) };
    const r = selectTodayPrimaryCandidate({ ordinaryUpNext: ord, wealthCandidate: dupe, todayStr: TODAY });
    assert.equal(r.source, "ordinary");
    assert.equal(r.chosen.id, "shared-1");
  });

  it("ranking is deterministic and permission-independent", () => {
    const args = { ordinaryUpNext: ordinaryTask("t1", "Write report"), wealthCandidate: wealthBill("w1", TODAY), todayStr: TODAY };
    const a = selectTodayPrimaryCandidate(args);
    const b = selectTodayPrimaryCandidate({ ...args });
    assert.deepEqual(a, b);
  });
});

describe("today ranking — analytical signals never hero, deletions disappear", () => {
  it("insights alone produce analytical signals only (service strong-filter yields none)", () => {
    const signals = deriveWealthSignalsV2({
      billsDue: [], subsDue: [], tasksDue: [], habitsDue: [], goalsDue: [],
      insights: [{ kind: "cash_flow_negative", title: "Cash flow negative", rationale: "Outflows exceed inflows" }],
    });
    assert.ok(signals.length > 0, "insight produces a signal");
    assert.ok(signals.every((s) => s.strength === "analytical"), "insights never produce strong signals");
    assert.deepEqual(signals.filter((s) => s.strength === "strong"), [], "hero pool stays empty");
  });

  it("service-shaped pools (bills/subs/tasks/habits, no insights) carry no analytical signal", () => {
    const signals = deriveWealthSignalsV2({
      billsDue: [{ id: "b1", name: "Rent", next_due_date: TODAY }],
      subsDue: [], tasksDue: [], habitsDue: [], goalsDue: [], insights: [],
    });
    assert.ok(signals.some((s) => s.strength === "strong"));
    assert.ok(signals.every((s) => s.strength === "strong"));
  });

  it("completed tasks leave the due set (no stale Today rows)", () => {
    const tasks = [
      { id: "done", priority: "high", due_date: TODAY, status: "done", completed_at: `${TODAY}T10:00:00` },
      { id: "open", priority: "medium", due_date: TODAY, status: "todo", completed_at: null },
    ];
    const groups = groupTasksByDate(tasks, TODAY);
    assert.deepEqual(groups.dueToday.map((t) => t.id), ["open"]);
    assert.deepEqual(groups.completedToday.map((t) => t.id), ["done"]);
  });
});

describe("morning-plan order — unfinished priority link first", () => {
  function modelWith(active, overdue = []) {
    return {
      tasks: { active, overdue, dueToday: [], unscheduled: [], contextById: {} },
      habits: { incompleteToday: [] },
    };
  }
  const task = (id, title) => ({ id, title, description: null, priority: "medium", due_date: TODAY, status: "todo", completed_at: null, project_id: null });

  it("unfinished priority-linked task wins over overdue work", () => {
    const model = modelWith([task("p1", "Write report")], [task("o1", "Old bill")]);
    const first = selectMorningPlanFirstAction(model, [{ id: "pr", text: "Write report", done: false }]);
    assert.equal(first?.reason, "Top priority");
    assert.equal(first?.id, "p1");
  });

  it("finished priorities fall through to overdue work", () => {
    const model = modelWith([task("p1", "Write report")], [task("o1", "Old bill")]);
    const first = selectMorningPlanFirstAction(model, [{ id: "pr", text: "Write report", done: true }]);
    assert.equal(first?.reason, "Overdue");
    assert.equal(first?.id, "o1");
  });
});

// ------------------------------------------------------- nextron presentation ---

describe("nextron calm errors — never raw provider internals", () => {
  it("auth failures ask for sign-in", () => {
    assert.equal(toCalmNextronError("AUTH_REQUIRED", 401), "Sign in again to continue.");
    assert.equal(toCalmNextronError(undefined, 401), "Sign in again to continue.");
  });

  it("connectivity failures say so plainly", () => {
    assert.equal(toCalmNextronError("NETWORK_ERROR", 0), "Couldn't reach NEXTRON. Check your connection and try again.");
    assert.equal(toCalmNextronError(undefined, 0), "Couldn't reach NEXTRON. Check your connection and try again.");
  });

  it("everything else is a calm retry (no codes, no payloads)", () => {
    for (const [code, status] of [["UNKNOWN", 500], ["INVALID_RESPONSE", 500], [undefined, 429], ["SOME_PROVIDER_FAULT", 502]]) {
      const msg = toCalmNextronError(code, status);
      assert.equal(msg, "NEXTRON couldn't reply. Try again.");
      assert.ok(!msg.includes(String(code)) && !msg.includes(String(status)), "must not leak codes/statuses");
    }
  });
});

describe("nextron context summary — only evidenced access", () => {
  it("all-off states wealth and body as off, keeps core", () => {
    assert.equal(
      buildNextronContextSummary({ wealthMaster: false, wealthSections: [], bodyMetrics: [] }),
      "Can use: tasks, habits · wealth and body off",
    );
  });

  it("shows granted wealth areas and body metrics with correct plurals", () => {
    assert.equal(
      buildNextronContextSummary({ wealthMaster: true, wealthSections: ["balances", "cash_flow"], bodyMetrics: ["steps"] }),
      "Can use: tasks, habits, wealth (2 areas), body (1 metric)",
    );
  });

  it("master-off hides sections even if listed (fail-closed)", () => {
    const msg = buildNextronContextSummary({ wealthMaster: false, wealthSections: ["balances"], bodyMetrics: [] });
    assert.ok(!msg.includes("balances"), "must not claim ungranted sections");
  });

  it("carries no raw data, ids, or notes", () => {
    const msg = buildNextronContextSummary({ wealthMaster: true, wealthSections: ["balances"], bodyMetrics: ["steps"] });
    assert.ok(!msg.includes("steps,") || msg.includes("body (1 metric)"));
    assert.deepEqual(msg, "Can use: tasks, habits, wealth (1 area), body (1 metric)");
  });
});

describe("today + nextron screens — experience wiring, ranking untouched", () => {
  const today = read("app/(tabs)/today.tsx");
  const nextron = read("app/(tabs)/nextron.tsx");

  it("ranking imports and selection call are intact (no logic change)", () => {
    assert.ok(today.includes("selectTodayPrimaryCandidate"), "ranking selector missing");
    assert.ok(today.includes("selectMorningPlanFirstAction"), "morning-plan selector missing");
    assert.ok(today.includes("ranking.chosen"), "single-hero render missing");
    assert.ok(!today.includes("secondHero") && !today.includes("wealthSlot"), "no special wealth slot may exist");
  });

  it("today links out to nextron and wealth without new architecture", () => {
    assert.ok(today.includes('href="/(tabs)/nextron"'), "Ask NEXTRON entry missing");
    assert.ok(today.includes("Ask NEXTRON about today"), "Ask NEXTRON label missing");
    assert.ok(today.includes('href="/wealth"'), "wealth review link missing");
    assert.ok(!today.includes("nextronAsk"), "today must not duplicate NEXTRON backend");
  });

  it("priority input no longer uses the blank-space hack and guards double taps", () => {
    assert.ok(!today.includes('setPriorityInput(" ")'), "blank-space hack still present");
    assert.ok(today.includes("showPriorityInput"), "explicit input visibility state missing");
    assert.ok(today.includes("addingPriority"), "double-submit guard missing");
  });

  it("nextron shows a restrained truthful thinking state", () => {
    assert.ok(nextron.includes("Preparing a response"), "calm thinking state missing");
    assert.ok(!nextron.includes("thinking…"), "generic thinking copy still present");
  });

  it("action proposals state non-execution and required approval", () => {
    assert.ok(nextron.includes("needs approval"), "approval requirement missing");
    assert.ok(nextron.includes("Nothing has run"), "non-execution statement missing");
    assert.ok(!nextron.includes("Action proposed"), "old ambiguous label still present");
  });

  it("first-open is permission-bounded with evidenced context", () => {
    assert.ok(nextron.includes("only uses data you&apos;ve allowed"), "permission bound missing");
    assert.ok(!nextron.includes("Same memory and conversations as web"), "unverifiable parity claim still present");
    assert.ok(nextron.includes("contextSummary"), "evidenced context line missing");
    assert.ok(nextron.includes("buildNextronContextSummary"), "context builder not wired");
  });

  it("raw backend errors never reach state", () => {
    assert.ok(!nextron.includes("setError(res.error)"), "raw error still surfaces");
    assert.ok(nextron.includes("setError(toCalmNextronError"), "calm mapper not wired");
  });

  it("composer still guards duplicate sends; history switch scrolls", () => {
    assert.ok(nextron.includes("if (!text || sending) return"), "send guard missing");
    assert.ok(nextron.includes("scrollToEnd"), "scroll handling missing");
  });
});
