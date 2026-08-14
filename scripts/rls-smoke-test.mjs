#!/usr/bin/env node

// Life Pulse RLS Smoke Test
// Uses anon key only. No service role.
// Tests that User A and User B data are fully isolated.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
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

const env = { ...loadEnv(resolve(__dirname, "..", ".env.local")), ...loadEnv(resolve(__dirname, "..", ".env.test.local")), ...process.env };

// ─── Env vars ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
let EMAIL_A = env.RLS_TEST_USER_A_EMAIL;
let PASSWORD_A = env.RLS_TEST_USER_A_PASSWORD;
let EMAIL_B = env.RLS_TEST_USER_B_EMAIL;
let PASSWORD_B = env.RLS_TEST_USER_B_PASSWORD;
const ADMIN_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE_WRITE_ACK = env.LIFE_PULSE_RLS_LIVE_WRITE_ACK === "1";

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const hasManualCredentialPairA = Boolean(EMAIL_A && PASSWORD_A);
const hasManualCredentialPairB = Boolean(EMAIL_B && PASSWORD_B);
const needsSyntheticUsers = !(hasManualCredentialPairA && hasManualCredentialPairB);
if (needsSyntheticUsers && !ADMIN_KEY) missing.push("RLS_TEST_USER_A_EMAIL/RLS_TEST_USER_A_PASSWORD/RLS_TEST_USER_B_EMAIL/RLS_TEST_USER_B_PASSWORD or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY for disposable provisioning");

if (missing.length > 0) {
  console.error("");
  console.error("RLS smoke test requires the following env vars:");
  for (const v of missing) console.error(`  ${v}`);
  console.error("");
  console.error("Create a .env.local or set them in your shell, then run:");
  console.error("  npm run test:rls");
  console.error("");
  process.exit(1);
}

const supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : null;
const isCloudTarget = Boolean(supabaseHost?.endsWith(".supabase.co"));
const supabaseRef = isCloudTarget ? supabaseHost.split(".")[0] : supabaseHost;

console.log(`RLS target URL: ${SUPABASE_URL}`);
console.log(`RLS target ref: ${supabaseRef ?? "unknown"}`);
console.log(`RLS target kind: ${isCloudTarget ? "supabase-cloud" : "local-or-custom"}`);

if (needsSyntheticUsers && isCloudTarget && !LIVE_WRITE_ACK) {
  console.error("");
  console.error("RLS synthetic-user provisioning would create/delete live Supabase auth users and run-scoped rows.");
  console.error("Set LIFE_PULSE_RLS_LIVE_WRITE_ACK=1 to acknowledge this bounded live write, then run:");
  console.error("  npm run test:rls");
  console.error("");
  process.exit(2);
}

console.error(needsSyntheticUsers ? "Using admin only for synthetic auth setup/cleanup; RLS checks use anon authenticated clients." : "Using pre-existing test credentials with anon authenticated clients.");

// ─── Timestamp prefix for unique test records ─────────────────────────────────

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const PREFIX = `RLS_TEST_${TS}`;
const RUN_ID = `rls-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${randomBytes(4).toString("hex")}`;

// ─── Test state ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];
const syntheticUserIds = [];
let adminForCleanup = null;

function pass(msg) {
  passed++;
  console.log(`  \u2705 ${msg}`);
}

function fail(msg) {
  failed++;
  failures.push(msg);
  console.log(`  \u274c ${msg}`);
}

function safeSupabaseError(error) {
  if (!error || typeof error !== "object") return "unknown error";
  const parts = [];
  if ("status" in error && error.status) parts.push(`status=${error.status}`);
  if ("code" in error && error.code) parts.push(`code=${error.code}`);
  if ("message" in error && error.message) parts.push(`message=${String(error.message).slice(0, 200)}`);
  return parts.length > 0 ? parts.join(" ") : "no safe diagnostics available";
}

