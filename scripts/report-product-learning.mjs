#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PROD_BASE = "https://lifepulse-sand.vercel.app";

function loadEnv(filepath) {
  if (!existsSync(filepath)) return {};
  const vars = {};
  for (const line of readFileSync(filepath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

export function parseArgs(argv) {
  const args = { feedback: false, from: null, to: null };
  for (const arg of argv) {
    if (arg === "--feedback") args.feedback = true;
    else if (arg.startsWith("--from=")) args.from = arg.slice("--from=".length);
    else if (arg.startsWith("--to=")) args.to = arg.slice("--to=".length);
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  for (const key of ["from", "to"]) {
    if (args[key] && !/^\d{4}-\d{2}-\d{2}$/.test(args[key])) throw new Error(`Invalid --${key}. Use YYYY-MM-DD.`);
  }
  return args;
}

function inRangeQuery(query, column, args) {
  let next = query;
  if (args.from) next = next.gte(column, `${args.from}T00:00:00.000Z`);
  if (args.to) next = next.lte(column, `${args.to}T23:59:59.999Z`);
  return next;
}

function unique(values) {
  return new Set(values.filter(Boolean));
}

export function aggregateProductLearning(events, feedback) {
  const eventRows = Array.isArray(events) ? events : [];
  const feedbackRows = Array.isArray(feedback) ? feedback : [];
  const eventUsers = unique(eventRows.map((row) => row.user_id));
  const feedbackUsers = unique(feedbackRows.map((row) => row.user_id));
  const users = unique([...eventUsers, ...feedbackUsers]);
  const byType = {};
  const bySurface = {};
  const feedbackByCategory = {};
  const activeToday = new Set();
  const active7 = new Set();
  const activeDaysByUser = new Map();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const row of eventRows) {
    byType[row.event_type] = (byType[row.event_type] ?? 0) + 1;
    bySurface[row.surface] = (bySurface[row.surface] ?? 0) + 1;
    const occurredAt = new Date(row.occurred_at);
    const day = Number.isNaN(occurredAt.getTime()) ? null : occurredAt.toISOString().slice(0, 10);
    if (row.user_id && day) {
      if (day === todayKey) activeToday.add(row.user_id);
      if (occurredAt >= sevenDaysAgo) active7.add(row.user_id);
      const days = activeDaysByUser.get(row.user_id) ?? new Set();
      days.add(day);
      activeDaysByUser.set(row.user_id, days);
    }
  }
  for (const row of feedbackRows) feedbackByCategory[row.category ?? "uncategorized"] = (feedbackByCategory[row.category ?? "uncategorized"] ?? 0) + 1;

  const onboardedUsers = unique(eventRows.filter((row) => row.event_type === "onboarding_completed").map((row) => row.user_id));
  const returnedAfterOnboarding = new Set();
  for (const userId of onboardedUsers) {
    const completedAt = eventRows
      .filter((row) => row.user_id === userId && row.event_type === "onboarding_completed")
      .map((row) => new Date(row.occurred_at).getTime())
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => a - b)[0];
    if (!completedAt) continue;
    const returned = eventRows.some((row) => row.user_id === userId && row.event_type !== "onboarding_completed" && new Date(row.occurred_at).getTime() > completedAt + 12 * 60 * 60 * 1000);
    if (returned) returnedAfterOnboarding.add(userId);
  }

  return {
    totalRelevantBetaUsers: users.size,
    onboardingStarted: byType.onboarding_started ?? 0,
    onboardingCompleted: byType.onboarding_completed ?? 0,
    activeToday: activeToday.size,
    activeLast7Days: active7.size,
    returningUsers: returnedAfterOnboarding.size,
    nextronAskSucceeded: byType.nextron_ask_succeeded ?? 0,
    nextronAskFailed: byType.nextron_ask_failed ?? 0,
    tasksCompleted: byType.task_completed ?? 0,
    habitsCompleted: byType.habit_completed ?? 0,
    weeklyReviewsCompleted: byType.weekly_review_completed ?? 0,
    goalsCreated: byType.goal_created ?? 0,
    projectsCreated: byType.project_created ?? 0,
    journalEntriesCreated: byType.journal_entry_created ?? 0,
    feedbackCount: feedbackRows.length,
    feedbackByCategory,
    surfaceUsage: bySurface,
    distinctActiveDaysByUser: Array.from(activeDaysByUser.values()).map((days) => days.size),
  };
}

export function renderProductLearningReport(summary, args, feedbackRows = []) {
  const lines = [];
  lines.push("Life Pulse Product Learning Report");
  lines.push(`Range: ${args.from ?? "beginning"} to ${args.to ?? "now"}`);
  lines.push("");
  lines.push(`Relevant beta users: ${summary.totalRelevantBetaUsers}`);
  lines.push(`Onboarding started/completed: ${summary.onboardingStarted}/${summary.onboardingCompleted}`);
  lines.push(`Active today: ${summary.activeToday}`);
  lines.push(`Active last 7 days: ${summary.activeLast7Days}`);
  lines.push(`Returning after onboarding: ${summary.returningUsers}`);
  lines.push(`NEXTRON asks succeeded/failed: ${summary.nextronAskSucceeded}/${summary.nextronAskFailed}`);
  lines.push(`Tasks completed: ${summary.tasksCompleted}`);
  lines.push(`Habits completed: ${summary.habitsCompleted}`);
  lines.push(`Goals created: ${summary.goalsCreated}`);
  lines.push(`Projects created: ${summary.projectsCreated}`);
  lines.push(`Weekly Reviews completed: ${summary.weeklyReviewsCompleted}`);
  lines.push(`Journal entries created: ${summary.journalEntriesCreated}`);
  lines.push(`Feedback count: ${summary.feedbackCount}`);
  lines.push(`Feedback by category: ${JSON.stringify(summary.feedbackByCategory)}`);
  lines.push(`Primary surface usage: ${JSON.stringify(summary.surfaceUsage)}`);
  if (summary.distinctActiveDaysByUser.length > 0) lines.push(`Distinct active days per user: ${summary.distinctActiveDaysByUser.join(", ")}`);
  if (args.feedback) {
    lines.push("");
    lines.push("Explicit Feedback");
    for (const row of feedbackRows) lines.push(`- ${row.created_at} ${row.category ?? "uncategorized"} rating=${row.rating ?? "none"} route=${row.page_path ?? "unknown"}: ${String(row.message).slice(0, 500)}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileEnv = loadEnv(resolve(__dirname, "..", ".env.test.local"));
  const env = { ...fileEnv, ...process.env };
  const base = env.LIFE_PULSE_PROD_BASE_URL;
  if (base !== EXPECTED_PROD_BASE) throw new Error(`Refusing to run without explicit production target validation. Set LIFE_PULSE_PROD_BASE_URL=${EXPECTED_PROD_BASE}`);
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase URL or service role key for read-only local report.");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const eventQuery = inRangeQuery(supabase.from("product_learning_events").select("user_id,event_type,surface,occurred_at,status,reason,viewport"), "occurred_at", args);
  const feedbackQuery = inRangeQuery(supabase.from("beta_feedback").select(args.feedback ? "user_id,category,rating,page_path,message,created_at" : "user_id,category,rating,page_path,created_at"), "created_at", args);
  const [{ data: events, error: eventError }, { data: feedback, error: feedbackError }] = await Promise.all([eventQuery, feedbackQuery]);
  if (eventError) throw new Error(`Product event read failed: ${eventError.message}`);
  if (feedbackError) throw new Error(`Feedback read failed: ${feedbackError.message}`);
  const summary = aggregateProductLearning(events ?? [], feedback ?? []);
  process.stdout.write(renderProductLearningReport(summary, args, feedback ?? []));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
