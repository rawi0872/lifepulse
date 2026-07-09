#!/usr/bin/env node

// Focused production QA for the read-only Tasks project context UI.
// This intentionally avoids task/project creation, editing, deletion, completion toggles, form submission, and database writes.

import { chromium, expect } from "@playwright/test";
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

const fileEnv = loadEnv(resolve(__dirname, "..", ".env.test.local"));
const env = { ...fileEnv, ...process.env };

const BASE = env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;
const ERROR_SCREENSHOT_PATH = "screenshot-tasks-prod-error.png";

const requiredTasksText = [
  "Tasks",
  "Today",
  "Upcoming",
  "All",
  "Done",
];

const riskyTaskText = [
  "task health",
  "success score",
  "failure",
  "bad task",
  "AI planning",
  "automatic generation",
  "prediction",
  "forecast",
  "getting better",
  "getting worse",
];

const taskGoalContextText = [
  "Goal:",
  "Supports goals:",
  "Supports ",
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused Tasks production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:tasks");
    console.error("");
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

function info(label) {
  console.log(`  INFO ${label}`);
}

function skip(label) {
  console.log(`  SKIP ${label}`);
}

async function failWithDiagnostics(page, error) {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "<unavailable>");
  await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true }).catch(() => undefined);

  console.error("");
  console.error("Tasks production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Tasks project context text, production may not have deployed the latest commit yet.");
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
  console.log("=== Life Pulse Tasks Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not create, edit, delete, complete, or submit task/project data.");
  console.log("");

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

    await page.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/tasks/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Tasks");
    await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible({ timeout: 20000 });
    pass("Tasks page loaded");

    for (const text of requiredTasksText) {
      await expectBodyText(page, text);
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Tasks page loaded with an error state.");
    }

    const editButtons = await page.getByRole("button", { name: "Edit" }).count();
    const deleteButtons = await page.getByRole("button", { name: "Delete" }).count();
    const hasTaskRows = editButtons > 0 || deleteButtons > 0;
    if (hasTaskRows) {
      pass(`Task rows are visible: ${Math.max(editButtons, deleteButtons)} detected`);
    } else if (bodyText.includes("No tasks for now") || bodyText.includes("No tasks match this filter")) {
      skip("Task rows are data-dependent and not visible for this account/task state");
    } else {
      info("No task row action buttons detected; continuing with read-only page checks.");
    }

    const projectContextCount = await page.getByText(/^Project:\s+.+/).count();
    if (projectContextCount > 0) {
      pass(`Tasks project context is visible: ${projectContextCount} badge(s)`);
      const projectContextText = await page.getByText(/^Project:\s+.+/).first().innerText();
      expect(projectContextText.trim()).toMatch(/^Project:\s+\S/);
      pass("Tasks project context has a project title");
      info("Project context is read-only; no task/project action buttons were clicked.");
    } else {
      skip("Tasks project context is data-dependent and not visible for this account/task state");
    }

    const goalContextVisible = taskGoalContextText.some((text) => bodyText.includes(text));
    if (hasTaskRows && goalContextVisible) {
      pass("Tasks direct goal context is visible");
    } else if (hasTaskRows) {
      skip("Tasks goal context is data-dependent and not visible for this account/task state");
    } else {
      skip("Tasks goal context is data-dependent and not visible because task rows are not visible");
    }

    const finalBodyText = await page.locator("body").innerText({ timeout: 10000 });
    for (const text of riskyTaskText) {
      expect(finalBodyText.toLowerCase()).not.toContain(text.toLowerCase());
      pass(`Did not find risky Tasks text: ${text}`);
    }

    console.log("");
    console.log("Tasks production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
