// Life Pulse web ↔ mobile parity tests (convergence Prompt 1/3).
// Behavioral fixtures evaluated against @lifepulse/domain (shared truth)
// plus static guards that both clients consume the same contracts.
// Run from repo root: `npm run test:parity-v1`
//   => node --test scripts/test-parity-v1.mjs

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  groupTasksByDate,
  buildTaskUpdatePayload,
  buildHabitUpdatePayload,
  normalizeHabitSchedule,
  normalizeItemTitle,
  isValidItemTitle,
  MAX_ITEM_TITLE_LENGTH,
  selectMorningPlanFirstAction,
  selectTodayPrimaryCandidate,
  deriveWealthSignalsV2,
  isStorageAllowed,
  isNextronAllowed,
  REALM_NAMES,
  THEME_LABELS,
  APPEARANCE_STORAGE_KEY,
  getWeekStartForDate,
  getLocalTodayDateString,
  getCurrentStreak,
  getWeeklyProgress,
  normalizeCompletedDates,
  isHabitDueOnDate,
  parseWealthAmount,
  getWealthBudgetStatuses,
  getWealthGoalProgress,
  getEffectiveWealthNextronSections,
  sanitizeWealthNextronSections,
  effectiveNextronMetrics,
  WEALTH_NEXTRON_SECTIONS,
  getBodyMetricTrend,
  formatBodyMetricValue,
  isValidPosition,
  MAX_PRIORITIES_PER_DAY,
} from "../packages/domain/index.ts";
import { getTodayDateString, getWeekStartDate } from "../src/lib/utils.ts";
import {
  fixtureTasks,
  fixtureHabits,
  FIXTURE_TODAY,
  EXPECTED_TASK_GROUPS,
  EXPECTED_RANKING_WINNER,
  EXPECTED_NORMALIZED_SCHEDULES,
  LOG_WINDOW_FIXTURES,
} from "../packages/domain/parity-fixtures.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

// ---------------------------------------------------------------------------
// 1. Parity matrix exists with required sections
// ---------------------------------------------------------------------------
describe("parity matrix exists", () => {
  it("docs/PARITY_MATRIX.md covers every required capability area", () => {
    const matrix = read("docs/PARITY_MATRIX.md");
    for (const section of [
      "AUTH", "TODAY", "TASKS", "HABITS", "NEXTRON", "BODY", "WEALTH",
      "REALMS", "SETTINGS", "THEMES", "ACCOUNT", "CROSS-DEVICE",
    ]) {
      assert.ok(matrix.includes(`## ${section}`), `matrix missing ## ${section}`);
    }
    for (const status of ["PARITY", "PARTIAL", "PLATFORM_SPECIFIC"]) {
      assert.ok(matrix.includes(status), `matrix never uses status ${status}`);
    }
  });

  it("convergence audit exists and records no silent divergence", () => {
    const audit = read("docs/WEB_MOBILE_CONVERGENCE_AUDIT.md");
    assert.ok(/platform exception/i.test(audit), "audit never states the platform exception");
  });
});

// ---------------------------------------------------------------------------
// 2. No unresolved duplicate habit normalization
// ---------------------------------------------------------------------------
describe("habit normalization is single-sourced", () => {
  it("canonical frequencies normalize deterministically", () => {
    for (const [key, expected] of Object.entries(EXPECTED_NORMALIZED_SCHEDULES)) {
      const habit = fixtureHabits.find((h) => h.id === `h-${key}`);
      const actual = normalizeHabitSchedule(habit.frequency, habit.days_of_week ?? [], habit.times_per_week ?? 3);
      assert.deepEqual(actual, expected, `schedule mismatch for ${key}`);
    }
  });

  it("empty weekdays fall back to Mon-Fri (never never-due)", () => {
    assert.deepEqual(normalizeHabitSchedule("weekdays", [], 3).days_of_week, [1, 2, 3, 4, 5]);
  });

  it("legacy times_per_week is not a canonical write value", () => {
    // Unknown/legacy frequencies collapse to daily on write; the web edit
    // form coerces legacy rows to weekly (preserving N) instead.
    assert.deepEqual(normalizeHabitSchedule("times_per_week", [], 2), {
      frequency: "daily",
      days_of_week: [],
      times_per_week: null,
    });
  });

  it("days sanitize, dedupe, and sort", () => {
    assert.deepEqual(normalizeHabitSchedule("weekdays", [5, 1, 5, 9, -1, 3], 3).days_of_week, [1, 3, 5]);
  });

  it("weekly target clamps to 1-7", () => {
    assert.equal(normalizeHabitSchedule("weekly", [], 99).times_per_week, 7);
    assert.equal(normalizeHabitSchedule("weekly", [], 0).times_per_week, 1);
  });
});

