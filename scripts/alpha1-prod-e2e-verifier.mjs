#!/usr/bin/env node

import { chromium, expect } from "@playwright/test";
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

const env = { ...loadEnv(resolve(__dirname, "..", ".env.local")), ...loadEnv(resolve(__dirname, "..", ".env.test.local")), ...process.env };
const EXPECTED_BASE = "https://lifepulse-sand.vercel.app";
const ACK_VALUE = "I_UNDERSTAND_THIS_CREATES_AND_DELETES_SYNTHETIC_PRODUCTION_USERS";
const BASE = env.LIFE_PULSE_PROD_BASE_URL || EXPECTED_BASE;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const ADMIN_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const EXPECTED_SUPABASE_URL = env.LIFE_PULSE_ALPHA1_EXPECTED_SUPABASE_URL;
const ACK = env.LIFE_PULSE_ALPHA1_PROD_WRITE_ACK === ACK_VALUE;
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const CLEANUP_RUN_ID = process.argv.find((arg) => arg.startsWith("--cleanup-run-id="))?.split("=")[1] ?? null;
const VERIFY_DELETED_USER_ID = process.argv.find((arg) => arg.startsWith("--verify-deleted-user-id="))?.split("=")[1] ?? null;
const RUN_ID = CLEANUP_RUN_ID || `alpha1-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
const EMAIL = `lifepulse-alpha1+${RUN_ID}@example.invalid`;
const PASSWORD = `Alpha1-${RUN_ID}-Password!`;
const OVERFLOW_TOLERANCE_PX = 2;

const USER_TABLES = [
  "profiles",
  "nextron_onboarding",
  "nextron_conversations",
  "nextron_messages",
  "nextron_action_proposals",
  "nextron_context_preferences",
  "nextron_memories",
  "goals",
  "goal_milestones",
  "projects",
  "tasks",
  "habits",
  "habit_logs",
  "goal_links",
  "knowledge_items",
  "knowledge_collections",
  "knowledge_chunks",
  "metric_definitions",
  "metric_entries",
  "body_profiles",
  "realms",
  "xp_events",
  "journal_entries",
];

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function pass(message) {
  console.log(`  PASS ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  pass(message);
}

function assertFreshProfile(condition, message) {
  if (!condition) throw new Error(`FAIL Fresh-user profile contract: ${message}`);
  pass(`Fresh-user profile contract: ${message}`);
}

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function requireConfig() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  if (!ADMIN_KEY) missing.push("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  if (!EXPECTED_SUPABASE_URL) missing.push("LIFE_PULSE_ALPHA1_EXPECTED_SUPABASE_URL");
  if (!ACK) missing.push(`LIFE_PULSE_ALPHA1_PROD_WRITE_ACK=${ACK_VALUE}`);
  if (missing.length > 0) fail(`Missing required local-only Alpha 1 production verifier env: ${missing.join(", ")}`, 2);
  if (BASE !== EXPECTED_BASE) fail(`Refusing unexpected Life Pulse target: ${BASE}`, 2);
  if (SUPABASE_URL !== EXPECTED_SUPABASE_URL) fail("Refusing unexpected Supabase production project URL.", 2);
  const host = new URL(SUPABASE_URL).hostname;
  if (!host.endsWith(".supabase.co")) fail("Refusing non-Supabase production target.", 2);
}

function adminClient() {
  return createClient(SUPABASE_URL, ADMIN_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function validateAdmin(admin) {
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error(`Admin credential validation failed: ${error.message}`);
  pass("Admin credential authenticated without printing secrets");
}

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Auth user lookup failed: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Auth user lookup exceeded safe page bound.");
}

async function createSyntheticUser(admin) {
  const existing = await findAuthUserByEmail(admin, EMAIL);
  if (existing) throw new Error(`Synthetic user already exists for run ${RUN_ID}; run cleanup-only first.`);
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { synthetic_run_id: RUN_ID, synthetic_release_gate: "alpha1" } });
  if (error || !data.user?.id) throw new Error(`Could not create synthetic user: ${error?.message ?? "missing user"}`);
  return data.user.id;
}

async function signedClient() {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.user) throw new Error(`Synthetic sign-in failed: ${error?.message ?? "missing user"}`);
  return { client, userId: data.user.id };
}

async function countTable(admin, table, userId) {
  const { count, error } = await admin.from(table).select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error(`Count failed for ${table}: ${safeSupabaseError(error)}`);
  return count ?? 0;
}

