#!/usr/bin/env node

// Life Pulse RLS Smoke Test
// Uses anon key only. No service role.
// Tests that User A and User B data are fully isolated.

import { createClient } from "@supabase/supabase-js";

// ─── Env vars ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL_A = process.env.RLS_TEST_USER_A_EMAIL;
const PASSWORD_A = process.env.RLS_TEST_USER_A_PASSWORD;
const EMAIL_B = process.env.RLS_TEST_USER_B_EMAIL;
const PASSWORD_B = process.env.RLS_TEST_USER_B_PASSWORD;

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!EMAIL_A) missing.push("RLS_TEST_USER_A_EMAIL");
if (!PASSWORD_A) missing.push("RLS_TEST_USER_A_PASSWORD");
if (!EMAIL_B) missing.push("RLS_TEST_USER_B_EMAIL");
if (!PASSWORD_B) missing.push("RLS_TEST_USER_B_PASSWORD");

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

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("");
  console.error("SAFETY: SUPABASE_SERVICE_ROLE_KEY is set. This test must use");
  console.error("the anon key only. Unset it and try again.");
  console.error("");
  process.exit(1);
}

console.error("Using anon key only (safe).");

// ─── Timestamp prefix for unique test records ─────────────────────────────────

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const PREFIX = `RLS_TEST_${TS}`;

// ─── Test state ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function pass(msg) {
  passed++;
  console.log(`  \u2705 ${msg}`);
}

function fail(msg) {
  failed++;
  failures.push(msg);
  console.log(`  \u274c ${msg}`);
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
    ["journal_entries", "id", journalB?.id],
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

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