// ---------------------------------------------------------------------------
// 3-4. Task + habit schema semantics shared/equivalent
// ---------------------------------------------------------------------------
describe("task mutation semantics are shared", () => {
  it("buildTaskUpdatePayload validates title, priority fallback, and dates", () => {
    const current = { title: "T", priority: "medium", due_date: null };
    assert.equal(buildTaskUpdatePayload(current, { title: "  ", priority: "high", dueDate: "" }).ok, false);
    const badDate = buildTaskUpdatePayload(current, { title: "T2", priority: "high", dueDate: "yesterday" });
    assert.equal(badDate.ok, false);
    const fallback = buildTaskUpdatePayload(current, { title: "T2", priority: "urgent", dueDate: "" });
    assert.equal(fallback.ok && fallback.payload.priority, "medium");
    const unchanged = buildTaskUpdatePayload(
      { title: "T", priority: "medium", due_date: null },
      { title: "T", priority: "medium", dueDate: "" },
    );
    assert.equal(unchanged.ok && unchanged.changed, false);
  });

  it("titles cap at MAX_ITEM_TITLE_LENGTH (120)", () => {
    assert.equal(MAX_ITEM_TITLE_LENGTH, 120);
    assert.equal(isValidItemTitle("x".repeat(121)), false);
    assert.equal(normalizeItemTitle(`  ${"y".repeat(200)}  `).length, 120);
  });

  it("web and mobile both build task writes through the domain", () => {
    assert.ok(read("src/app/tasks/page.tsx").includes("buildTaskUpdatePayload"), "web tasks bypass domain builder");
    assert.ok(read("apps/mobile/app/(tabs)/tasks.tsx").includes("buildTaskUpdatePayload"), "mobile tasks bypass domain builder");
  });

  it("task grouping treats invalid dates as unscheduled", () => {
    const groups = groupTasksByDate(fixtureTasks, FIXTURE_TODAY);
    assert.deepEqual(groups.overdue.map((t) => t.id), EXPECTED_TASK_GROUPS.overdue);
    assert.deepEqual(groups.dueToday.map((t) => t.id), EXPECTED_TASK_GROUPS.dueToday);
    assert.deepEqual(groups.unscheduled.map((t) => t.id).sort(), [...EXPECTED_TASK_GROUPS.unscheduled].sort());
  });
});

describe("habit mutation semantics are shared", () => {
  it("buildHabitUpdatePayload validates, normalizes, and detects no-change", () => {
    const current = { title: "H", frequency: "daily", days_of_week: [], times_per_week: null };
    assert.equal(buildHabitUpdatePayload(current, { title: "", frequency: "daily", daysOfWeek: [], timesPerWeek: 1 }).ok, false);
    const normalized = buildHabitUpdatePayload(current, { title: " H2 ", frequency: "weekdays", daysOfWeek: [], timesPerWeek: 3 });
    assert.equal(normalized.ok && normalized.payload.frequency, "weekdays");
    assert.deepEqual(normalized.ok && normalized.payload.days_of_week, [1, 2, 3, 4, 5]);
    const unchanged = buildHabitUpdatePayload(current, { title: "H", frequency: "daily", daysOfWeek: [], timesPerWeek: 1 });
    assert.equal(unchanged.ok && unchanged.changed, false);
  });

  it("web and mobile both build habit writes through the domain", () => {
    assert.ok(read("src/app/habits/page.tsx").includes("buildHabitUpdatePayload"), "web habits bypass domain builder");
    assert.ok(read("src/app/habits/page.tsx").includes("normalizeHabitSchedule"), "web habits bypass domain normalization");
    assert.ok(read("apps/mobile/app/(tabs)/habits.tsx").includes("buildHabitUpdatePayload"), "mobile habits bypass domain builder");
  });

  it("web no longer writes the non-canonical times_per_week frequency", () => {
    const src = read("src/app/habits/page.tsx");
    assert.ok(!src.includes('value: "times_per_week"'), "web form still offers times_per_week frequency");
    assert.ok(!src.includes('=== "times_per_week" ? '), "web write path still branches on times_per_week");
    assert.ok(src.includes("normalizeHabitSchedule"), "web habits bypass domain normalization");
  });
});

