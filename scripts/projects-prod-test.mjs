#!/usr/bin/env node

// Focused production QA for the read-only Projects task context.
// This intentionally avoids project/task creation, editing, deletion, form submission, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-projects-prod-error.png";

const requiredProjectsText = [
  "Turn bigger goals into visible progress.",
];

const projectTaskContextText = [
  "Linked tasks",
  "Open tasks",
  "Completed tasks",
  "Next task",
];

const projectGoalContextText = [
  "Goal:",
  "Supports goals:",
  "No linked goals yet",
];

const riskyProjectText = [
  "project health",
  "success score",
  "failure",
  "bad project",
  "AI planning",
  "automatic generation",
  "prediction",
  "forecast",
  "getting better",
  "getting worse",
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused Projects production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:projects");
    console.error("");
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

function skip(label) {
  console.log(`  SKIP ${label}`);
}

async function failWithDiagnostics(page, error) {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "<unavailable>");
  await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true }).catch(() => undefined);

  console.error("");
  console.error("Projects production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Projects text, production may not have deployed the latest commit yet.");
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
  console.log("=== Life Pulse Projects Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not create, edit, delete, or submit project/task data.");
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

    await page.goto(`${BASE}/projects`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/projects/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Projects");
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible({ timeout: 20000 });
    pass("Projects page loaded");
    pass("Found page title: Projects");

    for (const text of requiredProjectsText) {
      await expectBodyText(page, text);
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Projects page loaded with an error state.");
    }

    for (const text of riskyProjectText) {
      expect(bodyText.toLowerCase()).not.toContain(text.toLowerCase());
      pass(`Did not find risky Projects text: ${text}`);
    }

    const hasProjectSections = ["Active projects", "Paused", "Completed"].some((text) => bodyText.includes(text));
    if (hasProjectSections) {
      pass("Project sections are visible");
      const hasTaskContext = projectTaskContextText.some((text) => bodyText.includes(text));
      const hasNoLinkedTasks = bodyText.includes("No linked tasks yet");
      const hasGoalContext = projectGoalContextText.some((text) => bodyText.includes(text));

      if (!hasTaskContext && !hasNoLinkedTasks) {
        throw new Error("Project cards are visible, but no task context labels were found.");
      }

      if (!hasGoalContext) {
        throw new Error("Project cards are visible, but no goal context text was found.");
      }

      if (hasTaskContext) {
        pass("Project task context labels are visible");
      }
      if (hasNoLinkedTasks) {
        pass("Project no-linked-tasks state is visible");
      }
      if (bodyText.includes("Goal:") || bodyText.includes("Supports goals:")) {
        pass("Project linked-goal context is visible");
      }
      if (bodyText.includes("No linked goals yet")) {
        pass("Project no-linked-goals state is visible");
      }
    } else {
      skip("Projects task and goal context are data-dependent and not visible for this account/project state");
    }

    console.log("");
    console.log("Projects production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
