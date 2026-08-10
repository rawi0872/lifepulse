import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const attention = read("src/lib/nextron/attention.ts");
const signals = read("src/lib/nextron/signals.ts");
const signalRoute = read("src/app/api/nextron/signals/route.ts");
const attentionRoute = read("src/app/api/nextron/attention/route.ts");
const coachPage = read("src/app/coach/page.tsx");
const todayPage = read("src/app/today/page.tsx");
const pkg = JSON.parse(read("package.json"));

assert(pkg.scripts["test:nextron-attention"] === "node scripts/nextron-attention-test.mjs", "Attention test script is registered.");

assert(attention.includes('version: "nextron-attention-v1"') && attention.includes('modelCalls: 0') && attention.includes('provider: "deterministic"'), "Attention summary must be versioned, deterministic, and zero-model.");
assert(attention.includes('source: "signals"') && attention.includes("buildNextronAttentionSummary"), "Attention must be a ranked presentation layer over Signals.");
assert(attention.includes("SEVERITY_ORDER") && attention.includes("maxPrimary: 1") && attention.includes("maxSecondary: 4"), "Attention ranking and surfaced counts must be bounded.");
assert(attention.includes('status: args.partial ? "partial" : calm ? "calm" : "active"') && attention.includes("NEXTRON sees nothing that needs immediate attention"), "Calm state must be first-class and not filler urgency.");
assert(!attention.includes("GROQ") && !attention.includes("OPENAI") && !attention.includes("createConfiguredNextronProvider"), "Attention must not call model providers.");

assert(signals.includes('today_clear') && signals.includes('habit_target_met'), "Signals should support sparse positive intelligence where canonical data proves it.");
assert(signals.includes('tasks.dueTodayCount > 0') && signals.includes('tasks.dueTodayCount === tasks.completedTodayCount') && signals.includes('tasks.overdueCount === 0'), "Today-clear positive signal must require canonical completed due work and no overdue tasks.");
assert(signals.includes('habits.weeklyCompletedCount >= habits.weeklyTargetCount'), "Habit target positive signal must use canonical weekly target math.");
assert(signals.includes('task.status === "todo"') && signals.includes('projectStatus === "active"') && signals.includes('isNextronContextAllowed(evidence.permissions'), "Signal rules must stay permission-gated and avoid completed/inactive false positives.");
assert(signals.includes('id: "deadline:high-overdue"') && signals.includes('id: `habit:${habit.id}`') && signals.includes('id: "positive:today-clear"'), "Signal conditions must use stable deterministic identities.");

assert(signalRoute.includes("buildNextronAttentionSummary") && signalRoute.includes("attention,") && signalRoute.includes("modelCalls: 0"), "Signals API should return Attention without a second engine or model call.");
assert(attentionRoute.includes("export async function GET()") && attentionRoute.includes("supabase.auth.getUser()") && attentionRoute.includes("user.id") && attentionRoute.includes("buildNextronSignalEvidence") && attentionRoute.includes("deriveNextronSignals"), "Attention API must be authenticated, owner-scoped, and reuse Signals.");
assert(!attentionRoute.includes("POST") && !attentionRoute.includes("PATCH") && !attentionRoute.includes("DELETE"), "Attention API must not expose mutation endpoints.");
assert(!attentionRoute.includes("service_role") && !attentionRoute.includes("SUPABASE_SERVICE_ROLE"), "Attention API must not use service role access.");

assert(coachPage.includes('data-nextron-attention="true"') && coachPage.includes("NEXTRON Noticed") && coachPage.includes("What deserves attention right now"), "NEXTRON command center must surface proactive Attention before asking.");
assert(coachPage.includes("Why this surfaced") && coachPage.includes("Ask NEXTRON") && coachPage.includes("onAsk(item.bridgePrompt)"), "Attention UI must expose evidence and normal Ask-NEXTRON transition.");
assert(!coachPage.includes("dangerouslySetInnerHTML") && !coachPage.includes("new Function"), "Attention UI must not execute arbitrary markup or code.");

assert(todayPage.includes('data-today-nextron-attention="true"') && todayPage.includes("/api/nextron/attention") && todayPage.includes("NEXTRON Noticed"), "Today must reuse the same Attention engine through the Attention API.");
assert(todayPage.includes("lifepulse:nextron-bridge") && todayPage.includes("item.bridgePrompt"), "Today attention items must bridge to normal NEXTRON Ask without auto-sending.");
assert(todayPage.includes("Model calls: {attention?.meta.modelCalls ?? 0}"), "Today Attention UI must expose zero-model cost state.");

assert(!coachPage.includes("setInterval") && !todayPage.includes("setInterval"), "Prompt 5 must not add polling.");
assert(!attentionRoute.includes("cron") && !signalRoute.includes("cron"), "Prompt 5 must not add scheduled/background execution.");

console.log("NEXTRON Attention v1 contract checks passed.");