function safeSupabaseError(error) {
  if (!error || typeof error !== "object") return "unknown error";
  const parts = [];
  if ("status" in error && error.status) parts.push(`status=${error.status}`);
  if ("code" in error && error.code) parts.push(`code=${error.code}`);
  if ("message" in error && error.message) parts.push(`message=${String(error.message).slice(0, 240)}`);
  if ("details" in error && error.details) parts.push(`details=${String(error.details).slice(0, 240)}`);
  if ("hint" in error && error.hint) parts.push(`hint=${String(error.hint).slice(0, 240)}`);
  if ("name" in error && error.name) parts.push(`name=${error.name}`);
  if ("cause" in error && error.cause && typeof error.cause === "object") {
    const cause = error.cause;
    if ("code" in cause && cause.code) parts.push(`networkCode=${cause.code}`);
    if ("message" in cause && cause.message) parts.push(`networkMessage=${String(cause.message).slice(0, 240)}`);
  }
  return parts.length > 0 ? parts.join(" ") : "no safe diagnostics available";
}

async function counts(admin, userId, tables = USER_TABLES) {
  const result = {};
  for (const table of tables) result[table] = await countTable(admin, table, userId);
  return result;
}

async function onboardingCompletionState(admin, userId) {
  const { data: profile, error: profileError } = await admin.from("profiles").select("onboarding_completed").eq("user_id", userId).maybeSingle();
  if (profileError) throw new Error(`Post-setup profile state read failed: ${safeSupabaseError(profileError)}`);
  const { data: onboarding, error: onboardingError } = await admin.from("nextron_onboarding").select("status").eq("user_id", userId).maybeSingle();
  if (onboardingError) throw new Error(`Post-setup onboarding state read failed: ${safeSupabaseError(onboardingError)}`);
  return { onboardingCompleted: profile?.onboarding_completed === true, onboardingStatus: typeof onboarding?.status === "string" ? onboarding.status : null };
}

function printCounts(label, values) {
  console.log(`  COUNTS ${label}: ${Object.entries(values).map(([key, value]) => `${key}=${value}`).join(" ")}`);
}

function pathname(page) {
  return new URL(page.url()).pathname;
}

async function cleanup(admin, userId) {
  if (!userId) return null;
  const before = await counts(admin, userId);
  printCounts("before cleanup", before);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) throw new Error(`Auth user delete failed: ${safeSupabaseError(deleteError)}`);
  const remaining = await counts(admin, userId);
  printCounts("cleanup", remaining);
  for (const [table, value] of Object.entries(remaining)) assert(value === 0, `Zero residue for ${table}`);
  const authUser = await admin.auth.admin.getUserById(userId).catch(() => ({ data: null, error: new Error("missing") }));
  assert(Boolean(authUser.error || !authUser.data?.user), "Zero residue for auth user");
  return remaining;
}

async function cleanupOnly(admin) {
  if (!CLEANUP_RUN_ID || !/^alpha1-[A-Za-z0-9-]{10,80}$/.test(CLEANUP_RUN_ID)) throw new Error("Cleanup-only requires --cleanup-run-id=alpha1-...");
  const user = await findAuthUserByEmail(admin, EMAIL);
  if (!user) {
    throw new Error("Cleanup-only found no matching synthetic auth user. Auth user count is 0, but table zero-residue cannot be proven without the deleted user_id.");
  }
  pass("Cleanup-only found matching synthetic auth user");
  await cleanup(admin, user.id);
}

