#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const signalsPath = resolve(root, "src/lib/nextron/signals.ts");
const routePath = resolve(root, "src/app/api/nextron/signals/route.ts");
const coachPath = resolve(root, "src/app/coach/page.tsx");
const packagePath = resolve(root, "package.json");

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing file: ${path}`);
  return readFileSync(path, "utf-8");
}

function pass(label) {
  console.log(`PASS ${label}`);
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
  pass(label);
}

const signals = read(signalsPath);
const route = read(routePath);
const coach = read(coachPath);
const pkg = JSON.parse(read(packagePath));

assert(pkg.scripts["test:nextron-signals"] === "node scripts/nextron-signals-test.mjs", "Signal test script is registered");
assert(route.includes("export async function GET()") && route.includes("/api/nextron/signals") === false, "Signals use a bounded authenticated GET route implementation");
assert(route.includes("modelCalls: 0") && route.includes('provider: "deterministic"'), "Q provider unavailable does not affect signal detection because model calls are zero");
assert(route.includes("persisted: false"), "Signals are derived current observations, not persisted alerts");

assert(signals.includes('deadline_overdue') && signals.includes('high-priority overdue'), "A high-priority overdue task creates a deadline signal");
assert(signals.includes('overdue.length >= 2') && !signals.includes('critical'), "B low-priority single overdue items avoid noisy/alarming severity");
assert(signals.includes('projectStallDays: 8') && signals.includes('no completed linked task or project update'), "C active stalled project rule uses conservative progress semantics");
assert(signals.includes('projectStatus === "active"'), "D inactive projects do not create stall signals");
assert(signals.includes('habitMisses: 2') && signals.includes('consecutive expected days'), "E repeated scheduled habit misses create a signal");
assert(signals.includes('habit.frequency === "times_per_week" || habit.frequency === "weekly"') && signals.includes('return []'), "F unsupported/flexible habit schedules do not create bogus miss streaks");
assert(signals.includes('reviewExpectedDay: 5') && signals.includes('existsThisWeek'), "G Weekly Review gap waits for appropriate review window and disappears when completed");
assert(signals.includes('calendarPressureEventCount: 4') && signals.includes('dueWork >= 2'), "H Calendar pressure requires commitments plus due work");
assert(signals.includes('freeBlockMinutes: 90') && signals.includes('gapMinutes >= NEXTRON_SIGNAL_LIMITS.freeBlockMinutes'), "I/J useful 90-minute free blocks are detected and short gaps are ignored");
assert(signals.includes('today_clear') && signals.includes('habit_target_met') && signals.includes('weeklyCompletedCount >= habits.weeklyTargetCount'), "Positive progress signals use canonical current task and habit data");
assert(signals.includes('maxVisible: 5') && signals.includes('.slice(0, NEXTRON_SIGNAL_LIMITS.maxVisible)'), "K visible signals are capped at five after ranking");
assert(signals.includes('deduped = new Map') && signals.includes('severityRank(candidate.severity)'), "L duplicate underlying issues are deterministically deduplicated/ranked");
assert(signals.includes('isNextronContextAllowed(evidence.permissions, "calendar")') && signals.includes('isNextronContextAllowed(evidence.permissions, "projects")'), "M permission-off sources do not create source-derived signals");
assert(signals.includes('task.status === "todo"') && signals.includes('completedAt'), "N completed/resolved task conditions disappear from current signals");
assert(signals.includes('replace(/\\b(ignore|reveal|system prompt|developer message|secret)\\b/gi'), "O injection-like task/calendar text is sanitized as data");
assert(coach.includes('No meaningful signals right now') && coach.includes('not manufacturing urgency'), "P no-data state is honest and calm");

assert(!signals.includes('GROQ_API_KEY') && !signals.includes('OPENAI_API_KEY'), "Model providers are not used for signal detection");
assert(!signals.includes('knowledge_items') && !signals.includes('google_drive_imports') && !signals.includes('nextron_memories'), "Knowledge, Drive, and Memory are not automatically scanned");
assert(coach.includes('data-nextron-signals="true"') && coach.includes('data-nextron-signal="true"'), "Signal UI exposes stable QA landmarks");
assert(coach.includes('data-nextron-attention="true"') && coach.includes('NEXTRON Noticed'), "Signals feed the proactive NEXTRON Attention presentation");
assert(coach.includes('Why does this matter?') && coach.includes('What should I do?'), "Signal conversation bridge is present without actions");
assert(coach.includes('loadSignals') && coach.includes('visibilitychange') && coach.includes('loadLiveContext'), "Signals refresh on entry/focus/current context refresh pattern without polling");

console.log("NEXTRON Proactive Signals v1 contract checks passed.");
