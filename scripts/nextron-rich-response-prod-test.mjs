#!/usr/bin/env node

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

const BASE = env.LIFE_PULSE_BASE_URL || env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const OVERFLOW_TOLERANCE_PX = 2;

const viewports = [1440, 1280, 1024, 768, 430, 390, 360, 320];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

async function createQaSupabaseClient() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.user) throw new Error(`Supabase QA sign-in failed: ${error?.message ?? "missing user"}`);
  return { supabase, userId: data.user.id };
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
}

async function assertAuthenticatedRoute(page, label) {
  if (page.url().includes("/login")) throw new Error(`${label} redirected to login.`);
  if (page.url().includes("/onboarding")) throw new Error(`${label} redirected to onboarding; use an onboarded QA account.`);
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ body: document.body.scrollWidth, doc: document.documentElement.scrollWidth, inner: window.innerWidth }));
  const max = metrics.inner + OVERFLOW_TOLERANCE_PX;
  if (metrics.body > max || metrics.doc > max) throw new Error(`${label} horizontal overflow: body=${metrics.body}, doc=${metrics.doc}, viewport=${metrics.inner}`);
  pass(`${label} has no horizontal overflow`);
}

async function waitForNextronReady(page) {
  await expect(page.locator("body")).not.toContainText("Loading permitted context", { timeout: 60000 });
  await expect(page.locator("body")).not.toContainText("Loading conversations", { timeout: 60000 });
}

async function ask(page, prompt) {
  await page.locator("#nextron-question").fill(prompt);
  const sendButton = page.getByRole("button", { name: /Send to NEXTRON|Analyzing/i });
  await expect(sendButton).toBeEnabled({ timeout: 60000 });
  await sendButton.click({ timeout: 60000 });
  await expect(page.locator("#nextron-question-status")).not.toContainText(/Analyzing|checking permitted evidence/i, { timeout: 45000 });
}

async function askExpectRich(page, prompt, label) {
  const before = await page.locator('[data-nextron-rich-response="true"]').count();
  await ask(page, prompt);
  await expect.poll(async () => page.locator('[data-nextron-rich-response="true"]').count(), { timeout: 20000 }).toBeGreaterThan(before);
  pass(`${label} produced targeted rich UI`);
}

async function askExpectNoNewRich(page, prompt, label) {
  const before = await page.locator('[data-nextron-rich-response="true"]').count();
  await ask(page, prompt);
  await expect.poll(async () => page.locator('[data-nextron-rich-response="true"]').count(), { timeout: 20000 }).toBe(before);
  pass(`${label} stayed plain text`);
}

async function main() {
  requireConfig();
  console.log("\n=== NEXTRON Rich Response Browser QA ===");
  console.log(`Base URL: ${BASE}`);

  const { supabase, userId } = await createQaSupabaseClient();
  const { data: originalPrefs } = await supabase.from("nextron_context_preferences").select("*").eq("user_id", userId).maybeSingle();

  await supabase.from("nextron_context_preferences").upsert({
    user_id: userId,
    permission_version: 5,
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
  }, { onConflict: "user_id" });

  const browser = await chromium.launch({ headless: HEADLESS });
  let richConversationTitle = null;

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    await login(page);
    await page.goto(`${BASE}/nextron`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await assertAuthenticatedRoute(page, "NEXTRON");
    await expect(page.getByRole("heading", { name: "NEXTRON", exact: true })).toBeVisible({ timeout: 20000 });
    await waitForNextronReady(page);
    pass("NEXTRON loaded");

    await ask(page, "What should I do today?");
    await expect(page.locator('[data-nextron-rich-response="true"]').last()).toBeVisible({ timeout: 20000 });
    await expect(page.locator("body")).toContainText("Generated UI", { timeout: 20000 });
    await expect(page.locator("body")).toContainText("0 model calls", { timeout: 20000 });
    richConversationTitle = await page.locator("#nextron-answer").innerText({ timeout: 10000 });
    pass("Today rich response rendered");
    await assertNoOverflow(page, "desktop rich response");

    await askExpectRich(page, "Show me my projects.", "Projects request");
    await askExpectRich(page, "Show my open tasks.", "Tasks request");
    await askExpectRich(page, "How are my goals going?", "Goals request");
    await askExpectRich(page, "Show me my habits.", "Habits request");
    await askExpectRich(page, "What needs my attention?", "Attention request");
    await askExpectRich(page, "Why are you telling me this?", "Why/evidence follow-up");
    await askExpectRich(page, "Summarize my current Life Pulse.", "Summary request");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-nextron-rich-response="true"]').last()).toBeVisible({ timeout: 20000 });
    pass("Rich response persisted after refresh");

    await askExpectNoNewRich(page, "What's 2 + 2?", "Unrelated arithmetic");
    await askExpectNoNewRich(page, "Explain what a habit is.", "Generic habit definition");

    await ask(page, "Create a task called Prompt 4 rich response approval safety check");
    await expect(page.locator("body")).toContainText("NEXTRON Actions", { timeout: 20000 });
    await expect(page.locator("body")).toContainText(/requires approval|Approval framework/i, { timeout: 20000 });
    pass("Action preview remains separate from rich response UI");
    await context.close();

    for (const width of viewports) {
      const viewportContext = await browser.newContext({ viewport: { width, height: width <= 430 ? 820 : 960 } });
      const viewportPage = await viewportContext.newPage();
      await login(viewportPage);
      await viewportPage.goto(`${BASE}/nextron`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await assertAuthenticatedRoute(viewportPage, `NEXTRON ${width}`);
      await waitForNextronReady(viewportPage);
      if (richConversationTitle) {
        const conversationButton = viewportPage.locator("aside").getByRole("button", { name: richConversationTitle }).first();
        if (await conversationButton.isVisible().catch(() => false)) await conversationButton.click();
      }
      await expect(viewportPage.locator('[data-nextron-rich-response="true"]').first()).toBeVisible({ timeout: 20000 });
      await assertNoOverflow(viewportPage, `${width}px historical rich response`);
      await viewportContext.close();
    }
  } finally {
    await browser.close();
    if (originalPrefs) await supabase.from("nextron_context_preferences").upsert(originalPrefs, { onConflict: "user_id" });
  }

  console.log("NEXTRON Rich Response browser QA passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
