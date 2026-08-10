#!/usr/bin/env node

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
    if (eqIdx > 0) vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

const env = { ...loadEnv(resolve(__dirname, "..", ".env.test.local")), ...process.env };
const BASE = env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ACK = env.LIFE_PULSE_PROMPT7_PROD_WRITE_ACK === "I_UNDERSTAND_THIS_CREATES_AND_DELETES_SYNTHETIC_PRODUCTION_USERS";

const EXPECTED_BASE = "https://lifepulse-sand.vercel.app";
const RUN_ID = `prompt7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = `Prompt7-${RUN_ID}-Password!`;

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function assert(condition, message) {
  if (!condition) fail(message);
  console.log(`  PASS ${message}`);
}

function requireConfig() {
  if (BASE !== EXPECTED_BASE) fail(`Refusing to run against unexpected target: ${BASE}`, 2);
  if (!ACK) fail("Set LIFE_PULSE_PROMPT7_PROD_WRITE_ACK=I_UNDERSTAND_THIS_CREATES_AND_DELETES_SYNTHETIC_PRODUCTION_USERS to run this guarded verifier.", 2);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) fail("Missing Supabase URL, anon key, or SUPABASE_SERVICE_ROLE_KEY in local script environment.", 2);
}

async function createSyntheticUser(admin, email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { synthetic_run_id: RUN_ID } });
  if (error || !data.user?.id) throw new Error(`Could not create synthetic user: ${error?.message ?? "missing user"}`);
  return data.user.id;
}

async function signedClient(email) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Synthetic sign-in failed: ${error.message}`);
  return client;
}

async function setPermissions(client, userId, patch) {
  const { error } = await client.from("nextron_context_preferences").upsert({
    user_id: userId,
    permission_version: 6,
    allow_profile: true,
    allow_today: true,
    allow_tasks: true,
    allow_task_actions: false,
    allow_goal_actions: false,
    allow_habit_actions: false,
    allow_project_actions: false,
    allow_habits: true,
    allow_results: true,
    allow_goals: true,
    allow_projects: true,
    allow_knowledge: false,
    allow_drive: false,
    allow_calendar: false,
    allow_journal: false,
    allow_evening_shutdown: false,
    allow_weekly_review: false,
    ...patch,
  });
  if (error) throw new Error(`Permission setup failed: ${error.message}`);
}

async function createProposal(client, actionType, payload, title = actionType) {
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data, error } = await client.rpc("nextron_create_action_proposal", {
    p_conversation_id: null,
    p_action_type: actionType,
    p_validated_payload: payload,
    p_preview_payload: { title, description: "Synthetic Prompt 7 production verifier", preview: { heading: title, subheading: title, fields: [], approvalLabel: "Approve synthetic verifier action" } },
    p_risk_level: "low",
    p_expires_at: expiresAt,
  });
  if (error || !data?.id) throw new Error(`Proposal failed for ${actionType}: ${error?.message ?? "missing proposal"}`);
  return data;
}

async function approve(client, proposalId) {
  const { data, error } = await client.rpc("nextron_execute_action", { p_proposal_id: proposalId });
  if (error || !data?.id) throw new Error(`Approval failed: ${error?.message ?? "missing proposal"}`);
  return data;
}

