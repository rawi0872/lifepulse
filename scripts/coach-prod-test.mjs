#!/usr/bin/env node

// Focused production QA for the Coach ecosystem.
// Prompt 8 intentionally performs synthetic NEXTRON Task actions, verifies canonical writes, and cleans them up.

import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(filepath) {
  if (!existsSync(filepath)) return {};
  const content = readFileSync(filepath, "utf-8");
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

const appEnv = loadEnv(resolve(__dirname, "..", ".env.local"));
const testEnv = loadEnv(resolve(__dirname, "..", ".env.test.local"));
const env = { ...appEnv, ...testEnv, ...process.env };

const BASE = env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const ERROR_SCREENSHOT_PATH = "screenshot-coach-prod-error.png";

const requiredCoachText = [
  "Personal Intelligence",
  "NEXTRON",
  "NEXTRON Daily Brief",
  "What to know and protect today",
  "Generate brief",
  "NEXTRON Signals",
  "What changed or deserves attention",
  "Refresh signals",
  "NEXTRON Actions",
  "Approval framework",
  "Command channel",
  "Ask NEXTRON",
  "Main intelligence",
  "Live intelligence",
  "Read-only schedule",
  "Active Projects",
  "Context Sources",
  "Context permissions",
  "Context permissions and access controls",
  "Operational context",
  "Private text context",
  "Currently available",
  "Not available to NEXTRON",
];

const requiredTransparencyText = [
  "External AI memory",
  "Google Calendar",
  "Reminders, email, and messages",
  "External connectors are read-only",
  "Drive uses selected imported files only",
  "NEXTRON is permissioned, bounded, and user-controlled",
];

const forbiddenFinancePhrases = [
  "you earn",
  "you should",
  "financial advisor",
  "prediction",
  "forecast",
  "getting better",
  "getting worse",
  "spend less",
  "save more",
];

const forbiddenCoachMemoryPhrases = [
  "vector",
  "document upload",
  "file parsing",
  "public sharing",
  "emotional analysis",
  "mental health analysis",
  "prediction",
  "forecast",
  "getting better",
  "getting worse",
  "therapy advice",
  "AI is reading",
  "AI remembers",
  "AI-generated summary",
  "automatic AI summary",
];

const financeCoachNudgeTitle = "Review this week's money activity";
const financeCoachSafeText = [
  "logged finance transactions this week",
  "Weekly Review can help you reflect on the pattern",
  "Open Weekly Review",
];

const memoryCoachNudgeTitle = "Capture one lesson from this week";
const memoryCoachSafeText = [
  "You have reflection activity this week",
  "Save one useful lesson or idea in Knowledge so it does not get lost",
  "Open Knowledge",
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused Coach production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:coach");
    console.error("");
    process.exit(2);
  }
}

async function createQaSupabaseClient() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.user) throw new Error(`Supabase QA sign-in failed: ${error?.message ?? "missing user"}`);
  return { supabase, userId: data.user.id };
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

function info(label) {
  console.log(`  INFO ${label}`);
}

async function failWithDiagnostics(page, error) {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "<unavailable>");
  await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true }).catch(() => undefined);

  console.error("");
  console.error("Coach production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Coach text, production may not have deployed the latest commit yet.");
  console.error("");
}

async function expectBodyText(page, text, timeout = 15000) {
  await expect(page.locator("body")).toContainText(text, { timeout });
  pass(`Found text: ${text}`);
}

async function assertAuthenticatedRoute(page, routeName) {
  if (page.url().includes("/login")) {
    const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "<unavailable>");
    throw new Error(`${routeName} redirected to login. Current URL: ${page.url()}. Body excerpt: ${bodyText.slice(0, 300)}`);
  }
  if (page.url().includes("/onboarding")) {
    throw new Error(`Smoke-test account is not onboarded. Use an existing onboarded LIFE_PULSE_TEST_EMAIL account for this read-only ${routeName} check.`);
  }
}