async function verifyDeletedUserResidue(admin) {
  if (!validUuid(VERIFY_DELETED_USER_ID)) throw new Error("Deleted-user verification requires --verify-deleted-user-id=<uuid>");
  const authUser = await admin.auth.admin.getUserById(VERIFY_DELETED_USER_ID).catch((error) => ({ data: null, error }));
  const authCount = authUser.error || !authUser.data?.user ? 0 : 1;
  console.log(`  COUNT auth_user=${authCount}`);
  assert(authCount === 0, "Deleted synthetic auth user does not exist");

  const remaining = await counts(admin, VERIFY_DELETED_USER_ID);
  printCounts("deleted-user residue", remaining);
  for (const [table, value] of Object.entries(remaining)) assert(value === 0, `Zero residue for ${table}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ body: document.body.scrollWidth, doc: document.documentElement.scrollWidth, inner: window.innerWidth }));
  const max = metrics.inner + OVERFLOW_TOLERANCE_PX;
  assert(metrics.body <= max && metrics.doc <= max, `${label} has no horizontal overflow`);
}

async function assertNextronHumanHierarchy(page, label) {
  await expect(page.getByRole("heading", { name: "NEXTRON" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Talk to NEXTRON")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#nextron-question")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Send to NEXTRON" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "What should I focus on today?" }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "What needs my attention?" }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "What can you help me with?" }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator("summary").filter({ hasText: "More intelligence" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("NEXTRON Signals")).toBeHidden({ timeout: 30000 });
  await assertNoOverflow(page, label);
}

async function nonPendingNextronAssistantCount(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll("article")).filter((article) => article.textContent?.includes("NEXTRON") && !article.hasAttribute("data-nextron-pending-turn")).length);
}

async function nextronSendState(page) {
  const questionPresent = await page.locator("#nextron-question").evaluate((node) => node instanceof HTMLTextAreaElement && node.value.trim().length > 0).catch(() => false);
  const statusText = await page.locator("#nextron-question-status").innerText().catch(() => "");
  const sendButton = page.getByRole("button", { name: /Send to NEXTRON|Analyzing/i }).first();
  const sendEnabled = await sendButton.isEnabled().catch(() => false);
  const sendVisible = await sendButton.isVisible().catch(() => false);
  const pendingVisible = await page.locator('[data-nextron-pending-turn="true"]').isVisible().catch(() => false);
  const contextLoading = /loading permitted context/i.test(statusText) || await page.getByText("Loading permitted context", { exact: false }).isVisible().catch(() => false);
  const asking = pendingVisible || /received your message|checking permitted evidence|analyzing/i.test(statusText);
  return { questionPresent, sendVisible, sendEnabled, pendingVisible, contextLoading, asking };
}

async function logNextronSendState(page, label) {
  const state = await nextronSendState(page);
  console.log(`  NEXTRON SEND STATE ${label}`);
  for (const [key, value] of Object.entries(state)) console.log(`    ${key}=${value}`);
}

async function expectNextronSendReady(page, label) {
  try {
    await expect.poll(async () => {
      const state = await nextronSendState(page);
      return state.questionPresent && state.sendVisible && state.sendEnabled && !state.asking && !state.contextLoading;
    }, { timeout: 30000 }).toBe(true);
  } catch (error) {
    await logNextronSendState(page, label);
    throw error;
  }
}

async function waitForNextronAskTerminal(page, prompt, label) {
  try {
    await expect(page.locator('[data-nextron-pending-turn="true"]')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator("#nextron-question-status")).not.toContainText(/checking permitted evidence|received your message|Analyzing/i, { timeout: 30000 });
    await expect(page.locator("article", { hasText: prompt })).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => nonPendingNextronAssistantCount(page), { timeout: 30000 }).toBeGreaterThan(0);
  } catch (error) {
    await logNextronSendState(page, label);
    throw error;
  }
}

async function askNextronHumanPath(page, prompt) {
  await page.locator("#nextron-question").fill(prompt);
  await expectNextronSendReady(page, "before production ask");
  await page.getByRole("button", { name: "Send to NEXTRON" }).click({ timeout: 30000 });
  await expect(page.locator("article", { hasText: prompt })).toBeVisible({ timeout: 5000 });
  const observedPending = await page.locator('[data-nextron-pending-turn="true"]').isVisible({ timeout: 2500 }).catch(() => false);
  await waitForNextronAskTerminal(page, prompt, "after production ask");
  if (observedPending) pass("NEXTRON pending acknowledgement appeared before production response");
  else pass("NEXTRON production response arrived before pending acknowledgement could be observed");
}

async function openMoreIntelligence(page) {
  const summary = page.locator("summary").filter({ hasText: "More intelligence" });
  await summary.click({ timeout: 30000 });
  await expect(page.getByText("Conversations", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("NEXTRON Signals")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("NEXTRON Actions")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Context permissions and access controls")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Context Sources")).toBeVisible({ timeout: 30000 });
}

async function sendOnboarding(page, text) {
  await page.locator("#nextron-onboarding-composer").fill(text);
  await page.getByRole("button", { name: "Send to NEXTRON" }).click({ timeout: 30000 });
  await expect(page.getByText("Analyzing...")).toHaveCount(0, { timeout: 90000 });
}

async function browserFirstRun(admin, userId) {
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    for (const width of [390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 740 : 844 } });
      const page = await context.newPage();
      await login(page);
      await page.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await expect(page.locator("body")).toContainText("NEXTRON onboarding", { timeout: 30000 });
      await expect(page.locator("body")).toContainText("First session", { timeout: 30000 });
      await assertNoOverflow(page, `${width}px first-run onboarding`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    await login(page);
    await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!page.url().includes("/onboarding")) throw new Error(`New user did not redirect to onboarding: ${page.url()}`);
    await expect(page.locator("body")).toContainText("NEXTRON onboarding", { timeout: 30000 });
    pass("True first authenticated entry reaches NEXTRON onboarding without redirect loop");

    await sendOnboarding(page, "I have a certification exam in three months. It is my highest priority. I also want to train four times per week and launch a small portfolio website. I usually lose focus in the evenings.");
    await expect(page.locator("body")).toContainText(/What I understand|Current picture/i, { timeout: 30000 });
    await sendOnboarding(page, "Actually, make training three days per week, not four. The portfolio site matters, but the certification exam comes first.");
    await expect(page.locator("body")).toContainText(/three|3/i, { timeout: 30000 });
    pass("Conversational onboarding handled a correction in the deployed browser flow");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const draftCount = await page.locator('[data-nextron-onboarding-draft="true"]').count();
      if (draftCount > 0) break;
      await sendOnboarding(page, "That is enough context. Please prepare the Life Setup Draft with only bounded goals, habits, projects, and tasks.");
    }
    await expect(page.locator('[data-nextron-onboarding-draft="true"]')).toBeVisible({ timeout: 90000 });
    await expect(page.locator("body")).toContainText("Life Setup Draft", { timeout: 30000 });
    await expect(page.locator("body")).toContainText("Deliberately left out", { timeout: 30000 });
    pass("Life Setup Draft rendered in production before writes");

    const beforePlan = await counts(admin, userId, ["goals", "projects", "habits", "tasks", "goal_links"]);
    assert(Object.values(beforePlan).every((value) => value === 0), "Setup Draft created no domain rows before approval");

    await page.getByRole("button", { name: "Build my Life Pulse" }).click({ timeout: 30000 });
    await expect(page.locator("body")).toContainText("Action Plan Preview", { timeout: 60000 });
    pass("Setup phase: action plan preview shown");
    const afterPreview = await counts(admin, userId, ["goals", "projects", "habits", "tasks", "goal_links"]);
    assert(JSON.stringify(afterPreview) === JSON.stringify(beforePlan), "Action Plan Preview created no domain rows before permissions or approval");

    await expect(page.locator("body")).toContainText("Permission review", { timeout: 15000 });
    pass("Setup phase: permission review shown");
    const blockedApproveButton = page.getByRole("button", { name: "Grant permissions first" });
    await expect(blockedApproveButton).toBeDisabled({ timeout: 15000 });
    pass("Setup phase: approval unavailable before explicit permissions");

    await page.getByRole("button", { name: "Grant approved-write permissions" }).click({ timeout: 30000 });
    pass("Setup phase: permission grant requested");
    await page.waitForTimeout(1500);
    const afterPermissions = await counts(admin, userId, ["goals", "projects", "habits", "tasks", "goal_links"]);
    assert(JSON.stringify(afterPermissions) === JSON.stringify(beforePlan), "Granting permissions alone created no domain rows");
    pass("Setup phase: permission grant created no domain rows");

    const approveButton = page.getByRole("button", { name: /Approve \d+ changes/ });
    await expect(approveButton).toBeEnabled({ timeout: 15000 });
    pass("Setup phase: approval enabled after explicit permissions");
    await approveButton.click({ timeout: 30000 });
    pass("Setup phase: proposal approval submitted");
    await expect(page.locator("body")).toContainText("Your Life Pulse is ready", { timeout: 90000 });
    pass("Setup phase: execution completed in browser");
    const afterSetup = await counts(admin, userId, ["goals", "projects", "habits", "tasks"]);
    printCounts("after setup", afterSetup);
    assert(afterSetup.goals > 0 && afterSetup.projects > 0 && afterSetup.habits > 0 && afterSetup.tasks > 0, "Approved setup persisted Goals, Projects, Habits, and Tasks");

    await expect(page.getByRole("button", { name: "Enter Life Pulse" })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Enter Life Pulse" }).click({ timeout: 30000 });
    await page.waitForURL(/\/today(?:\?|$)/, { timeout: 30000 });
    console.log(`  POST-SETUP PATH ${pathname(page)}`);
    assert(pathname(page) === "/today", "Post-setup destination is Today");
    const completion = await onboardingCompletionState(admin, userId);
    console.log(`  POST-SETUP STATE onboarding_completed=${completion.onboardingCompleted} onboarding_status=${completion.onboardingStatus ?? "null"}`);
    assert(completion.onboardingCompleted === true, "Post-setup profile onboarding_completed=true");
    assert(completion.onboardingStatus === "completed", "Post-setup onboarding status=completed");
    await expect(page.getByRole("heading", { name: /Good / })).toBeVisible({ timeout: 30000 });
    pass("Post-setup Today landmark is visible");

    await page.goto(`${BASE}/nextron`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/nextron(?:\?|$)/, { timeout: 30000 });
    await assertNextronHumanHierarchy(page, "post-setup NEXTRON Alpha 1.1 hierarchy");
    pass("Post-setup NEXTRON human-first surface loaded");
    for (const route of ["today", "goals", "projects", "habits", "tasks", "life-map"]) {
      await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (page.url().includes("/onboarding")) throw new Error(`${route} redirected back to onboarding after setup`);
      await assertNoOverflow(page, `desktop /${route}`);
    }
    pass("Post-setup product surfaces load without onboarding redirect");
    await context.close();
  } finally {
    await browser.close();
  }
}

async function setPermissions(client, patch) {
  const current = {
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
  };
  const { data: { user } } = await client.auth.getUser();
  const { error } = await client.from("nextron_context_preferences").upsert({ user_id: user.id, ...current }, { onConflict: "user_id" });
  if (error) throw new Error(`Permission setup failed: ${error.message}`);
}

async function createProposal(client, actionType, payload, title = actionType, idempotencyKey = null) {
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const validatedPayload = idempotencyKey ? { ...payload, idempotencyKey } : payload;
  const { data, error } = await client.rpc("nextron_create_action_proposal", {
    p_conversation_id: null,
    p_action_type: actionType,
    p_validated_payload: validatedPayload,
    p_preview_payload: { title, description: "Synthetic Alpha 1 production verifier", preview: { heading: title, subheading: title, fields: [], approvalLabel: "Approve synthetic Alpha 1 action" } },
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

async function cancel(client, proposalId) {
  const { data, error } = await client.rpc("nextron_cancel_action_proposal", { p_proposal_id: proposalId });
  if (error || !data?.id) throw new Error(`Cancel failed: ${error?.message ?? "missing proposal"}`);
  return data;
}

async function oneByTitle(client, table, title, columns = "*") {
  const { data, error } = await client.from(table).select(columns).eq("title", title).maybeSingle();
  if (error || !data?.id) throw new Error(`Missing ${table} row for ${title}: ${error?.message ?? "not found"}`);
  return data;
}

async function actionWriteVerification(admin, client, userId) {
  await setPermissions(client, { allow_task_actions: true, allow_goal_actions: true, allow_habit_actions: true, allow_project_actions: true });
  const suffix = RUN_ID;
  const goalTitle = `Alpha1 Goal ${suffix}`;
  const projectTitle = `Alpha1 Project ${suffix}`;
  const habitTitle = `Alpha1 Habit ${suffix}`;
  const taskTitle = `Alpha1 Task ${suffix}`;

  const goalCreate = await createProposal(client, "life_pulse.goal.create", { title: goalTitle, priority: "medium", targetDate: null }, "Create Alpha 1 goal", `alpha1:${suffix}:goal:create`);
  assert((await approve(client, goalCreate.id)).status === "completed", "Goal create completed");
  assert((await approve(client, goalCreate.id)).status === "completed", "Goal create replay returned terminal state");
  assert(await countExact(admin, "goals", userId, "title", goalTitle) === 1, "Goal create exact-once count is 1");
  const goal = await oneByTitle(client, "goals", goalTitle, "id,title,status,priority,target_date");
  const goalUpdate = await createProposal(client, "life_pulse.goal.update", { goalId: goal.id, beforeTitle: goal.title, beforeStatus: goal.status, beforePriority: goal.priority, beforeTargetDate: goal.target_date, priority: "high", targetDate: null }, "Update Alpha 1 goal");
  assert((await approve(client, goalUpdate.id)).status === "completed", "Goal update completed");

  const projectCreate = await createProposal(client, "life_pulse.project.create", { title: projectTitle, deadline: null }, "Create Alpha 1 project", `alpha1:${suffix}:project:create`);
  assert((await approve(client, projectCreate.id)).status === "completed", "Project create completed");
  assert((await approve(client, projectCreate.id)).status === "completed", "Project create replay returned terminal state");
  assert(await countExact(admin, "projects", userId, "title", projectTitle) === 1, "Project create exact-once count is 1");
  const project = await oneByTitle(client, "projects", projectTitle, "id,title,status,deadline");
  const projectUpdate = await createProposal(client, "life_pulse.project.update", { projectId: project.id, beforeTitle: project.title, beforeStatus: project.status, beforeDeadline: project.deadline, status: "paused", deadline: null }, "Update Alpha 1 project");
  assert((await approve(client, projectUpdate.id)).status === "completed", "Project update completed");

  const habitCreate = await createProposal(client, "life_pulse.habit.create", { title: habitTitle, frequency: "daily", timesPerWeek: null }, "Create Alpha 1 habit", `alpha1:${suffix}:habit:create`);
  assert((await approve(client, habitCreate.id)).status === "completed", "Habit create completed with nullable realm");
  assert((await approve(client, habitCreate.id)).status === "completed", "Habit create replay returned terminal state");
  assert(await countExact(admin, "habits", userId, "title", habitTitle) === 1, "Habit create exact-once count is 1");
  const habit = await oneByTitle(client, "habits", habitTitle, "id,title,frequency,times_per_week,realm_id");
  assert(habit.realm_id === null, "Habit persisted with realm_id null");
  const habitUpdate = await createProposal(client, "life_pulse.habit.update", { habitId: habit.id, beforeTitle: habit.title, beforeFrequency: habit.frequency, beforeTimesPerWeek: habit.times_per_week, frequency: "times_per_week", timesPerWeek: 3 }, "Update Alpha 1 habit");
  assert((await approve(client, habitUpdate.id)).status === "completed", "Habit update completed");

  const taskCreate = await createProposal(client, "life_pulse.task.create", { title: taskTitle, dueDate: null, priority: "medium" }, "Create Alpha 1 task", `alpha1:${suffix}:task:create`);
  assert((await approve(client, taskCreate.id)).status === "completed", "Task create regression completed");
  assert((await approve(client, taskCreate.id)).status === "completed", "Task create replay returned terminal state");
  assert(await countExact(admin, "tasks", userId, "title", taskTitle) === 1, "Task create exact-once count is 1");
  const task = await oneByTitle(client, "tasks", taskTitle, "id,title,status,due_date,project_id");
  const taskUpdate = await createProposal(client, "life_pulse.task.update", { taskId: task.id, beforeTitle: task.title, beforeStatus: task.status, beforeDueDate: task.due_date, projectId: project.id, projectTitle: project.title, projectStatus: "paused" }, "Assign Alpha 1 task to project");
  assert((await approve(client, taskUpdate.id)).status === "completed", "Task update assigned canonical project_id");

  const refreshedGoal = await oneByTitle(client, "goals", goalTitle, "id,title,status,priority,target_date");
  const refreshedProject = await oneByTitle(client, "projects", projectTitle, "id,title,status,deadline");
  const refreshedHabit = await oneByTitle(client, "habits", habitTitle, "id,title,frequency,times_per_week");
  const refreshedTask = await oneByTitle(client, "tasks", taskTitle, "id,title,status,due_date,project_id");
  assert(refreshedTask.project_id === refreshedProject.id, "Task -> Project relationship persisted through Task update semantics");

  const projectLinkPayload = { goalId: refreshedGoal.id, goalTitle: refreshedGoal.title, goalStatus: refreshedGoal.status, linkedType: "project", linkedId: refreshedProject.id, linkedTitle: refreshedProject.title, linkedStatus: refreshedProject.status };
  const habitLinkPayload = { goalId: refreshedGoal.id, goalTitle: refreshedGoal.title, goalStatus: refreshedGoal.status, linkedType: "habit", linkedId: refreshedHabit.id, linkedTitle: refreshedHabit.title, linkedStatus: refreshedHabit.frequency };
  for (const payload of [projectLinkPayload, habitLinkPayload]) {
    const link = await createProposal(client, "life_pulse.goal.link", payload, `Link Alpha 1 ${payload.linkedType}`, `alpha1:${suffix}:link:${payload.linkedType}`);
    assert((await approve(client, link.id)).status === "completed", `Goal-${payload.linkedType} link completed`);
    assert((await approve(client, link.id)).status === "completed", `Goal-${payload.linkedType} link replay terminal`);
    assert(await linkCount(admin, userId, payload) === 1, `Goal-${payload.linkedType} duplicate-safe count is 1`);
  }

  const staleGoal = await createProposal(client, "life_pulse.goal.update", { goalId: refreshedGoal.id, beforeTitle: refreshedGoal.title, beforeStatus: refreshedGoal.status, beforePriority: "high", beforeTargetDate: refreshedGoal.target_date, priority: "low", targetDate: null }, "Stale Alpha 1 goal update");
  await client.from("goals").update({ priority: "medium" }).eq("id", refreshedGoal.id);
  assert((await approve(client, staleGoal.id)).status === "stale", "Non-Task stale update rejected without overwrite");

  await setPermissions(client, { allow_goal_actions: true, allow_project_actions: false, allow_habit_actions: true, allow_task_actions: true });
  const blocked = await createProposal(client, "life_pulse.goal.link", projectLinkPayload, "Permission-blocked Alpha 1 link");
  assert((await approve(client, blocked.id)).status === "failed", "Permission revocation before execution blocks relationship mutation");
  await setPermissions(client, { allow_goal_actions: true, allow_project_actions: true, allow_habit_actions: true, allow_task_actions: true });

  const cancelProposal = await createProposal(client, "life_pulse.goal.create", { title: `Alpha1 Cancel ${suffix}`, priority: "low", targetDate: null }, "Cancel Alpha 1 goal");
  assert((await cancel(client, cancelProposal.id)).status === "canceled", "Cancel finalized proposal");
  assert((await approve(client, cancelProposal.id)).status === "canceled", "Canceled proposal cannot mutate on execution replay");
  assert(await countExact(admin, "goals", userId, "title", `Alpha1 Cancel ${suffix}`) === 0, "Canceled proposal created no Goal");

  return { goal: refreshedGoal, project: refreshedProject, habit: refreshedHabit, task: refreshedTask, projectLinkPayload, habitLinkPayload };
}

async function countExact(admin, table, userId, column, value) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId).eq(column, value);
  if (error) throw new Error(`Count failed for ${table}.${column}: ${error.message}`);
  return count ?? 0;
}

async function linkCount(admin, userId, payload) {
  const { count, error } = await admin.from("goal_links").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("goal_id", payload.goalId).eq("linked_type", payload.linkedType).eq("linked_id", payload.linkedId);
  if (error) throw new Error(`Link count failed: ${error.message}`);
  return count ?? 0;
}

async function verifyLifeMapAndNextron(client, browserState) {
  const { data: mapData, error: mapError } = await client.functions ? { data: null, error: null } : { data: null, error: null };
  void mapData;
  void mapError;
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await login(page);
    const providerCalls = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/nextron/ask") || url.includes("/api/nextron/onboarding")) providerCalls.push(url);
    });
    await page.goto(`${BASE}/life-map`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.locator("body")).toContainText("Life Map", { timeout: 30000 });
    await expect(page.locator("body")).toContainText(browserState.goal.title, { timeout: 30000 });
    await expect(page.locator("body")).toContainText(browserState.project.title, { timeout: 30000 });
    await expect(page.locator("body")).toContainText(browserState.habit.title, { timeout: 30000 });
    await assertNoOverflow(page, "390px populated Life Map");
    assert(providerCalls.length === 0, "Life Map render made zero provider-route calls");
    await context.close();

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const desktopPage = await desktop.newPage();
    await login(desktopPage);
    await desktopPage.goto(`${BASE}/nextron`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await desktopPage.waitForURL(/\/nextron(?:\?|$)/, { timeout: 30000 });
    await assertNextronHumanHierarchy(desktopPage, "desktop NEXTRON Alpha 1.1 hierarchy");
    await askNextronHumanPath(desktopPage, "What can you help me with?");
    await openMoreIntelligence(desktopPage);
    pass("NEXTRON Alpha 1.1 human-first hierarchy and secondary systems verified");
    for (const prompt of ["What supports my certification goal?", "Which project is connected to my goal?", "Show me my projects.", "Show me my habits.", "What should I focus on?"]) {
      await askNextronHumanPath(desktopPage, prompt);
    }
    await expect(desktopPage.locator('[data-nextron-rich-response="true"]').last()).toBeVisible({ timeout: 30000 });
    await desktopPage.reload({ waitUntil: "domcontentloaded" });
    await expect(desktopPage.locator('[data-nextron-rich-response="true"]').first()).toBeVisible({ timeout: 30000 });
    pass("NEXTRON cross-domain and rich UI production checks completed");

    for (const width of [390, 320]) {
      const mobile = await browser.newContext({ viewport: { width, height: width === 320 ? 780 : 844 } });
      const mobilePage = await mobile.newPage();
      await login(mobilePage);
      await mobilePage.goto(`${BASE}/nextron`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await mobilePage.waitForURL(/\/nextron(?:\?|$)/, { timeout: 30000 });
      await assertNextronHumanHierarchy(mobilePage, `${width}px NEXTRON Alpha 1.1 hierarchy`);
      await mobile.close();
    }
    pass("NEXTRON Alpha 1.1 390px and 320px hierarchy checks completed");

    await desktopPage.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(desktopPage.locator("body")).toContainText(/Model calls: 0|No background AI/i, { timeout: 30000 });
    pass("Attention/Today loaded with zero-background-call copy");
    await desktop.close();
  } finally {
    await browser.close();
  }
}

async function verifyUnlinkAndOrphanCleanup(admin, client, userId, state) {
  for (const payload of [state.projectLinkPayload, state.habitLinkPayload]) {
    const unlink = await createProposal(client, "life_pulse.goal.unlink", payload, `Unlink Alpha 1 ${payload.linkedType}`);
    assert((await approve(client, unlink.id)).status === "completed", `Goal-${payload.linkedType} unlink completed`);
    assert(await linkCount(admin, userId, payload) === 0, `Goal-${payload.linkedType} link row removed without deleting entities`);
  }
  assert(await countExact(admin, "goals", userId, "title", state.goal.title) === 1, "Unlink preserved Goal");
  assert(await countExact(admin, "projects", userId, "title", state.project.title) === 1, "Unlink preserved Project");
  assert(await countExact(admin, "habits", userId, "title", state.habit.title) === 1, "Unlink preserved Habit");

  await client.from("goal_links").insert({ user_id: userId, goal_id: state.goal.id, linked_type: "project", linked_id: state.project.id });
  await client.from("projects").delete().eq("id", state.project.id);
  assert(await linkCount(admin, userId, state.projectLinkPayload) === 0, "Project hard delete cleans polymorphic goal_links target rows");
}

async function verifyInitialState(admin, userId) {
  const initial = await counts(admin, userId, ["profiles", "nextron_onboarding", "nextron_conversations", "nextron_messages", "goals", "projects", "habits", "tasks", "goal_links"]);
  printCounts("fresh user", initial);
  assertFreshProfile(initial.profiles === 1, `expected profiles=1, actual=${initial.profiles}`);
  const { data: profile, error } = await admin.from("profiles").select("user_id,onboarding_completed,intended_use").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`FAIL Fresh-user profile contract: profile read failed: ${safeSupabaseError(error)}`);
  assertFreshProfile(profile?.user_id === userId, "profile belongs to synthetic auth user");
  assertFreshProfile(profile.onboarding_completed === false, `onboarding_completed expected false, actual=${String(profile.onboarding_completed)}`);
  assertFreshProfile(profile.intended_use === null, "intended_use is unset for a truly new user");
  const domainCounts = { ...initial };
  delete domainCounts.profiles;
  for (const [table, value] of Object.entries(domainCounts)) assert(value === 0, `Fresh synthetic user has zero ${table}`);
}

async function main() {
  requireConfig();
  console.log("\n=== Life Pulse Alpha 1 Disposable Production E2E ===");
  console.log(`Target: ${BASE}`);
  if (!VERIFY_DELETED_USER_ID) {
    console.log(`Run: ${RUN_ID}`);
    console.log(`Synthetic email: ${EMAIL}`);
  }
  const admin = adminClient();
  await validateAdmin(admin);
  if (VERIFY_DELETED_USER_ID) {
    if (CLEANUP_RUN_ID) throw new Error("Use only one recovery mode at a time.");
    await verifyDeletedUserResidue(admin);
    console.log("Alpha 1 deleted-user zero-residue verification completed.");
    return;
  }
  if (CLEANUP_RUN_ID) {
    await cleanupOnly(admin);
    console.log("Alpha 1 cleanup-only completed.");
    return;
  }

  let userId = null;
  try {
    userId = await createSyntheticUser(admin);
    pass("Synthetic auth user created");
    await verifyInitialState(admin, userId);
    await browserFirstRun(admin, userId);
    const { client, userId: signedUserId } = await signedClient();
    assert(signedUserId === userId, "Synthetic anon session maps to created auth user");
    const state = await actionWriteVerification(admin, client, userId);
    await verifyLifeMapAndNextron(client, state);
    await verifyUnlinkAndOrphanCleanup(admin, client, userId, state);
  } finally {
    if (userId) await cleanup(admin, userId);
  }

  console.log("Life Pulse Alpha 1 disposable production E2E passed with zero residue.");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
