import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(filepath) {
  if (!existsSync(filepath)) return {};
  const vars = {};
  for (const line of readFileSync(filepath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const env = {
  ...loadEnv(resolve(__dirname, "..", ".env.local")),
  ...process.env,
};

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL_A = process.env.RLS_TEST_USER_A_EMAIL || process.env.LIFE_PULSE_QA_EMAIL;
const PASSWORD_A = process.env.RLS_TEST_USER_A_PASSWORD || process.env.LIFE_PULSE_QA_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

if (!EMAIL_A || !PASSWORD_A) {
  console.error("Missing test credentials (RLS_TEST_USER_A_EMAIL/PASSWORD or LIFE_PULSE_QA_EMAIL/PASSWORD)");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

console.log("=== Mobile Habit Mutation Proof ===\n");

// Setup client
const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign in as User A
console.log("1. Sign in as User A");
const { data: signInData, error: signInError } = await clientA.auth.signInWithPassword({
  email: EMAIL_A,
  password: PASSWORD_A,
});
assert(!signInError && signInData.user, "User A signed in");
const userIdA = signInData.user.id;

// Get an existing habit
console.log("\n2. Get an existing habit");
const { data: habits, error: habitsErr } = await clientA
  .from("habits")
  .select("id, title")
  .eq("user_id", userIdA)
  .limit(1);

assert(!habitsErr && habits && habits.length > 0, "Found at least one habit");
const habit = habits?.[0];

// Log habit completion
console.log("\n3. Log habit completion");
const today = new Date().toISOString().split("T")[0];
let logId = null;

if (habit) {
  const { data: existing } = await clientA
    .from("habit_logs")
    .select("id")
    .eq("user_id", userIdA)
    .eq("habit_id", habit.id)
    .eq("completed_date", today)
    .maybeSingle();

  if (!existing) {
    const { data: log, error: logErr } = await clientA
      .from("habit_logs")
      .insert({
        user_id: userIdA,
        habit_id: habit.id,
        completed_date: today,
      })
      .select("id")
      .single();

    assert(!logErr && log, "Habit log created");
    logId = log?.id;
  } else {
    logId = existing.id;
    assert(true, "Habit already logged today (idempotent)");
  }
}

// Verify the log exists
console.log("\n4. Verify habit log exists");
if (habit) {
  const { data: logs, error: logsErr } = await clientA
    .from("habit_logs")
    .select("id, habit_id, completed_date")
    .eq("user_id", userIdA)
    .eq("habit_id", habit.id)
    .eq("completed_date", today);

  assert(!logsErr && logs && logs.length > 0, "Habit log found for today");
}

// Test RLS: unauthenticated cannot log habit
console.log("\n5. Unauthenticated cannot log habit");
if (habit) {
  const { error: unauthErr } = await unauthClient
    .from("habit_logs")
    .insert({
      user_id: userIdA,
      habit_id: habit.id,
      completed_date: today,
    });
  assert(!!unauthErr, "Unauthenticated habit log blocked by RLS");
}

// Cleanup
console.log("\n6. Cleanup");
if (logId) {
  const { error: deleteErr } = await clientA
    .from("habit_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", userIdA);
  assert(!deleteErr, "Test habit log deleted");
}

// Sign out
console.log("\n7. Sign out");
await clientA.auth.signOut();

console.log("\n" + "─".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("\nHABIT MUTATION PROOF FAILED");
  process.exit(1);
} else {
  console.log("\nHABIT MUTATION PROOF PASSED — Mobile can log and verify habit completions via Supabase client.");
}
