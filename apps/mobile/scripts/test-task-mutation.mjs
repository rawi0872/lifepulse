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

console.log("=== Mobile Task Mutation Proof ===\n");

// Setup clients
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

// Create a test task
console.log("\n2. Create a test task");
const { data: task, error: createErr } = await clientA
  .from("tasks")
  .insert({
    user_id: userIdA,
    title: "Mobile Task Mutation Test",
    priority: "medium",
    status: "todo",
  })
  .select("id, status, completed_at")
  .single();

assert(!createErr && task, "Task created");
const taskId = task?.id;

// Complete the task
console.log("\n3. Complete the task");
if (taskId) {
  const { data: updated, error: updateErr } = await clientA
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userIdA)
    .eq("status", "todo")
    .select("id, status, completed_at")
    .single();

  assert(!updateErr && updated?.status === "done", "Task marked as done");
  assert(updated?.completed_at !== null, "completed_at is set");
}

// Reopen the task
console.log("\n4. Reopen the task");
if (taskId) {
  const { data: reopened, error: reopenErr } = await clientA
    .from("tasks")
    .update({ status: "todo", completed_at: null })
    .eq("id", taskId)
    .eq("user_id", userIdA)
    .eq("status", "done")
    .select("id, status, completed_at")
    .single();

  assert(!reopenErr && reopened?.status === "todo", "Task reopened to todo");
  assert(reopened?.completed_at === null, "completed_at cleared");
}

// Cleanup
console.log("\n5. Cleanup");
if (taskId) {
  const { error: deleteErr } = await clientA
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userIdA);
  assert(!deleteErr, "Test task deleted");
}

// Test RLS: unauthenticated cannot create
console.log("\n6. Unauthenticated cannot create task");
const { error: unauthErr } = await unauthClient
  .from("tasks")
  .insert({
    user_id: userIdA,
    title: "Should fail",
    priority: "low",
    status: "todo",
  });
assert(!!unauthErr, "Unauthenticated create blocked by RLS");

// Sign out
console.log("\n7. Sign out");
await clientA.auth.signOut();

console.log("\n" + "─".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("\nTASK MUTATION PROOF FAILED");
  process.exit(1);
} else {
  console.log("\nTASK MUTATION PROOF PASSED — Mobile can complete and reopen tasks via Supabase client.");
}