function adminClient() {
  return createClient(SUPABASE_URL, ADMIN_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function validateAdmin(admin) {
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(`Admin credential validation failed: ${safeSupabaseError(error)}`);
  pass("Admin credential authenticated without printing secrets");
}

async function createSyntheticUser(admin, label) {
  const email = `${label}-${RUN_ID}@example.invalid`;
  const password = `Rls-${randomBytes(24).toString("base64url")}!1a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic_run_id: RUN_ID, synthetic_release_gate: "rls-smoke" },
  });
  if (error || !data.user?.id) throw new Error(`Could not create synthetic ${label} user: ${safeSupabaseError(error)}`);
  syntheticUserIds.push(data.user.id);
  return { email, password, userId: data.user.id };
}

async function ensureTestUsers() {
  if (!needsSyntheticUsers) return;
  const admin = adminClient();
  adminForCleanup = admin;
  await validateAdmin(admin);
  const userA = await createSyntheticUser(admin, "rls-test-a");
  const userB = await createSyntheticUser(admin, "rls-test-b");
  EMAIL_A = userA.email;
  PASSWORD_A = userA.password;
  EMAIL_B = userB.email;
  PASSWORD_B = userB.password;
  pass("Synthetic RLS users created without printing credentials");
}

async function countByUser(admin, table, userId) {
  const { count, error } = await admin.from(table).select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) return null;
  return count ?? 0;
}

async function cleanupSyntheticUsers() {
  if (!adminForCleanup || syntheticUserIds.length === 0) return;
  let authUsers = 0;
  let productRows = 0;
  let feedbackRows = 0;
  for (const userId of syntheticUserIds) {
    const { error } = await adminForCleanup.auth.admin.deleteUser(userId);
    if (error) console.warn(`  Warning: synthetic auth cleanup failed for ...${userId.slice(-6)}: ${safeSupabaseError(error)}`);
    const authUser = await adminForCleanup.auth.admin.getUserById(userId).catch((err) => ({ data: null, error: err }));
    if (!authUser.error && authUser.data?.user) authUsers += 1;
    productRows += await countByUser(adminForCleanup, "product_learning_events", userId) ?? 0;
    feedbackRows += await countByUser(adminForCleanup, "beta_feedback", userId) ?? 0;
  }
  console.log(`  CLEANUP auth_users=${authUsers} product_learning_events=${productRows} beta_feedback=${feedbackRows}`);
}

function assertSourcePrivacyContracts() {
  const productRoute = readFileSync(resolve(__dirname, "..", "src", "app", "api", "product-learning", "events", "route.ts"), "utf8");
  const feedbackRoute = readFileSync(resolve(__dirname, "..", "src", "app", "api", "feedback", "route.ts"), "utf8");
  if (productRoute.includes("SUPABASE_SERVICE_ROLE") || productRoute.includes("SUPABASE_SECRET_KEY")) fail("Product-learning API exposes privileged analytics access");
  else pass("Product-learning API uses session ownership, not privileged client access");
  if (feedbackRoute.includes("body.userId !== undefined") && feedbackRoute.includes("Owner identity is derived from the session.")) pass("Feedback API rejects client-supplied owner identity");
  else fail("Feedback API does not explicitly reject owner spoofing");
}

// ─── Supabase clients ─────────────────────────────────────────────────────────

const supabaseA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: false },
});
const supabaseB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`\nSign-in failed for ${email}: ${error.message}`);
    console.error("Make sure both test users exist in Supabase Auth.");
    process.exit(1);
  }
  return data;
}

// (helper functions intentionally omitted — inline queries are clearer for this test)

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("=== Life Pulse RLS Smoke Test ===");
  console.log(`Prefix: ${PREFIX}`);
  console.log(`Run ID: ${RUN_ID}`);
  console.log("");

  await ensureTestUsers();
  assertSourcePrivacyContracts();
  console.log("");

  // ── 1. Sign in ──────────────────────────────────────────────────────────────

  console.log("--- Signing in ---");
  await signIn(supabaseA, EMAIL_A, PASSWORD_A);
  await signIn(supabaseB, EMAIL_B, PASSWORD_B);

  // Get authenticated user IDs
  const { data: userAData } = await supabaseA.auth.getUser();
  const { data: userBData } = await supabaseB.auth.getUser();
  const userAId = userAData.user.id;
  const userBId = userBData.user.id;

  // Safe debug: print last 6 chars of user IDs only
  console.log(`  User A signed in (id: ...${userAId.slice(-6)})`);
  console.log(`  User B signed in (id: ...${userBId.slice(-6)})`);
  console.log("");

  // ── 2. Create test data as User A ──────────────────────────────────────────

  console.log("--- Creating User A test data ---");

  // 2a. Realm
  const { data: realmA, error: realmAErr } = await supabaseA
    .from("realms")
    .insert({ name: `${PREFIX}_Realm`, color: "#6366f1", icon: "\u{1F31F}", user_id: userAId })
    .select()
    .single();
  if (realmAErr) {
    console.error(`  Failed to create realm (user ...${userAId.slice(-6)}): ${realmAErr.message}`);
    process.exit(1);
  }
  console.log(`  Realm created: ${realmA.id}`);

  // 2b. Project
  const { data: projectA, error: projAErr } = await supabaseA
    .from("projects")
    .insert({ title: `${PREFIX}_Project`, realm_id: realmA.id, status: "active", user_id: userAId })
    .select()
    .single();
  if (projAErr) {
    console.error(`  Failed to create project: ${projAErr.message}`);
    process.exit(1);
  }
  console.log(`  Project created: ${projectA.id}`);

  // 2c. Task
  const { data: taskA, error: taskAErr } = await supabaseA
    .from("tasks")
    .insert({
      title: `${PREFIX}_Task`,
      realm_id: realmA.id,
      project_id: projectA.id,
      status: "todo",
      user_id: userAId,
    })
    .select()
    .single();
  if (taskAErr) {
    console.error(`  Failed to create task: ${taskAErr.message}`);
    process.exit(1);
  }
  console.log(`  Task created: ${taskA.id}`);

  // 2d. Habit
  const { data: habitA, error: habitAErr } = await supabaseA
    .from("habits")
    .insert({
      title: `${PREFIX}_Habit`,
      realm_id: realmA.id,
      frequency: "daily",
      user_id: userAId,
    })
    .select()
    .single();
  if (habitAErr) {
    console.error(`  Failed to create habit: ${habitAErr.message}`);
    process.exit(1);
  }
  console.log(`  Habit created: ${habitA.id}`);

  // 2e. Habit log
  const { data: habitLogA, error: hlAErr } = await supabaseA
    .from("habit_logs")
    .insert({ habit_id: habitA.id, completed_date: "2099-01-01", user_id: userAId })
    .select()
    .single();
  if (hlAErr) {
    console.error(`  Failed to create habit_log: ${hlAErr.message}`);
    process.exit(1);
  }
  console.log(`  Habit log created: ${habitLogA.id}`);

  // 2f. XP event (task)
  const { data: xpTaskA, error: xpTaskAErr } = await supabaseA
    .from("xp_events")
    .insert({ source_type: "task", source_id: taskA.id, amount: 10, user_id: userAId })
    .select()
    .single();
  if (xpTaskAErr) {
    console.error(`  Failed to create xp_event (task): ${xpTaskAErr.message}`);
    process.exit(1);
  }
  console.log(`  XP event (task) created: ${xpTaskA.id}`);

  // 2g. XP event (habit log)
  const { data: xpHabitA, error: xpHabitAErr } = await supabaseA
    .from("xp_events")
    .insert({ source_type: "habit", source_id: habitLogA.id, amount: 5, user_id: userAId })
    .select()
    .single();
  if (xpHabitAErr) {
    console.error(`  Failed to create xp_event (habit): ${xpHabitAErr.message}`);
    process.exit(1);
  }
  console.log(`  XP event (habit) created: ${xpHabitA.id}`);

  // 2h. Journal entry
  const { data: journalA, error: journalAErr } = await supabaseA
    .from("journal_entries")
    .insert({
      entry_date: "2099-01-02",
      content: `${PREFIX}_Journal entry content.`,
      mood: 3,
      energy: 3,
      user_id: userAId,
    })
    .select()
    .single();
  if (journalAErr) {
    console.error(`  Failed to create journal entry: ${journalAErr.message}`);
    process.exit(1);
  }
  console.log(`  Journal entry created: ${journalA.id}`);

  // 2i. Finance account
  const { data: finAccountA, error: finAcctAErr } = await supabaseA
    .from("finance_accounts")
    .insert({ name: `${PREFIX}_Account`, type: "cash", starting_balance: 0, currency: "ILS", user_id: userAId })
    .select()
    .single();
  if (finAcctAErr) {
    console.error(`  Failed to create finance account: ${finAcctAErr.message}`);
    process.exit(1);
  }
  console.log(`  Finance account created: ${finAccountA.id}`);

  // 2j. Finance category (expense)
  const { data: finCatExpenseA, error: finCatExpErr } = await supabaseA
    .from("finance_categories")
    .insert({ name: `${PREFIX}_CatExpense`, type: "expense", user_id: userAId })
    .select()
    .single();
  if (finCatExpErr) {
    console.error(`  Failed to create finance expense category: ${finCatExpErr.message}`);
    process.exit(1);
  }
  console.log(`  Finance expense category created: ${finCatExpenseA.id}`);

  // 2k. Finance category (income)
  const { data: finCatIncomeA, error: finCatIncErr } = await supabaseA
    .from("finance_categories")
    .insert({ name: `${PREFIX}_CatIncome`, type: "income", user_id: userAId })
    .select()
    .single();
  if (finCatIncErr) {
    console.error(`  Failed to create finance income category: ${finCatIncErr.message}`);
    process.exit(1);
  }
  console.log(`  Finance income category created: ${finCatIncomeA.id}`);

  // 2l. Finance transaction
  const { data: finTxA, error: finTxAErr } = await supabaseA
    .from("finance_transactions")
    .insert({
      title: `${PREFIX}_Tx`,
      amount: 100,
      type: "expense",
      category_id: finCatExpenseA.id,
      account_id: finAccountA.id,
      transaction_date: "2099-01-15",
      user_id: userAId,
    })
    .select()
    .single();
  if (finTxAErr) {
    console.error(`  Failed to create finance transaction: ${finTxAErr.message}`);
    process.exit(1);
  }
  console.log(`  Finance transaction created: ${finTxA.id}`);

  // 2m. Finance budget
  const { data: finBudgetA, error: finBudgetAErr } = await supabaseA
    .from("finance_budgets")
    .insert({
      category_id: finCatExpenseA.id,
      month: "2099-02-01",
      amount: 500,
      user_id: userAId,
    })
    .select()
    .single();
  if (finBudgetAErr) {
    console.error(`  Failed to create finance budget: ${finBudgetAErr.message}`);
    process.exit(1);
  }
  console.log(`  Finance budget created: ${finBudgetA.id}`);

  // 2n. Body metrics
  const { data: bodyMetricsA, error: bodyMAErr } = await supabaseA
    .from("body_metrics")
    .insert({ entry_date: "2099-01-05", sleep_hours: 8, steps: 8000, energy: 4, user_id: userAId })
    .select()
    .single();
  if (bodyMAErr) {
    console.error(`  Failed to create body_metrics: ${bodyMAErr.message}`);
    process.exit(1);
  }
  console.log(`  Body metrics created: ${bodyMetricsA.id}`);

  // 2o. Mind metrics
  const { data: mindMetricsA, error: mindMAErr } = await supabaseA
    .from("mind_metrics")
    .insert({ entry_date: "2099-01-05", mood: 4, stress: 2, focus: 3, tags: ["work", "creative"], user_id: userAId })
    .select()
    .single();
  if (mindMAErr) {
    console.error(`  Failed to create mind_metrics: ${mindMAErr.message}`);
    process.exit(1);
  }
  console.log(`  Mind metrics created: ${mindMetricsA.id}`);

  // 2p. Goal
  const { data: goalA, error: goalAErr } = await supabaseA
    .from("goals")
    .insert({ title: `${PREFIX}_Goal`, realm_id: realmA.id, priority: "high", status: "active", user_id: userAId })
    .select()
    .single();
  if (goalAErr) {
    console.error(`  Failed to create goal: ${goalAErr.message}`);
    process.exit(1);
  }
  console.log(`  Goal created: ${goalA.id}`);

  // 2q. Goal milestone
  const { data: milestoneA, error: msAErr } = await supabaseA
    .from("goal_milestones")
    .insert({ goal_id: goalA.id, title: `${PREFIX}_Milestone`, sort_order: 1, user_id: userAId })
    .select()
    .single();
  if (msAErr) {
    console.error(`  Failed to create goal milestone: ${msAErr.message}`);
    process.exit(1);
  }
  console.log(`  Goal milestone created: ${milestoneA.id}`);

  // 2r. Goal link (project)
  const { data: goalLinkA, error: goalLinkAErr } = await supabaseA
    .from("goal_links")
    .insert({ goal_id: goalA.id, linked_type: "project", linked_id: projectA.id, user_id: userAId })
    .select()
    .single();
  if (goalLinkAErr) {
    console.error(`  Failed to create goal link: ${goalLinkAErr.message}`);
    process.exit(1);
  }
  console.log(`  Goal link created: ${goalLinkA.id}`);

  // 2s. Product learning event
  const { data: productLearningA, error: productLearningAErr } = await supabaseA
    .from("product_learning_events")
    .insert({
      user_id: userAId,
      event_type: "today_opened",
      surface: "today",
      viewport: "desktop",
      release_version: RUN_ID,
    })
    .select()
    .single();
  if (productLearningAErr) {
    console.error(`  Failed to create product learning event: ${productLearningAErr.message}`);
    process.exit(1);
  }
  console.log(`  Product learning event created: ${productLearningA.id}`);

  // 2t. Explicit beta feedback
  const { data: feedbackA, error: feedbackAErr } = await supabaseA
    .from("beta_feedback")
    .insert({
      user_id: userAId,
      page_path: "/settings",
      rating: 4,
      category: "idea",
      message: `${PREFIX}_Feedback`,
      browser_info: "viewport:desktop",
    })
    .select()
    .single();
  if (feedbackAErr) {
    console.error(`  Failed to create beta feedback: ${feedbackAErr.message}`);
    process.exit(1);
  }
  console.log(`  Beta feedback created: ${feedbackA.id}`);

  // 2u. Product improvement preference remains own-profile only
  const { error: preferenceAErr } = await supabaseA
    .from("profiles")
    .update({ allow_product_improvement_events: true })
    .eq("user_id", userAId);
  if (preferenceAErr) {
    console.error(`  Failed to update product improvement preference: ${preferenceAErr.message}`);
    process.exit(1);
  }
  console.log("  Product improvement preference updated");
  console.log("");

  const { error: spoofProductLearningErr } = await supabaseB.from("product_learning_events").insert({
    user_id: userAId,
    event_type: "today_opened",
    surface: "today",
    viewport: "desktop",
    release_version: RUN_ID,
  });
  if (spoofProductLearningErr) pass("User B cannot spoof User A product learning event owner");
  else fail("User B could spoof User A product learning event owner");

  const { error: spoofFeedbackErr } = await supabaseB.from("beta_feedback").insert({
    user_id: userAId,
    page_path: "/settings",
    rating: 3,
    category: "bug",
    message: `${PREFIX}_SpoofFeedback`,
    browser_info: "viewport:desktop",
  });
  if (spoofFeedbackErr) pass("User B cannot spoof User A feedback owner");
  else fail("User B could spoof User A feedback owner");

  const { data: preferenceBefore } = await supabaseA
    .from("profiles")
    .select("allow_product_improvement_events")
    .eq("user_id", userAId)
    .single();
  await supabaseB.from("profiles").update({ allow_product_improvement_events: false }).eq("user_id", userAId);
  const { data: preferenceAfter } = await supabaseA
    .from("profiles")
    .select("allow_product_improvement_events")
    .eq("user_id", userAId)
    .single();
  if (preferenceBefore?.allow_product_improvement_events === true && preferenceAfter?.allow_product_improvement_events === true) {
    pass("User B cannot change User A product improvement preference");
  } else {
    fail("User B could change User A product improvement preference");
  }
  console.log("");

  // ── 3. User B isolation: READ ──────────────────────────────────────────────

  console.log("--- User B cannot READ User A data ---");

  const readTests = [
    ["realm", "realms", realmA.id],
    ["project", "projects", projectA.id],
    ["task", "tasks", taskA.id],
    ["habit", "habits", habitA.id],
    ["habit_log", "habit_logs", habitLogA.id],
    ["xp_event", "xp_events", xpTaskA.id],
    ["journal entry", "journal_entries", journalA.id],
    ["finance account", "finance_accounts", finAccountA.id],
    ["finance category", "finance_categories", finCatExpenseA.id],
    ["finance transaction", "finance_transactions", finTxA.id],
    ["finance budget", "finance_budgets", finBudgetA.id],
    ["body metrics", "body_metrics", bodyMetricsA.id],
    ["mind metrics", "mind_metrics", mindMetricsA.id],
    ["goal", "goals", goalA.id],
    ["goal link", "goal_links", goalLinkA.id],
    ["product learning event", "product_learning_events", productLearningA.id],
    ["beta feedback", "beta_feedback", feedbackA.id],
  ];

  for (const [label, table, id] of readTests) {
    const { data, error } = await supabaseB.from(table).select("*").eq("id", id);
    if (error) {
      pass(`User B cannot read User A ${label} (error: ${error.code || error.status})`);
    } else if (!data || data.length === 0) {
      pass(`User B cannot read User A ${label} (empty)`);
    } else {
      fail(`User B could read User A ${label} - rows returned: ${data.length}`);
    }
  }

  // Profiles - special case (auto-created on signup, try reading User A's profile)
  const { data: profileRead, error: profileReadErr } = await supabaseB
    .from("profiles")
    .select("*")
    .eq("user_id", userAId);
  if (profileReadErr) {
    pass(`User B cannot read User A profile (error: ${profileReadErr.code || profileReadErr.status})`);
  } else if (!profileRead || profileRead.length === 0) {
    pass("User B cannot read User A profile (empty)");
  } else {
    fail("User B could read User A profile");
  }

  console.log("");

  // ── 4. User B isolation: UPDATE ────────────────────────────────────────────

  console.log("--- User B cannot UPDATE User A data ---");

  const updateTests = [
    ["realm", "realms", realmA.id, { name: `${PREFIX}_HackedRealm` }],
    ["habit", "habits", habitA.id, { title: `${PREFIX}_HackedHabit` }],
    ["task", "tasks", taskA.id, { title: `${PREFIX}_HackedTask` }],
    ["project", "projects", projectA.id, { title: `${PREFIX}_HackedProject` }],
    ["journal entry", "journal_entries", journalA.id, { content: `${PREFIX}_HackedJournal` }],
    ["finance account", "finance_accounts", finAccountA.id, { name: `${PREFIX}_HackedAcct` }],
    ["finance category", "finance_categories", finCatExpenseA.id, { name: `${PREFIX}_HackedCat` }],
    ["finance transaction", "finance_transactions", finTxA.id, { title: `${PREFIX}_HackedTx` }],
    ["finance budget", "finance_budgets", finBudgetA.id, { amount: 9999 }],
    ["body metrics", "body_metrics", bodyMetricsA.id, { sleep_hours: 99 }],
    ["mind metrics", "mind_metrics", mindMetricsA.id, { mood: 1 }],
    ["goal", "goals", goalA.id, { title: `${PREFIX}_HackedGoal` }],
    ["goal link", "goal_links", goalLinkA.id, { linked_type: "habit" }],
    ["product learning event", "product_learning_events", productLearningA.id, { viewport: "mobile" }],
    ["beta feedback", "beta_feedback", feedbackA.id, { message: `${PREFIX}_HackedFeedback` }],
  ];

  for (const [label, table, id, changes] of updateTests) {
    const { data: before } = await supabaseA.from(table).select("*").eq("id", id).single();
    await supabaseB.from(table).update(changes).eq("id", id);
    const { data: after } = await supabaseA.from(table).select("*").eq("id", id).single();

    // RLS blocks via using() check → 0 rows updated, no error, value unchanged
    // Or throws error if RLS check is with_check
    const changed =
      JSON.stringify(before) !== JSON.stringify(after);
    if (changed) {
      fail(`User B could update User A ${label} - value changed`);
    } else {
      pass(`User B cannot update User A ${label} (blocked)`);
    }
  }

  console.log("");

  // ── 5. User B isolation: DELETE ────────────────────────────────────────────

  console.log("--- User B cannot DELETE User A data ---");

  const deleteTests = [
    ["habit", "habits", habitA.id],
    ["task", "tasks", taskA.id],
    ["project", "projects", projectA.id],
    ["journal entry", "journal_entries", journalA.id],
    ["finance account", "finance_accounts", finAccountA.id],
    ["finance transaction", "finance_transactions", finTxA.id],
    ["body metrics", "body_metrics", bodyMetricsA.id],
    ["mind metrics", "mind_metrics", mindMetricsA.id],
    ["goal", "goals", goalA.id],
    ["goal milestone", "goal_milestones", milestoneA.id],
    ["goal link", "goal_links", goalLinkA.id],
    ["product learning event", "product_learning_events", productLearningA.id],
    ["beta feedback", "beta_feedback", feedbackA.id],
  ];

  for (const [label, table, id] of deleteTests) {
    const { data: before } = await supabaseA.from(table).select("id").eq("id", id).single();
    await supabaseB.from(table).delete().eq("id", id);
    const { data: after } = await supabaseA.from(table).select("id").eq("id", id).single();

    if (before && !after) {
      fail(`User B could delete User A ${label} - row vanished`);
    } else if (!before) {
      fail(`User B delete test for ${label} - row missing before test`);
    } else {
      pass(`User B cannot delete User A ${label} (blocked)`);
    }
  }

  // Special case: realm delete is universally blocked by "realms_no_delete_v1"
  const { data: realmBefore } = await supabaseA.from("realms").select("id").eq("id", realmA.id).single();
  await supabaseB.from("realms").delete().eq("id", realmA.id);
  const { data: realmAfter } = await supabaseA.from("realms").select("id").eq("id", realmA.id).single();
  if (realmBefore && realmAfter) {
    pass("User B cannot delete User A realm (blocked globally)");
  } else {
    fail("User B could delete User A realm - unexpected");
  }

  console.log("");

  // ── 6. User B isolation: MALICIOUS FK LINKING ──────────────────────────────

  console.log("--- User B cannot link FK to User A data ---");

  // 6a. Task with User B user_id but User A realm_id
  const { error: fkTaskRealm } = await supabaseB.from("tasks").insert({
    title: `${PREFIX}_FkTaskRealm`,
    realm_id: realmA.id,
    status: "todo",
    user_id: userBId,
  });
  if (fkTaskRealm) {
    pass("User B cannot link task to User A realm");
  } else {
    // Clean up if it somehow succeeded
    await supabaseB.from("tasks").delete().ilike("title", `${PREFIX}_FkTaskRealm`);
    fail("User B could link task to User A realm");
  }

  // 6b. Task with User B user_id but User A project_id
  const { error: fkTaskProj } = await supabaseB.from("tasks").insert({
    title: `${PREFIX}_FkTaskProj`,
    project_id: projectA.id,
    status: "todo",
    user_id: userBId,
  });
  if (fkTaskProj) {
    pass("User B cannot link task to User A project");
  } else {
    await supabaseB.from("tasks").delete().ilike("title", `${PREFIX}_FkTaskProj`);
    fail("User B could link task to User A project");
  }

  // 6c. Project with User B user_id but User A realm_id
  const { error: fkProjRealm } = await supabaseB.from("projects").insert({
    title: `${PREFIX}_FkProjRealm`,
    realm_id: realmA.id,
    status: "active",
    user_id: userBId,
  });
  if (fkProjRealm) {
    pass("User B cannot link project to User A realm");
  } else {
    await supabaseB.from("projects").delete().ilike("title", `${PREFIX}_FkProjRealm`);
    fail("User B could link project to User A realm");
  }

  // 6d. Habit with User B user_id but User A realm_id
  const { error: fkHabitRealm } = await supabaseB.from("habits").insert({
    title: `${PREFIX}_FkHabitRealm`,
    realm_id: realmA.id,
    frequency: "daily",
    user_id: userBId,
  });
  if (fkHabitRealm) {
    pass("User B cannot link habit to User A realm");
  } else {
    await supabaseB.from("habits").delete().ilike("title", `${PREFIX}_FkHabitRealm`);
    fail("User B could link habit to User A realm");
  }

  // 6e. Habit log with User B user_id but User A habit_id
  const { error: fkHlHabit } = await supabaseB.from("habit_logs").insert({
    habit_id: habitA.id,
    completed_date: "2099-01-03",
    user_id: userBId,
  });
  if (fkHlHabit) {
    pass("User B cannot link habit_log to User A habit");
  } else {
    await supabaseB.from("habit_logs").delete().eq("habit_id", habitA.id).gte("completed_date", "2099-01-03");
    fail("User B could link habit_log to User A habit");
  }

  // 6f. XP event with User B user_id but User A task source_id
  const { error: fkXpTask } = await supabaseB.from("xp_events").insert({
    source_type: "task",
    source_id: taskA.id,
    amount: 10,
    user_id: userBId,
  });
  if (fkXpTask) {
    pass("User B cannot link xp_event to User A task");
  } else {
    await supabaseB.from("xp_events").delete().eq("source_id", taskA.id);
    fail("User B could link xp_event to User A task");
  }

  // 6g. XP event with User B user_id but User A habit_log source_id
  const { error: fkXpHl } = await supabaseB.from("xp_events").insert({
    source_type: "habit",
    source_id: habitLogA.id,
    amount: 5,
    user_id: userBId,
  });
  if (fkXpHl) {
    pass("User B cannot link xp_event to User A habit_log");
  } else {
    await supabaseB.from("xp_events").delete().eq("source_id", habitLogA.id);
    fail("User B could link xp_event to User A habit_log");
  }

  // 6h. Finance transaction with User B user_id but User A account_id
  const { error: fkFinTxAcct } = await supabaseB.from("finance_transactions").insert({
    title: `${PREFIX}_FkTxAcct`,
    amount: 50,
    type: "expense",
    account_id: finAccountA.id,
    transaction_date: "2099-01-16",
    user_id: userBId,
  });
  if (fkFinTxAcct) {
    pass("User B cannot link finance transaction to User A account");
  } else {
    await supabaseB.from("finance_transactions").delete().ilike("title", `${PREFIX}_FkTxAcct`);
    fail("User B could link finance transaction to User A account");
  }

  // 6i. Finance transaction with User B user_id but User A category_id
  const { error: fkFinTxCat } = await supabaseB.from("finance_transactions").insert({
    title: `${PREFIX}_FkTxCat`,
    amount: 50,
    type: "expense",
    category_id: finCatExpenseA.id,
    transaction_date: "2099-01-17",
    user_id: userBId,
  });
  if (fkFinTxCat) {
    pass("User B cannot link finance transaction to User A category");
  } else {
    await supabaseB.from("finance_transactions").delete().ilike("title", `${PREFIX}_FkTxCat`);
    fail("User B could link finance transaction to User A category");
  }

  // 6j. Finance budget with User B user_id but User A category_id
  const { error: fkFinBudCat } = await supabaseB.from("finance_budgets").insert({
    category_id: finCatExpenseA.id,
    month: "2099-03-01",
    amount: 300,
    user_id: userBId,
  });

  // 6k. Goal with User B user_id but User A realm_id
  const { error: fkGoalRealm } = await supabaseB.from("goals").insert({
    title: `${PREFIX}_FkGoalRealm`,
    realm_id: realmA.id,
    status: "active",
    user_id: userBId,
  });
  if (fkGoalRealm) {
    pass("User B cannot link goal to User A realm");
  } else {
    await supabaseB.from("goals").delete().ilike("title", `${PREFIX}_FkGoalRealm`);
    fail("User B could link goal to User A realm");
  }
  if (fkFinBudCat) {
    pass("User B cannot link finance budget to User A category");
  } else {
    await supabaseB.from("finance_budgets").delete().eq("category_id", finCatExpenseA.id).eq("month", "2099-03-01");
    fail("User B could link finance budget to User A category");
  }

  // 6l. Goal link with User B user_id but User A goal_id
  const { error: fkGlGoal } = await supabaseB.from("goal_links").insert({
    goal_id: goalA.id,
    linked_type: "project",
    linked_id: projectA.id,
    user_id: userBId,
  });
  if (fkGlGoal) {
    pass("User B cannot link goal_link to User A goal");
  } else {
    await supabaseB.from("goal_links").delete().eq("goal_id", goalA.id);
    fail("User B could link goal_link to User A goal");
  }

  console.log("");

  // ── 7. Positive controls: User B can CRUD own data ─────────────────────────

  console.log("--- Positive controls: User B can use own data ---");

  const { data: realmB, error: realmBErr } = await supabaseB
    .from("realms")
    .insert({ name: `${PREFIX}_Realm_B`, color: "#10b981", icon: "\u{1F3AF}", user_id: userBId })
    .select()
    .single();
  if (realmBErr) {
    fail(`User B could not create own realm: ${realmBErr.message}`);
  } else {
    pass("User B can create own realm");
  }

  const { data: taskB, error: taskBErr } = await supabaseB
    .from("tasks")
    .insert({ title: `${PREFIX}_Task_B`, realm_id: realmB.id, status: "todo", user_id: userBId })
    .select()
    .single();
  if (taskBErr) {
    fail(`User B could not create own task: ${taskBErr.message}`);
  } else {
    pass("User B can create own task");
  }

  const { data: journalB, error: journalBErr } = await supabaseB
    .from("journal_entries")
    .insert({ entry_date: "2099-01-10", content: `${PREFIX}_Journal_B`, mood: 4, energy: 4, user_id: userBId })
    .select()
    .single();
  if (journalBErr) {
    fail(`User B could not create own journal entry: ${journalBErr.message}`);
  } else {
    pass("User B can create own journal entry");
  }

  const { data: productLearningB, error: productLearningBErr } = await supabaseB
    .from("product_learning_events")
    .insert({ user_id: userBId, event_type: "today_opened", surface: "today", viewport: "desktop", release_version: RUN_ID })
    .select()
    .single();
  if (productLearningBErr) {
    fail(`User B could not create own product learning event: ${productLearningBErr.message}`);
  } else {
    pass("User B can create own product learning event");
  }

  const { data: feedbackB, error: feedbackBErr } = await supabaseB
    .from("beta_feedback")
    .insert({ user_id: userBId, page_path: "/settings", rating: 5, category: "praise", message: `${PREFIX}_Feedback_B`, browser_info: "viewport:desktop" })
    .select()
    .single();
  if (feedbackBErr) {
    fail(`User B could not submit own feedback: ${feedbackBErr.message}`);
  } else {
    pass("User B can submit own feedback");
  }

  const { data: finCatB, error: finCatBErr } = await supabaseB
    .from("finance_categories")
    .insert({ name: `${PREFIX}_Cat_B`, type: "expense", user_id: userBId })
    .select()
    .single();
  if (finCatBErr) {
    fail(`User B could not create own finance category: ${finCatBErr.message}`);
  } else {
    pass("User B can create own finance category");
  }

  const { data: finTxB, error: finTxBErr } = await supabaseB
    .from("finance_transactions")
    .insert({
      title: `${PREFIX}_Tx_B`,
      amount: 25,
      type: "expense",
      category_id: finCatB.id,
      transaction_date: "2099-01-20",
      user_id: userBId,
    })
    .select()
    .single();
  if (finTxBErr) {
    fail(`User B could not create own finance transaction: ${finTxBErr.message}`);
  } else {
    pass("User B can create own finance transaction");
  }

  // 7g. Goal + goal link for User B
  let goalB, goalLinkB;
  const goalBResult = await supabaseB
    .from("goals")
    .insert({ title: `${PREFIX}_Goal_B`, realm_id: realmB.id, priority: "medium", status: "active", user_id: userBId })
    .select()
    .single();
  goalB = goalBResult.data;
  if (goalBResult.error) {
    fail(`User B could not create own goal: ${goalBResult.error.message}`);
  } else {
    pass("User B can create own goal");

    const goalLinkBResult = await supabaseB
      .from("goal_links")
      .insert({ goal_id: goalB.id, linked_type: "task", linked_id: taskB.id, user_id: userBId })
      .select()
      .single();
    goalLinkB = goalLinkBResult.data;
    if (goalLinkBResult.error) {
      fail(`User B could not create own goal link: ${goalLinkBResult.error.message}`);
    } else {
      pass("User B can create own goal link");
    }
  }

  console.log("");

  // ── 8. User A can still read own data ──────────────────────────────────────

  console.log("--- User A can still read own data ---");

  const selfReadTests = [
    ["realm", "realms", realmA.id],
    ["project", "projects", projectA.id],
    ["task", "tasks", taskA.id],
    ["habit", "habits", habitA.id],
    ["habit_log", "habit_logs", habitLogA.id],
    ["xp_event", "xp_events", xpTaskA.id],
    ["journal entry", "journal_entries", journalA.id],
    ["finance account", "finance_accounts", finAccountA.id],
    ["finance category", "finance_categories", finCatExpenseA.id],
    ["finance transaction", "finance_transactions", finTxA.id],
    ["finance budget", "finance_budgets", finBudgetA.id],
    ["body metrics", "body_metrics", bodyMetricsA.id],
    ["mind metrics", "mind_metrics", mindMetricsA.id],
    ["goal", "goals", goalA.id],
    ["goal link", "goal_links", goalLinkA.id],
    ["product learning event", "product_learning_events", productLearningA.id],
    ["beta feedback", "beta_feedback", feedbackA.id],
  ];

  for (const [label, table, id] of selfReadTests) {
    const { data, error } = await supabaseA.from(table).select("id").eq("id", id).single();
    if (error || !data) {
      fail(`User A cannot read own ${label}: ${error?.message || "no data"}`);
    } else {
      pass(`User A can read own ${label}`);
    }
  }

  console.log("");

  // ── 9. Cleanup ─────────────────────────────────────────────────────────────

  console.log("--- Cleanup ---");

  // User A cleanup (respect FK order)
  const cleanupA = [
    ["xp_events", "id", xpTaskA.id],
    ["xp_events", "id", xpHabitA.id],
    ["habit_logs", "id", habitLogA.id],
    ["habits", "id", habitA.id],
    ["tasks", "id", taskA.id],
    ["projects", "id", projectA.id],
    ["finance_transactions", "id", finTxA.id],
    ["finance_budgets", "id", finBudgetA.id],
    ["finance_categories", "id", finCatExpenseA.id],
    ["finance_categories", "id", finCatIncomeA.id],
    ["finance_accounts", "id", finAccountA.id],
    ["journal_entries", "id", journalA.id],
    ["body_metrics", "id", bodyMetricsA.id],
    ["product_learning_events", "id", productLearningA.id],
    ["beta_feedback", "id", feedbackA.id],
    ["goal_links", "id", goalLinkA.id],
    ["goal_milestones", "id", milestoneA.id],
    ["goals", "id", goalA.id],
    ["mind_metrics", "id", mindMetricsA.id],
    ["realms", "id", realmA.id],
  ];

  for (const [table, column, idVal] of cleanupA) {
    const { error } = await supabaseA.from(table).delete().eq(column, idVal);
    if (error) {
      console.warn(`  Warning: cleanup of ${table}.${idVal} failed: ${error.message}`);
    }
  }

  // User B cleanup
  const cleanupB = [
    ["finance_transactions", "id", finTxB?.id],
    ["finance_categories", "id", finCatB?.id],
    ["product_learning_events", "id", productLearningB?.id],
    ["beta_feedback", "id", feedbackB?.id],
    ["journal_entries", "id", journalB?.id],
    ["goal_links", "id", goalLinkB?.id],
    ["goals", "id", goalB?.id],
    ["tasks", "id", taskB?.id],
    ["realms", "id", realmB?.id],
  ];

  for (const [table, column, idVal] of cleanupB) {
    if (!idVal) continue;
    const { error } = await supabaseB.from(table).delete().eq(column, idVal);
    if (error) {
      console.warn(`  Warning: cleanup of ${table}.${idVal} failed: ${error.message}`);
    }
  }

  console.log("  Cleanup complete.");
  console.log("");

  // ── 10. Report ─────────────────────────────────────────────────────────────

  const total = passed + failed;
  console.log("=== Summary ===");
  console.log(`  Passed: ${passed} / ${total}`);
  console.log(`  Failed: ${failed} / ${total}`);
  console.log("");

  if (failed === 0) {
    console.log("RLS smoke test passed");
    console.log("");
    process.exit(0);
  } else {
    console.log("RLS smoke test failed");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
    console.log("");
    process.exit(1);
  }
}

class ExitSignal extends Error {
  constructor(code) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

const realProcessExit = process.exit.bind(process);
process.exit = (code = 0) => {
  throw new ExitSignal(code);
};

main()
  .then(async () => {
    await cleanupSyntheticUsers();
    realProcessExit(0);
  })
  .catch(async (err) => {
    await cleanupSyntheticUsers();
    if (err instanceof ExitSignal) realProcessExit(err.code);
    console.error("Unhandled error:", err);
    realProcessExit(1);
  });