async function count(admin, table, userId) {
  const { count: total, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error(`Count failed for ${table}: ${error.message}`);
  return total ?? 0;
}

async function main() {
  requireConfig();
  console.log("\n=== Prompt 7 Disposable Production Verifier ===");
  console.log(`Target: ${BASE}`);
  console.log(`Run: ${RUN_ID}`);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailA = `lp-${RUN_ID}@example.invalid`;
  const emailB = `lp-${RUN_ID}-b@example.invalid`;
  let userA = null;
  let userB = null;

  try {
    userA = await createSyntheticUser(admin, emailA);
    userB = await createSyntheticUser(admin, emailB);
    const clientA = await signedClient(emailA);
    const clientB = await signedClient(emailB);
    await setPermissions(clientA, userA, { allow_task_actions: true, allow_goal_actions: true, allow_habit_actions: true, allow_project_actions: true });
    await setPermissions(clientB, userB, { allow_task_actions: true, allow_goal_actions: true, allow_habit_actions: true, allow_project_actions: true });

    const suffix = RUN_ID;
    const goalTitle = `P7 Goal ${suffix}`;
    const projectTitle = `P7 Project ${suffix}`;
    const habitTitle = `P7 Habit ${suffix}`;
    const taskTitle = `P7 Task ${suffix}`;

    const goalProposal = await createProposal(clientA, "life_pulse.goal.create", { title: goalTitle, priority: "medium", targetDate: null }, "Create synthetic goal");
    const goalResult = await approve(clientA, goalProposal.id);
    assert(goalResult.status === "completed", "Goal create approved and completed");
    const replayGoal = await approve(clientA, goalProposal.id);
    assert(replayGoal.status === "completed", "Goal create replay returned terminal state");

    const projectProposal = await createProposal(clientA, "life_pulse.project.create", { title: projectTitle, deadline: null }, "Create synthetic project");
    assert((await approve(clientA, projectProposal.id)).status === "completed", "Project create approved and completed");

    const habitProposal = await createProposal(clientA, "life_pulse.habit.create", { title: habitTitle, frequency: "daily", timesPerWeek: null }, "Create synthetic habit");
    assert((await approve(clientA, habitProposal.id)).status === "completed", "Habit create approved and completed with nullable realm");

    const taskProposal = await createProposal(clientA, "life_pulse.task.create", { title: taskTitle, dueDate: null, priority: "medium" }, "Create synthetic task");
    assert((await approve(clientA, taskProposal.id)).status === "completed", "Task create regression approved and completed");

    const { data: goal } = await clientA.from("goals").select("id,title,status,priority,target_date").eq("title", goalTitle).single();
    const { data: project } = await clientA.from("projects").select("id,title,status,deadline").eq("title", projectTitle).single();
    const { data: habit } = await clientA.from("habits").select("id,title,frequency,times_per_week").eq("title", habitTitle).single();
    const { data: task } = await clientA.from("tasks").select("id,title,status,due_date").eq("title", taskTitle).single();
    assert(goal?.id && project?.id && habit?.id && task?.id, "Synthetic entities persisted and are owner-readable");

    const goalUpdate = await createProposal(clientA, "life_pulse.goal.update", { goalId: goal.id, beforeTitle: goal.title, beforeStatus: goal.status, beforePriority: goal.priority, beforeTargetDate: goal.target_date, priority: "high", targetDate: null }, "Update synthetic goal");
    assert((await approve(clientA, goalUpdate.id)).status === "completed", "Goal update approved and persisted");
    const projectUpdate = await createProposal(clientA, "life_pulse.project.update", { projectId: project.id, beforeTitle: project.title, beforeStatus: project.status, beforeDeadline: project.deadline, status: "paused", deadline: null }, "Update synthetic project");
    assert((await approve(clientA, projectUpdate.id)).status === "completed", "Project update approved and persisted");
    const habitUpdate = await createProposal(clientA, "life_pulse.habit.update", { habitId: habit.id, beforeTitle: habit.title, beforeFrequency: habit.frequency, beforeTimesPerWeek: habit.times_per_week, frequency: "times_per_week", timesPerWeek: 3 }, "Update synthetic habit");
    assert((await approve(clientA, habitUpdate.id)).status === "completed", "Habit update approved and persisted");

    const taskMove = await createProposal(clientA, "life_pulse.task.update", { taskId: task.id, beforeTitle: task.title, beforeStatus: task.status, beforeDueDate: task.due_date, projectId: project.id, projectTitle: project.title, projectStatus: "paused" }, "Move synthetic task");
    assert((await approve(clientA, taskMove.id)).status === "completed", "Task -> Project assignment approved and persisted");

    for (const linked of [
      { linkedType: "project", linkedId: project.id, linkedTitle: project.title, linkedStatus: "paused" },
      { linkedType: "habit", linkedId: habit.id, linkedTitle: habit.title, linkedStatus: "times_per_week" },
      { linkedType: "task", linkedId: task.id, linkedTitle: task.title, linkedStatus: task.status },
    ]) {
      const linkPayload = { goalId: goal.id, goalTitle: goal.title, goalStatus: goal.status, ...linked };
      const link = await createProposal(clientA, "life_pulse.goal.link", linkPayload, `Link ${linked.linkedType}`);
      assert((await approve(clientA, link.id)).status === "completed", `Goal ${linked.linkedType} link approved`);
      const replay = await createProposal(clientA, "life_pulse.goal.link", linkPayload, `Replay link ${linked.linkedType}`);
      assert((await approve(clientA, replay.id)).status === "completed", `Duplicate Goal ${linked.linkedType} link is exact-once safe`);
      const unlink = await createProposal(clientA, "life_pulse.goal.unlink", linkPayload, `Unlink ${linked.linkedType}`);
      assert((await approve(clientA, unlink.id)).status === "completed", `Goal ${linked.linkedType} unlink approved without entity delete`);
    }

    await setPermissions(clientA, userA, { allow_goal_actions: true, allow_project_actions: false });
    const blocked = await createProposal(clientA, "life_pulse.goal.link", { goalId: goal.id, goalTitle: goal.title, goalStatus: goal.status, linkedType: "project", linkedId: project.id, linkedTitle: project.title, linkedStatus: "paused" }, "Permission blocked link");
    const blockedResult = await approve(clientA, blocked.id);
    assert(blockedResult.status === "failed", "Permission revocation before execution blocks relationship mutation");

    const { data: bGoal } = await clientB.from("goals").insert({ user_id: userB, title: `P7 B Goal ${suffix}`, priority: "medium", status: "active" }).select("id").single();
    const { data: bReadFromA } = await clientA.from("goals").select("id").eq("id", bGoal.id);
    assert(Array.isArray(bReadFromA) && bReadFromA.length === 0, "Two-user isolation blocks cross-user Goal reads");

    const { count: linkCount } = await clientA.from("goal_links").select("id", { count: "exact", head: true }).eq("user_id", userA);
    assert((linkCount ?? 0) === 0, "Relationship unlink cleanup left no synthetic links");
  } finally {
    if (userA) await admin.auth.admin.deleteUser(userA).catch(() => undefined);
    if (userB) await admin.auth.admin.deleteUser(userB).catch(() => undefined);
  }

  if (userA) {
    const tables = ["profiles", "nextron_onboarding_states", "nextron_conversations", "nextron_messages", "nextron_action_proposals", "nextron_context_preferences", "nextron_memories", "goals", "projects", "tasks", "habits", "goal_links"];
    for (const table of tables) {
      const remaining = await count(admin, table, userA);
      assert(remaining === 0, `Zero residue for ${table}`);
    }
  }

  console.log("Prompt 7 disposable production verifier passed with zero residue.");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