async function main() {
  requireConfig();

  console.log("");
  console.log("=== Life Pulse Coach Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Focused write check: synthetic NEXTRON Task actions are created and cleaned up.");
  console.log("");

  const runId = `prompt8-${Date.now()}`;
  const createTitle = `Prompt 8 QA create ${runId}`;
  const updateTitle = `Prompt 8 QA update ${runId}`;
  const { supabase, userId } = await createQaSupabaseClient();
  const { data: originalPrefs } = await supabase
    .from("nextron_context_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  async function cleanupSyntheticData() {
    try { await supabase.from("tasks").delete().eq("user_id", userId).in("title", [createTitle, updateTitle]); } catch {}
    try {
      if (originalPrefs) await supabase.from("nextron_context_preferences").upsert(originalPrefs, { onConflict: "user_id" });
      else await supabase.from("nextron_context_preferences").delete().eq("user_id", userId);
    } catch {}
  }

  await cleanupSyntheticData();
  await supabase.from("nextron_context_preferences").upsert({
    user_id: userId,
    permission_version: 5,
    allow_profile: true,
    allow_today: true,
    allow_tasks: true,
    allow_task_actions: true,
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
  }, { onConflict: "user_id" });

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    pass("Submitted smoke-test account login");

    await page.goto(`${BASE}/coach`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/coach/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Coach");
    await expect(page.getByRole("heading", { name: "NEXTRON", exact: true })).toBeVisible({ timeout: 20000 });
    pass("Coach page loaded");

    for (const text of requiredCoachText) {
      await expectBodyText(page, text);
    }

    for (const text of requiredTransparencyText) {
      await expectBodyText(page, text);
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Coach page loaded with an error state.");
    }

    const lowerBodyText = bodyText.toLowerCase();
    for (const phrase of forbiddenFinancePhrases) {
      expect(lowerBodyText).not.toContain(phrase);
      pass(`Forbidden finance phrase absent: ${phrase}`);
    }

    for (const phrase of forbiddenCoachMemoryPhrases) {
      expect(lowerBodyText).not.toContain(phrase.toLowerCase());
      pass(`Forbidden Coach memory phrase absent: ${phrase}`);
    }

    await expect(page.locator('[data-nextron-signals="true"]')).toBeVisible({ timeout: 20000 });
    const signalCount = await page.locator('[data-nextron-signal="true"]').count();
    expect(signalCount).toBeLessThanOrEqual(5);
    if (signalCount > 0) {
      await expect(page.locator('[data-nextron-signals="true"]')).toContainText("Why this signal exists", { timeout: 10000 });
      await expect(page.getByRole("button", { name: "Why does this matter?" }).first()).toBeVisible({ timeout: 10000 });
      pass(`NEXTRON Signals visible with ${signalCount} active signal(s)`);
    } else {
      await expect(page.locator('[data-nextron-signals="true"]')).toContainText("No meaningful signals right now", { timeout: 10000 });
      pass("NEXTRON Signals empty state is visible");
    }
    await page.getByRole("button", { name: "Refresh signals" }).click();
    await expect(page.locator('[data-nextron-signals="true"]')).toContainText("Provider: deterministic", { timeout: 15000 });
    pass("NEXTRON Signals refresh completed");

    await expect(page.locator('[data-nextron-actions="true"]')).toContainText("Task actions permission", { timeout: 10000 });
    await page.locator("#nextron-question").fill(`Create a task called ${createTitle} tomorrow`);
    await page.getByRole("button", { name: "Send to NEXTRON" }).click();
    const createProposal = page.locator('[data-nextron-action-proposal="true"]').filter({ hasText: createTitle }).first();
    await expect(createProposal).toContainText("CREATE TASK", { timeout: 20000 });
    await expect(createProposal).toContainText("Requires approval", { timeout: 10000 });
    pass("Task create action proposal generated");

    await expect(createProposal.getByRole("button", { name: "Approve task" })).toBeEnabled({ timeout: 15000 });
    await createProposal.getByRole("button", { name: "Approve task" }).click();
    await expect(createProposal).toContainText("Approved and completed. Canonical Task data was updated.", { timeout: 15000 });
    const { data: createdTask } = await supabase.from("tasks").select("id, title, status, due_date").eq("user_id", userId).eq("title", createTitle).maybeSingle();
    expect(createdTask?.status).toBe("todo");
    expect(createdTask?.due_date).toBeTruthy();
    pass("Approved Task create mutated canonical task row");

    await page.locator("#nextron-question").fill(`Create a task called ${updateTitle} today`);
    await page.getByRole("button", { name: "Send to NEXTRON" }).click();
    const updateSeedProposal = page.locator('[data-nextron-action-proposal="true"]').filter({ hasText: updateTitle }).first();
    await expect(updateSeedProposal).toContainText("CREATE TASK", { timeout: 20000 });
    await expect(updateSeedProposal.getByRole("button", { name: "Approve task" })).toBeEnabled({ timeout: 15000 });
    await updateSeedProposal.getByRole("button", { name: "Approve task" }).click();
    await expect(updateSeedProposal).toContainText("Approved and completed. Canonical Task data was updated.", { timeout: 15000 });
    pass("Seeded Task update target through approved Task create");

    await page.locator("#nextron-question").fill(`Move task called ${updateTitle} to tomorrow`);
    await page.getByRole("button", { name: "Send to NEXTRON" }).click();
    const updateProposal = page.locator('[data-nextron-action-proposal="true"]').filter({ hasText: updateTitle }).filter({ hasText: "UPDATE TASK" }).first();
    await expect(updateProposal).toContainText("UPDATE TASK", { timeout: 20000 });
    await expect(updateProposal.getByRole("button", { name: "Approve task update" })).toBeEnabled({ timeout: 15000 });
    await updateProposal.getByRole("button", { name: "Approve task update" }).click();
    await expect(updateProposal).toContainText("Approved and completed. Canonical Task data was updated.", { timeout: 15000 });
    const { data: updatedTask } = await supabase.from("tasks").select("title, due_date").eq("user_id", userId).eq("title", updateTitle).maybeSingle();
    expect(updatedTask?.due_date).toBeTruthy();
    pass("Approved Task update mutated canonical task row");

    await page.locator("#nextron-question").fill("Create a task called Prompt 7 cancel check tomorrow");
    await page.getByRole("button", { name: "Send to NEXTRON" }).click();
    const cancelProposal = page.locator('[data-nextron-action-proposal="true"]').filter({ hasText: "Prompt 7 cancel check" }).first();
    await expect(cancelProposal).toContainText("Prompt 7 cancel check", { timeout: 20000 });
    await expect(cancelProposal.getByRole("button", { name: "Cancel" })).toBeEnabled({ timeout: 15000 });
    await cancelProposal.getByRole("button", { name: "Cancel" }).click();
    await expect(cancelProposal).toContainText("Canceled. This proposal can no longer be approved.", { timeout: 15000 });
    pass("Action cancellation finalized proposal");

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator('[data-nextron-actions="true"]')).toContainText("Approved and completed. Canonical Task data was updated.", { timeout: 20000 });
    await expect(page.locator('[data-nextron-actions="true"]')).toContainText("Canceled. This proposal can no longer be approved.", { timeout: 10000 });
    pass("Action proposal statuses persisted across refresh");

    if (bodyText.includes(financeCoachNudgeTitle)) {
      pass(`Finance Coach nudge visible: ${financeCoachNudgeTitle}`);
      for (const text of financeCoachSafeText) {
        expect(bodyText).toContain(text);
        pass(`Finance Coach safe copy present: ${text}`);
      }
    } else {
      info("Finance Coach nudge is data/day dependent and not visible for this account state.");
    }

    if (bodyText.includes(memoryCoachNudgeTitle)) {
      pass(`Coach memory nudge visible: ${memoryCoachNudgeTitle}`);
      for (const text of memoryCoachSafeText) {
        expect(bodyText).toContain(text);
        pass(`Coach memory safe copy present: ${text}`);
      }
    } else {
      info("Coach memory nudge is data-dependent and not visible for this account/week state.");
    }

    await page.getByRole("button", { name: "Generate brief" }).click();
    await expect(page.locator('[data-nextron-daily-brief="true"]')).toContainText("Updated", { timeout: 30000 });
    await expect(page.locator('[data-nextron-daily-brief="true"]')).toContainText("Sources used", { timeout: 10000 });
    await expect(page.locator('[data-nextron-daily-brief="true"]')).toContainText("Recommended approach", { timeout: 10000 });
    await expect(page.getByRole("button", { name: "Ask why" })).toBeVisible({ timeout: 10000 });
    const priorityCount = await page.locator('[data-nextron-daily-brief-priority="true"]').count();
    expect(priorityCount).toBeLessThanOrEqual(3);
    pass(`Daily Brief generated with ${priorityCount} primary priorities`);

    await page.getByRole("button", { name: "Refresh brief" }).click();
    await expect(page.locator('[data-nextron-daily-brief="true"]')).toContainText("Updated", { timeout: 30000 });
    pass("Daily Brief refresh completed");

    console.log("");
    console.log("Coach production QA passed.");
    console.log("");
  } catch (error) {
    await cleanupSyntheticData();
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await cleanupSyntheticData();
  await browser.close();
}

main();
