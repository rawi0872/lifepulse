#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { aggregateProductLearning, parseArgs, renderProductLearningReport } from "./report-product-learning.mjs";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

function assert(condition, label) {
  if (!condition) throw new Error(label);
  console.log(`PASS ${label}`);
}

const pkg = JSON.parse(read("package.json"));
const migration = read("supabase/migrations/00036_product_learning_loop.sql");
const eventsLib = read("src/lib/product-learning/events.ts");
const eventRoute = read("src/app/api/product-learning/events/route.ts");
const preferenceRoute = read("src/app/api/product-learning/preference/route.ts");
const feedbackRoute = read("src/app/api/feedback/route.ts");
const feedbackDialog = read("src/components/feedback/FeedbackDialog.tsx");
const report = read("scripts/report-product-learning.mjs");
const verifier = read("scripts/alpha1-prod-e2e-verifier.mjs");

const allowlist = [
  "onboarding_started",
  "onboarding_completed",
  "today_opened",
  "nextron_ask_succeeded",
  "nextron_ask_failed",
  "task_completed",
  "habit_completed",
  "goal_created",
  "project_created",
  "weekly_review_completed",
  "journal_entry_created",
  "feedback_submitted",
];

assert(pkg.scripts["report:product-learning"] === "node scripts/report-product-learning.mjs", "Product learning report script is registered");
assert(pkg.scripts["test:product-learning-privacy"] === "node scripts/product-learning-privacy-test.mjs", "Product learning privacy test is registered");

for (const event of allowlist) assert(eventsLib.includes(`"${event}"`) && migration.includes(`'${event}'`), `Event allowlist includes ${event}`);
assert(eventsLib.includes("isProductLearningEvent") && eventRoute.includes("!isProductLearningEvent"), "Arbitrary event names are rejected");
assert(eventRoute.includes("body.userId !== undefined") && feedbackRoute.includes("body.userId !== undefined"), "Client owner spoofing is rejected");
assert(eventRoute.includes("allow_product_improvement_events") && eventRoute.includes("recorded: false"), "Telemetry-disabled users do not emit optional product events");
assert(preferenceRoute.includes("PATCH") && preferenceRoute.includes("typeof body?.allow !== \"boolean\""), "Product improvement consent is explicit and bounded");
assert(migration.includes("enable row level security") && migration.includes("auth.uid() = user_id"), "Product learning events are RLS owner-scoped");
assert(migration.includes("references auth.users(id) on delete cascade") && verifier.includes("product_learning_events") && verifier.includes("beta_feedback"), "User deletion cleanup covers learning data and feedback");
assert(!migration.includes("jsonb") && !eventRoute.includes("prompt") && !eventRoute.includes("message") && !eventRoute.includes("content"), "Events do not accept raw prompt/message/content metadata");
for (const forbidden of ["taskTitle", "task_name", "journalText", "conversationText", "goalTitle", "projectTitle", "habitTitle", "fileName", "bodyValue", "financeAmount", "calendarTitle"]) {
  assert(!eventRoute.includes(forbidden), `Forbidden private metadata absent: ${forbidden}`);
}
assert(eventsLib.includes("keys.some") && eventRoute.includes("Unsupported product learning metadata"), "Malformed or unknown metadata is rejected");
assert(feedbackRoute.includes("message.length < 1") && feedbackRoute.includes("message.length > 2000") && feedbackDialog.includes("/api/feedback"), "Feedback free text is accepted only through explicit feedback path");
assert(!feedbackDialog.includes("navigator.userAgent") && feedbackRoute.includes("viewport:") && !feedbackRoute.includes("userAgent"), "Feedback diagnostics exclude user agent, screenshots, DOM, and private state");
assert(report.includes("select(\"user_id,event_type,surface,occurred_at,status,reason,viewport\")") && report.includes("Expected substring") === false, "Default report selects aggregate-safe event columns only");
assert(report.includes("args.feedback ?") && report.includes("Explicit Feedback"), "Feedback text is behind deliberate --feedback option");
assert(report.includes("EXPECTED_PROD_BASE") && report.includes("Refusing to run without explicit production target validation"), "Report validates production target explicitly");
assert(!report.includes("console.log(serviceKey") && !report.includes("console.log(SUPABASE") && !report.includes("process.stdout.write(serviceKey"), "Report does not print secrets");

const args = parseArgs(["--from=2026-08-01", "--to=2026-08-12"]);
assert(args.from === "2026-08-01" && args.to === "2026-08-12", "Report date filters parse");
let rejectedBadDate = false;
try { parseArgs(["--from=private journal text"]); } catch { rejectedBadDate = true; }
assert(rejectedBadDate, "Report rejects malformed date filters");

const summary = aggregateProductLearning([
  { user_id: "u1", event_type: "onboarding_started", surface: "onboarding", occurred_at: "2026-08-11T10:00:00.000Z" },
  { user_id: "u1", event_type: "onboarding_completed", surface: "onboarding", occurred_at: "2026-08-11T10:10:00.000Z" },
  { user_id: "u1", event_type: "today_opened", surface: "today", occurred_at: "2026-08-12T10:00:00.000Z" },
  { user_id: "u2", event_type: "nextron_ask_failed", surface: "nextron", occurred_at: "2026-08-12T10:00:00.000Z" },
  { user_id: "u2", event_type: "task_completed", surface: "tasks", occurred_at: "2026-08-12T10:00:00.000Z" },
], [
  { user_id: "u1", category: "confusing", rating: 3, page_path: "/today", created_at: "2026-08-12T10:00:00.000Z", message: "private explicit feedback" },
]);
assert(summary.totalRelevantBetaUsers === 2 && summary.onboardingCompleted === 1 && summary.nextronAskFailed === 1 && summary.tasksCompleted === 1, "Report aggregation works on fixtures");
const defaultReport = renderProductLearningReport(summary, args, [{ message: "intentional feedback text", category: "idea", created_at: "2026-08-12", page_path: "/settings" }]);
assert(!defaultReport.includes("intentional feedback text"), "Default report does not print feedback text");
const feedbackReport = renderProductLearningReport(summary, { ...args, feedback: true }, [{ message: "intentional feedback text", category: "idea", created_at: "2026-08-12", page_path: "/settings" }]);
assert(feedbackReport.includes("intentional feedback text"), "--feedback report prints only intentionally submitted feedback");

console.log("Product learning privacy contract checks passed.");