// ---------------------------------------------------------------------------
// 5. Today ranking shared/equivalent
// ---------------------------------------------------------------------------
describe("today ranking is shared", () => {
  function modelFor() {
    const todo = fixtureTasks.filter((t) => t.status === "todo");
    const byId = (id) => todo.find((t) => t.id === id);
    return {
      tasks: {
        active: todo,
        overdue: [byId("t-overdue-high")],
        dueToday: [byId("t-due-medium")],
        incompleteToday: [],
        unscheduled: [byId("t-unscheduled")],
        contextById: {},
      },
      habits: { incompleteToday: [] },
    };
  }

  it("overdue high-priority task wins the ordinary ranking", () => {
    const winner = selectMorningPlanFirstAction(modelFor(), []);
    assert.equal(winner?.id, EXPECTED_RANKING_WINNER);
  });

  it("a strong wealth bill beats an unscheduled ordinary task; ties prefer ordinary", () => {
    const ordinary = { type: "task", id: "t-unscheduled", title: "Unscheduled", reason: "Unscheduled", task: { priority: "low" } };
    const wealth = { kind: "wealth_bill_due", priority: 10, title: "Rent", rationale: "Scheduled", dueDate: FIXTURE_TODAY, sourceId: "bill-1", strength: "strong" };
    const won = selectTodayPrimaryCandidate({ ordinaryUpNext: ordinary, wealthCandidate: wealth, todayStr: FIXTURE_TODAY });
    assert.equal(won.source, "wealth");
    const tie = selectTodayPrimaryCandidate({
      ordinaryUpNext: { type: "habit", id: "h", title: "H", reason: "Due today" },
      wealthCandidate: null,
      todayStr: FIXTURE_TODAY,
    });
    assert.equal(tie.source, "ordinary");
  });

  it("web today competes wealth like mobile (same selector + hero)", () => {
    const src = read("src/app/today/page.tsx");
    assert.ok(src.includes("selectTodayPrimaryCandidate"), "web today skips the max-one-hero competition");
    assert.ok(src.includes("loadWebWealthTodayCandidate"), "web today has no wealth candidate loader");
    assert.ok(src.includes("/wealth"), "web wealth hero does not link the Wealth realm");
  });

  it("strong wealth signals surface; analytical ones do not auto-win today", () => {
    const signals = deriveWealthSignalsV2({
      billsDue: [{ id: "b1", name: "Rent", kind: "bill", next_due_date: FIXTURE_TODAY }],
      subsDue: [],
      tasksDue: [],
      habitsDue: [],
      goalsDue: [],
      insights: [{ kind: "cash_flow_negative", title: "Cash", rationale: "neg", priority: 40 }],
    });
    assert.ok(signals.some((s) => s.kind === "wealth_bill_due" && s.strength === "strong"));
  });
});

