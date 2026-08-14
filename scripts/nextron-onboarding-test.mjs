#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing file: ${path}`);
  return readFileSync(path, "utf8");
}

function pass(label) { console.log(`PASS ${label}`); }
function assert(condition, label) {
  if (!condition) throw new Error(label);
  pass(label);
}

const pkg = JSON.parse(read(resolve(root, "package.json")));
const migration = read(resolve(root, "supabase/migrations/00032_nextron_conversational_onboarding.sql"));
const onboardingLib = read(resolve(root, "src/lib/nextron/onboarding.ts"));
const onboardingRoute = read(resolve(root, "src/app/api/nextron/onboarding/route.ts"));
const onboardingPage = read(resolve(root, "src/app/onboarding/page.tsx"));
const proxy = read(resolve(root, "src/proxy.ts"));

assert(pkg.scripts["test:nextron-onboarding"] === "node scripts/nextron-onboarding-test.mjs", "Onboarding test script is registered");

assert(migration.includes("create table if not exists public.nextron_onboarding"), "Onboarding persistence table exists");
assert(migration.includes("status in ('not_started', 'in_progress', 'draft_ready', 'completed', 'skipped')"), "State model has explicit bounded statuses");
assert(migration.includes("user_id uuid not null references auth.users(id) on delete cascade unique"), "Onboarding state is one row per owner");
assert(migration.includes("conversation_id uuid references public.nextron_conversations"), "Onboarding links to canonical NEXTRON conversations");
assert(migration.includes("setup_draft jsonb") && migration.includes("understanding jsonb"), "Understanding and setup draft persist durably");
assert(migration.includes("enable row level security") && migration.includes("auth.uid() = user_id"), "Onboarding RLS is owner-scoped");
assert(migration.includes("for delete to authenticated using (false)"), "Onboarding rows are not client-deletable in v1");
assert(migration.includes("revoke all privileges") && migration.includes("grant select, insert, update"), "Onboarding privileges exclude anon/public and allow minimum authenticated access");

assert(proxy.includes("nextron_onboarding") && proxy.includes("onboardingStatus === \"completed\" || onboardingStatus === \"skipped\""), "Proxy distinguishes existing/new/skipped onboarding users explicitly");
assert(!proxy.includes("goals.length") && !proxy.includes("tasks.length") && !proxy.includes("habits.length"), "New-user detection does not rely on empty domain data");

assert(onboardingRoute.includes("export async function GET()") && onboardingRoute.includes("export async function POST") && onboardingRoute.includes("export async function PATCH"), "Onboarding API exposes load, turn, and transition endpoints");
assert(onboardingRoute.includes("supabase.auth.getUser()") && onboardingRoute.includes("Sign in"), "Onboarding API rejects unauthenticated access");
assert(onboardingRoute.includes("ensureConversation") && onboardingRoute.includes("nextron_messages"), "Onboarding turns reuse NEXTRON conversation storage");
assert(onboardingRoute.includes("clientMessageId") && onboardingRoute.includes("eq(\"client_message_id\", clientMessageId)"), "Duplicate onboarding submits are idempotent by client message id");
assert(onboardingRoute.includes("status: nextStatus") && onboardingRoute.includes("draft_ready"), "Draft readiness persists without entity creation");
assert(onboardingRoute.includes("action !== \"skip\"") && onboardingRoute.includes("status: \"skipped\""), "Skip state persists explicitly");
assert(onboardingRoute.includes("status: \"completed\"") && onboardingRoute.includes("onboarding_completed: true"), "Looks-right marks onboarding complete only after draft exists");
assert(!onboardingRoute.includes("from(\"goals\")") && !onboardingRoute.includes("from(\"habits\")") && !onboardingRoute.includes("from(\"tasks\")") && !onboardingRoute.includes("from(\"projects\")"), "Onboarding API performs no domain writes");
assert(!onboardingRoute.includes("/api/nextron/actions") && !onboardingRoute.includes("approve"), "Onboarding API cannot execute actions");

assert(onboardingLib.includes("MAX_GOALS = 4") && onboardingLib.includes("MAX_HABITS = 4") && onboardingLib.includes("MAX_TASKS = 6") && onboardingLib.includes("MAX_PROJECTS = 3"), "Starting plan counts are bounded");
assert(onboardingLib.includes("deliberatelyLeftOut") && onboardingLib.includes("Large tracker library"), "Draft includes deliberate omissions");
assert(onboardingLib.includes("normalizeLifeSetupDraft") && onboardingLib.includes("normalizeOnboardingUnderstanding"), "Draft and understanding schemas are validated");
assert(onboardingLib.includes("removePatterns") && onboardingLib.includes("forget|remove|drop|not now"), "Corrections can replace outdated assumptions");
assert(onboardingLib.includes("onboardingReadiness") && !onboardingLib.includes("messageCount >= 5"), "Readiness is not fixed message count");
assert(onboardingLib.includes("PROVIDER_DISABLED") && onboardingLib.includes("buildDeterministicOnboardingTurn"), "Provider failure has deterministic fallback");
assert(onboardingLib.includes("Do not create entities") && onboardingLib.includes("or store Memory"), "Provider contract forbids writes and hidden Memory");

assert(onboardingPage.includes("Tell me what is changing") && onboardingPage.includes("Starting plan"), "Onboarding UI is conversation-first with human starting-plan UI");
assert(onboardingPage.includes("What I understand") && onboardingPage.includes("Deliberately left out"), "UI shows understanding and judgment sections");
assert(onboardingPage.includes("Skip for now") && onboardingPage.includes("Resume onboarding"), "Skip and resume controls are present");
assert(onboardingPage.includes("Nothing is created until you allow and approve it"), "Ready action copy avoids misleading writes");
assert(!onboardingPage.includes("setInterval") && !onboardingPage.includes("poll"), "Onboarding UI has no polling");
assert(!onboardingPage.includes("/api/nextron/onboarding", onboardingPage.indexOf("useEffect")) || onboardingPage.includes("method: \"GET\""), "Onboarding page render does not call model endpoint directly");

console.log("NEXTRON Conversational Onboarding v1 contract checks passed.");
