// PLAN concurrency regression tests (Prompt 2/3).
// Proves Must Win switches survive stale caller state by re-reading flagged
// rows, using an in-memory Supabase stand-in. No network, no DB.
// Run from apps/mobile: node --loader ./scripts/ts-extension-loader.mjs
//   --test scripts/test-plan-concurrency.mjs

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDayPriority,
  logPlanEvent,
  setDailyMustWin as mobileSetDailyMustWin,
} from "../lib/daily-plan-service.ts";
import { setMustWin as webSetMustWin } from "../../../src/lib/plan.ts";
import { setDailyMustWin as webSetDailyMustWin } from "../../../src/lib/priorities.ts";

function makeDb(seed = {}) {
  const tables = {
    today_priorities: [],
    weekly_outcomes: [],
    daily_plan_events: [],
    ...Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))])),
  };
  let idSeq = 1;
  const calls = [];
  function builder(table) {
    const q = { op: null, payload: null, filters: [] };
    const api = {
      select() {
        if (!q.op) q.op = "select";
        return api;
      },
      insert(payload) {
        q.op = "insert";
        q.payload = payload;
        calls.push(["insert", table]);
        return api;
      },
      update(payload) {
        q.op = "update";
        q.payload = payload;
        calls.push(["update", table]);
        return api;
      },
      delete() {
        q.op = "delete";
        calls.push(["delete", table]);
        return api;
      },
      eq(col, val) {
        q.filters.push([col, val]);
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      in() {
        return api;
      },
      async single() {
        const r = await run();
        const rows = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
        if (rows.length === 0) return { data: null, error: { message: "none" } };
        return { data: rows[0], error: null };
      },
      async maybeSingle() {
        const r = await run();
        const rows = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
        return { data: rows[0] ?? null, error: null };
      },
      then(resolve, reject) {
        return run().then(resolve, reject);
      },
    };
    const match = (row) => q.filters.every(([c, v]) => row[c] === v);
    async function run() {
      const rows = tables[table] ?? [];
      if (!q.op || q.op === "select") {
        return { data: rows.filter(match), error: null };
      }
      if (q.op === "insert") {
        const items = Array.isArray(q.payload) ? q.payload : [q.payload];
        const made = items.map((p) => ({ id: `mock-${idSeq++}`, ...p }));
        tables[table].push(...made);
        return { data: made, error: null };
      }
      if (q.op === "update") {
        const hit = rows.filter(match);
        for (const row of hit) Object.assign(row, q.payload);
        return { data: hit, error: null };
      }
      if (q.op === "delete") {
        const kept = rows.filter((row) => !match(row));
        tables[table] = kept;
        return { data: [], error: null };
      }
      return { data: null, error: { message: "unknown op" } };
    }
    return api;
  }
  return {
    calls,
    tables,
    from: (table) => builder(table),
  };
}

const OUTCOMES = () => [
  { id: "o1", user_id: "u", plan_id: "p", position: 1, text: "One", done: false, must_win: true },
  { id: "o2", user_id: "u", plan_id: "p", position: 2, text: "Two", done: false, must_win: false },
];
// Stale caller view: taken before o1 was flagged elsewhere.
const STALE_OUTCOMES = () => [
  { id: "o1", must_win: false },
  { id: "o2", must_win: false },
];

describe("must-win switch survives stale caller state", () => {
  it("web weekly setMustWin clears the live flag, not just the stale list", async () => {
    const db = makeDb({ weekly_outcomes: OUTCOMES() });
    const ok = await webSetMustWin(db, "u", "p", "o2", STALE_OUTCOMES());
    assert.equal(ok, true);
    const flags = Object.fromEntries(db.tables.weekly_outcomes.map((o) => [o.id, o.must_win]));
    assert.deepEqual(flags, { o1: false, o2: true });
  });

  it("mobile daily setDailyMustWin clears the live flag, not just the stale list", async () => {
    const db = makeDb({
      today_priorities: [
        { id: "p1", user_id: "u", local_date: "2026-10-07", position: 1, is_must_win: true },
        { id: "p2", user_id: "u", local_date: "2026-10-07", position: 2, is_must_win: false },
      ],
    });
    const stale = [
      { id: "p1", is_must_win: false },
      { id: "p2", is_must_win: false },
    ];
    const ok = await mobileSetDailyMustWin(db, "u", "2026-10-07", "p2", stale);
    assert.equal(ok, true);
    const flags = Object.fromEntries(db.tables.today_priorities.map((p) => [p.id, p.is_must_win]));
    assert.deepEqual(flags, { p1: false, p2: true });
  });

  it("web daily setDailyMustWin clears the live flag, not just the stale list", async () => {
    const db = makeDb({
      today_priorities: [
        { id: "p1", user_id: "u", local_date: "2026-10-07", position: 1, is_must_win: true },
        { id: "p2", user_id: "u", local_date: "2026-10-07", position: 2, is_must_win: false },
      ],
    });
    const stale = [
      { id: "p1", is_must_win: false },
      { id: "p2", is_must_win: false },
    ];
    const ok = await webSetDailyMustWin(db, "u", "2026-10-07", "p2", stale);
    assert.equal(ok, true);
    const flags = Object.fromEntries(db.tables.today_priorities.map((p) => [p.id, p.is_must_win]));
    assert.deepEqual(flags, { p1: false, p2: true });
  });

  it("clearing must win leaves zero flags", async () => {
    const db = makeDb({ weekly_outcomes: OUTCOMES() });
    const ok = await webSetMustWin(db, "u", "p", null, STALE_OUTCOMES());
    assert.equal(ok, true);
    assert.ok(db.tables.weekly_outcomes.every((o) => !o.must_win));
  });
});

describe("day priority guards under the mock", () => {
  it("full day short-circuits without an insert call", async () => {
    const db = makeDb({
      today_priorities: [
        { id: "p1", position: 1 },
        { id: "p2", position: 2 },
        { id: "p3", position: 3 },
      ],
    });
    const created = await addDayPriority(db, "u", "2026-10-07", db.tables.today_priorities, { text: "x" });
    assert.equal(created, null);
    assert.ok(!db.calls.some(([op]) => op === "insert"));
  });

  it("invalid event type writes nothing", async () => {
    const db = makeDb();
    const ok = await logPlanEvent(db, "u", "2026-10-07", "bogus");
    assert.equal(ok, false);
    assert.ok(!db.calls.some(([op]) => op === "insert"));
  });
});