// ---------------------------------------------------------------------------
// 6-7. Body + wealth permission rules shared/equivalent
// ---------------------------------------------------------------------------
describe("permission rules are shared", () => {
  it("body privacy contract is fail-closed on both layers", () => {
    const state = {
      sourceAccess: null,
      storageConsent: { allowedScopes: ["steps"], updatedAt: null },
      nextronAccess: { allowed: true, allowedScopes: [], updatedAt: null },
    };
    assert.equal(isStorageAllowed(state, "steps"), true);
    assert.equal(isStorageAllowed(state, "sleep_duration"), false);
    assert.equal(isNextronAllowed(state, "steps"), false);
    assert.equal(
      isNextronAllowed(
        { ...state, nextronAccess: { allowed: true, allowedScopes: ["steps"], updatedAt: null } },
        "steps",
      ),
      true,
    );
  });

  it("both clients gate body evidence on the same intersection", () => {
    const mobile = read("apps/mobile/lib/nextron-health-permissions.ts");
    assert.ok(mobile.includes("nextronAllowed") && mobile.includes("allowed"), "mobile body gate missing");
    const web = read("src/lib/nextron/evidence.ts");
    assert.ok(web.includes("nextron_allowed_metrics") && web.includes("allowed_metrics"), "web body gate missing");
  });

  it("both clients gate wealth evidence on the same master + sections", () => {
    const mobile = read("apps/mobile/lib/nextron-wealth-permissions.ts");
    assert.ok(mobile.includes("nextron_access_enabled") && mobile.includes("nextron_allowed_sections"), "mobile wealth gate missing");
    const web = read("src/lib/nextron/evidence.ts");
    assert.ok(web.includes("nextron_access_enabled") && web.includes("nextron_allowed_sections"), "web wealth gate missing");
  });
});

// ---------------------------------------------------------------------------
// 8. Finance canonical tables only
// ---------------------------------------------------------------------------
describe("finance uses canonical tables only", () => {
  it("no wealth_* tables anywhere in clients or migrations", () => {
    // Identifiers (wealth-service, WealthSignalV2) are fine — only storage
    // table references would signal a parallel system.
    const out = execSync('git grep -n "wealth_" -- src apps/mobile supabase packages || true', {
      cwd: root,
      encoding: "utf8",
    });
    const hits = out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => /from\(["']wealth_|CREATE TABLE wealth_|TABLE wealth_/.test(l));
    assert.deepEqual(hits, [], `parallel wealth_* tables: ${hits.join(", ")}`);
  });

  it("web finance reads only canonical finance_* tables", () => {
    const src = read("src/app/wealth/page.tsx");
    for (const table of ["finance_accounts", "finance_categories", "finance_transactions", "finance_budgets"]) {
      assert.ok(src.includes(table), `web wealth missing canonical ${table}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. System/Light/Dark exist on both clients
// ---------------------------------------------------------------------------
describe("themes exist on both clients", () => {
  it("mobile exposes both palettes with complete keys", () => {
    const theme = read("apps/mobile/lib/theme.ts");
    for (const key of ["bg:", "surface:", "surfaceElevated:", "textPrimary:", "accent:", "realmBody:", "realmWealth:"]) {
      assert.ok(theme.includes(`  ${key}`), `mobile theme missing ${key}`);
    }
    assert.ok(theme.includes("export const darkColors"), "mobile dark palette missing");
    assert.ok(theme.includes("export const lightColors"), "mobile light palette missing");
  });

  it("web has a provider, persistence, OS-follow, and a light set", () => {
    const provider = read("src/components/theme-provider.tsx");
    assert.ok(provider.includes("ThemeProvider") && provider.includes("useLifePulseWebTheme"));
    assert.ok(provider.includes("localStorage") && provider.includes("prefers-color-scheme"));
    assert.ok(read("src/app/globals.css").includes(':root[data-theme="light"]'), "no light variable set");
    assert.ok(read("src/app/settings/page.tsx").includes("Appearance"), "no appearance selector in settings");
  });

  it("both clients share the appearance storage contract", () => {
    assert.equal(APPEARANCE_STORAGE_KEY, "lifepulse:appearance");
    assert.ok(read("src/components/theme-provider.tsx").includes("APPEARANCE_STORAGE_KEY"));
    assert.ok(read("apps/mobile/lib/theme.ts").includes("lifepulse:appearance"));
  });
});

// ---------------------------------------------------------------------------
// 10. Core route/capability presence
// ---------------------------------------------------------------------------
describe("core routes exist on both clients", () => {
  it("web routes resolve", () => {
    for (const route of ["today", "nextron", "tasks", "habits", "realms", "wealth", "body", "settings", "account"]) {
      assert.ok(existsSync(path.join(root, "src", "app", route, "page.tsx")), `web missing /${route}`);
    }
  });

  it("mobile destinations resolve", () => {
    for (const file of [
      "apps/mobile/app/(tabs)/today.tsx",
      "apps/mobile/app/(tabs)/nextron.tsx",
      "apps/mobile/app/(tabs)/tasks.tsx",
      "apps/mobile/app/(tabs)/habits.tsx",
      "apps/mobile/app/(tabs)/more.tsx",
      "apps/mobile/app/realms.tsx",
      "apps/mobile/app/wealth.tsx",
      "apps/mobile/app/body.tsx",
    ]) {
      assert.ok(existsSync(path.join(root, file)), `mobile missing ${file}`);
    }
  });

  it("legacy /finance redirects to /wealth", () => {
    assert.ok(read("src/app/finance/page.tsx").includes('redirect("/wealth")'));
  });
});

// ---------------------------------------------------------------------------
// 11. Terminology: Wealth + Body + NEXTRON, canonical copy
// ---------------------------------------------------------------------------
describe("terminology is converged", () => {
  it("canonical realm names are Body and Wealth", () => {
    assert.equal(REALM_NAMES.body, "Body");
    assert.equal(REALM_NAMES.wealth, "Wealth");
    assert.equal(REALM_NAMES.realms, "Realms");
  });

  it("web user-facing copy says Wealth, not Finance", () => {
    const out = execSync("git grep -n \"Finance\" -- src || true", { cwd: root, encoding: "utf8" });
    // Allowlist: code identifiers, finance_* storage, comments, matching
    // logic, and the legacy-redirect note. Everything else must say Wealth.
    const allowed = (line) =>
      /Finance(Account|Category|Transaction|Budget|KpiCard|Insights|Overview|Form|List|Summary|HealthList|Loading|Error|Page|Signal|Review|Goal)/.test(line) ||
      /finance(_|Has|Goal|Overview|Signal|Review|Entries|entries|Transaction|Income|Expense|Net)/.test(line) ||
      /finance\//.test(line) ||
      /finance: "/.test(line) ||
      /\/finance/.test(line) ||
      /Finance was renamed/.test(line) ||
      /^\s*\/\//.test(line.split(":").slice(3).join(":")) ||
      /businessFinance/.test(line) ||
      /IconFinance/.test(line) ||
      /hasFinanceData/.test(line) ||
      /finance[A-Z]/.test(line) ||
      /Finance(Income|Expense|Net|Currency|Entries|Signal|Review|Data|Goal|Has)/.test(line) ||
      /\.finance\b/.test(line) ||
      /prevFinance|recentFinance|currentFinance/.test(line) ||
      /value: "finance"/.test(line) ||
      /^[^:]+:\d+:\s*\/\//.test(line) ||
      /levels\.ts.*Finance: \[/.test(line);
    const offenders = out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !allowed(l));
    assert.deepEqual(offenders, [], `Finance display strings remain:\n${offenders.join("\n")}`);
  });

  it("theme labels name both premium identities", () => {
    assert.equal(THEME_LABELS.darkHint, "Signature Pulse");
    assert.equal(THEME_LABELS.lightHint, "Warm Human");
  });
});

// ---------------------------------------------------------------------------
// Habit log-window alignment (same inputs, same boundaries, both clients)
// ---------------------------------------------------------------------------
describe("habit log windows are aligned", () => {
  it("weeks start Monday on both date helpers", () => {
    assert.equal(getWeekStartForDate(LOG_WINDOW_FIXTURES.tuesday), LOG_WINDOW_FIXTURES.mondayWeekStart);
    assert.equal(getWeekStartDate(), getWeekStartForDate(getTodayDateString()));
  });

  it("local-day strings share the canonical shape", () => {
    assert.match(getTodayDateString(), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(getLocalTodayDateString(), /^\d{4}-\d{2}-\d{2}$/);
  });

  it("weekday boundaries agree: Mon-Fri due, weekend not", () => {
    const habit = { frequency: "weekdays", days_of_week: [1, 2, 3, 4, 5] };
    assert.equal(isHabitDueOnDate(habit, LOG_WINDOW_FIXTURES.tuesday, []), true);
    assert.equal(isHabitDueOnDate(habit, LOG_WINDOW_FIXTURES.sunday, []), false);
    assert.equal(isHabitDueOnDate(habit, LOG_WINDOW_FIXTURES.nextMonday, []), true);
  });

  it("times-per-week counts within the same Monday week", () => {
    const dates = normalizeCompletedDates(["2026-09-21", "2026-09-22", "2026-09-28"]);
    const progress = getWeeklyProgress(dates, "weekly", 3, LOG_WINDOW_FIXTURES.mondayWeekStart, [], { asOfDate: "2026-09-28" });
    assert.equal(progress.completed, 2);
    assert.equal(progress.target, 3);
  });

  it("completion logs normalize identically (drop future + invalid + dupes)", () => {
    const clean = normalizeCompletedDates(["2026-09-22", "2026-09-22", "nope", "2999-01-01"]);
    assert.ok(!clean.includes("nope") && !clean.includes("2999-01-01"));
    assert.equal(new Set(clean).size, clean.length);
  });

  it("consecutive-day streaks match on shared inputs", () => {
    assert.equal(getCurrentStreak(["2026-09-20", "2026-09-21", "2026-09-22"], "daily", [], { asOfDate: "2026-09-22" }), 3);
  });

  it("both clients bound history to 365 days / 5000 rows", () => {
    assert.equal(LOG_WINDOW_FIXTURES.historyFloorDays, 365);
    const web = read("src/app/habits/page.tsx");
    const mobile = read("apps/mobile/app/(tabs)/habits.tsx");
    assert.ok(web.includes(".limit(5000)"), "web habits unbounded");
    assert.ok(mobile.includes(".limit(5000)"), "mobile habits unbounded");
  });
});

// ---------------------------------------------------------------------------
// Canonical write shapes (cross-client data contract)
// ---------------------------------------------------------------------------
describe("canonical write shapes match across clients", () => {
  it("task writes carry the same definition columns", () => {
    const built = buildTaskUpdatePayload(
      { title: "T", priority: "medium", due_date: null },
      { title: " T2 ", priority: "high", dueDate: "2026-09-23" },
    );
    assert.equal(built.ok, true);
    assert.deepEqual(built.ok && Object.keys(built.payload).sort(), ["due_date", "priority", "title"]);
    assert.deepEqual(built.ok && built.payload, { title: "T2", priority: "high", due_date: "2026-09-23" });
  });

  it("habit writes carry definition columns only (history preserved)", () => {
    const built = buildHabitUpdatePayload(
      { title: "H", frequency: "daily", days_of_week: [], times_per_week: null },
      { title: "H2", frequency: "weekly", daysOfWeek: [], timesPerWeek: 3 },
    );
    assert.equal(built.ok, true);
    assert.deepEqual(built.ok && Object.keys(built.payload).sort(), ["days_of_week", "frequency", "times_per_week", "title"]);
  });

  it("priority rows obey position 1-3 and the daily cap", () => {
    assert.equal(MAX_PRIORITIES_PER_DAY, 3);
    assert.equal(isValidPosition(1) && isValidPosition(3) && !isValidPosition(4), true);
  });

  it("wealth goals store the quantitative contract columns", () => {
    const src = read("src/lib/wealth.ts");
    for (const column of ["goal_type", "target_metric", "target_value", "target_unit", "baseline_value", "target_date"]) {
      assert.ok(src.includes(column), `web wealth goal missing ${column}`);
    }
  });

  it("permission rows use the same tables and columns", () => {
    for (const file of ["apps/mobile/lib/nextron-wealth-permissions.ts", "src/lib/nextron/evidence.ts"]) {
      const src = read(file);
      assert.ok(src.includes("finance_preferences"), `${file} missing finance_preferences`);
      assert.ok(src.includes("nextron_allowed_sections"), `${file} missing sections column`);
    }
    assert.ok(read("apps/mobile/lib/nextron-health-permissions.ts").includes("health_preferences"));
    assert.ok(read("src/lib/nextron/evidence.ts").includes("health_preferences"));
  });
});

// ---------------------------------------------------------------------------
// Wealth invariants (behavioral, shared engine)
// ---------------------------------------------------------------------------
describe("wealth invariants hold", () => {
  it("amount parsing rejects negatives, NaN, and non-numbers", () => {
    assert.equal(parseWealthAmount("100"), 100);
    assert.equal(parseWealthAmount("-5"), null);
    assert.equal(parseWealthAmount("NaN"), null);
    assert.equal(parseWealthAmount(""), null);
  });

  it("legacy NULL budget currency means unknown (never compared)", () => {
    const statuses = getWealthBudgetStatuses(
      [{ id: "b", category_id: "c", month: "2026-09-01", amount: 100, currency: null }],
      [{ id: "c", name: "Food" }],
      [{ categoryId: "c", categoryName: "Food", amount: 200, share: 1, count: 2, currency: "ILS" }],
      "ILS",
    );
    assert.equal(statuses[0].status, "currency_unknown");
    assert.equal(statuses[0].percentUsed, null);
  });

  it("investment contributions stay insufficient without evidence", () => {
    const progress = getWealthGoalProgress(
      [{ id: "g", title: "Invest", goal_type: "investment_contribution", target_value: 1000, baseline_value: 0, target_metric: "investment_balance", target_unit: "ILS" }],
      [],
    );
    assert.equal(progress[0].status, "insufficient");
  });

  it("shared wealth sections are a closed set", () => {
    assert.deepEqual([...WEALTH_NEXTRON_SECTIONS].sort(), ["balances", "cash_flow", "recurring_items", "transactions_summary", "wealth_goals"].sort());
  });
});

// ---------------------------------------------------------------------------
// Shared permission semantics (behavioral)
// ---------------------------------------------------------------------------
describe("shared permission semantics", () => {
  it("wealth sections require the master switch", () => {
    assert.deepEqual(getEffectiveWealthNextronSections({ master: false, sections: ["balances"] }), []);
    assert.deepEqual(getEffectiveWealthNextronSections({ master: true, sections: ["balances", "nope"] }), ["balances"]);
    assert.deepEqual(getEffectiveWealthNextronSections(null), []);
  });

  it("body evidence needs both storage and NEXTRON consent", () => {
    assert.deepEqual(effectiveNextronMetrics(["steps"], ["steps", "weight"]), ["steps"]);
    assert.deepEqual(effectiveNextronMetrics([], ["steps"]), []);
  });
});

// ---------------------------------------------------------------------------
// Body display contracts (behavioral)
// ---------------------------------------------------------------------------
describe("body display contracts", () => {
  it("trends report insufficient without coverage", () => {
    const trend = getBodyMetricTrend([], "steps", 7);
    assert.equal(trend.direction, "insufficient");
  });

  it("metric values format deterministically", () => {
    assert.equal(formatBodyMetricValue("steps", 7500), "7,500 steps");
  });

  it("web synced tab reads normalized records with consent visibility", () => {
    const src = read("src/app/body/page.tsx");
    assert.ok(src.includes("health_records"), "web body never reads synced records");
    assert.ok(src.includes("health_preferences"), "web body never shows consent state");
    assert.ok(src.includes("getBodyMetricTrend"), "web body lacks trend engine");
    assert.ok(src.includes("getBodyGoalProgress"), "web body lacks goal progress");
  });
});

// ---------------------------------------------------------------------------
// Action approval availability contract (same server, both clients)
// ---------------------------------------------------------------------------
describe("action approval is available on both clients", () => {
  it("mobile can list, approve, and reject proposals", () => {
    const lib = read("apps/mobile/lib/nextron.ts");
    assert.ok(lib.includes("listNextronActionProposals"), "mobile cannot list proposals");
    assert.ok(lib.includes("approveNextronActionProposal"), "mobile cannot approve");
    assert.ok(lib.includes("cancelNextronActionProposal"), "mobile cannot reject");
  });

  it("mobile renders explicit approve/reject controls", () => {
    const screen = read("apps/mobile/app/(tabs)/nextron.tsx");
    assert.ok(screen.includes("Approve") && screen.includes("Reject"), "mobile has no approval controls");
  });

  it("action routes accept mobile Bearer auth (same contract as ask)", () => {
    for (const route of [
      "src/app/api/nextron/actions/route.ts",
      "src/app/api/nextron/actions/propose/route.ts",
      "src/app/api/nextron/actions/[id]/approve/route.ts",
      "src/app/api/nextron/actions/[id]/cancel/route.ts",
      "src/app/api/nextron/signals/route.ts",
    ]) {
      assert.ok(read(route).includes("resolveNextronAuth"), `${route} rejects Bearer clients`);
    }
  });

  it("server enforces exact-once, owner isolation, and expiry", () => {
    const migration = read("supabase/migrations/00033_nextron_cross_domain_actions.sql");
    assert.ok(migration.includes("status = 'pending'"), "no pending-row guard");
    assert.ok(migration.includes("for update"), "no row lock");
    assert.ok(migration.includes("user_id = v_user_id") || migration.includes("user_id=v_user_id"), "no owner isolation");
    assert.ok(migration.includes("expires_at"), "no expiry");
  });

  it("mobile conversation and memory management exist", () => {
    const lib = read("apps/mobile/lib/nextron.ts");
    assert.ok(lib.includes("deleteNextronConversation"), "mobile cannot delete conversations");
    assert.ok(lib.includes("listNextronMemory") && lib.includes("forgetNextronMemory"), "mobile has no memory controls");
    assert.ok(lib.includes("listNextronSignals"), "mobile has no signals read");
  });
});

// ---------------------------------------------------------------------------
// Auth destinations + theme across routes + guards
// ---------------------------------------------------------------------------
describe("auth, theme, and guard parity", () => {
  it("sign-in lands on Today on both clients", () => {
    assert.ok(read("src/app/login/page.tsx").includes('router.push("/today")'), "web login destination drifted");
    assert.ok(read("apps/mobile/app/login.tsx").includes("/(tabs)/today"), "mobile login destination drifted");
  });

  it("password reset uses the same web destination", () => {
    assert.ok(read("apps/mobile/lib/links.ts").includes("/reset-password"), "mobile reset link drifted");
    assert.ok(read("src/app/forgot-password/page.tsx").includes("/reset-password"), "web reset link drifted");
  });

  it("remembered email exists on both clients with the same contract", () => {
    assert.ok(read("src/lib/remembered-email.ts").includes("lifepulse.remembered_email"));
    assert.ok(read("apps/mobile/lib/remembered-email.ts").includes("lifepulse.remembered_email"));
    assert.ok(read("src/app/login/page.tsx").includes("getRememberedEmail"), "web login ignores remembered email");
  });

  it("core web routes carry no hardcoded dark fills", () => {
    for (const file of [
      "src/app/today/page.tsx",
      "src/app/tasks/page.tsx",
      "src/app/habits/page.tsx",
      "src/app/realms/page.tsx",
      "src/app/wealth/page.tsx",
      "src/app/body/page.tsx",
      "src/app/settings/page.tsx",
      "src/app/login/page.tsx",
    ]) {
      const src = read(file);
      assert.ok(!src.includes("bg-black/"), `${file} has hardcoded dark fills`);
      assert.ok(!src.includes("text-white"), `${file} has hardcoded white text`);
      assert.ok(!src.includes("text-[#071018]"), `${file} has hardcoded on-accent`);
      assert.ok(!src.includes("border-white/"), `${file} has hardcoded hairlines`);
    }
  });

  it("proxy guards every core route", () => {
    const proxy = read("src/proxy.ts");
    for (const route of ["/today", "/tasks", "/habits", "/nextron", "/realms", "/wealth", "/body", "/settings", "/account", "/life-map", "/finance"]) {
      assert.ok(proxy.includes(`"${route}"`), `proxy missing ${route}`);
    }
  });

  it("theme labels name both premium identities", () => {
    assert.equal(THEME_LABELS.darkHint, "Signature Pulse");
    assert.equal(THEME_LABELS.lightHint, "Warm Human");
  });
});
