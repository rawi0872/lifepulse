#!/usr/bin/env node

// Focused production QA for the read-only Today command center polish.
// This intentionally avoids task/habit completion, quick capture, save flows, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-today-command-center-prod-error.png";

const requiredCommandCenterText = [
  "Today Command Center",
  "Active ecosystem",
  "Daily execution",
  "Life Pulse context",
];

const requiredEcosystemLinks = ["Today", "Tasks", "Habits", "Journal"];

const requiredMemoryLoopText = [
  "Memory loop",
  "Today reflection",
  "Knowledge this week",
  "Weekly memory review",
  "Private manual memory. No AI summaries or external processing.",
];

const conditionalExecutionBridgeText = [
  "Execution bridge",
  "Active goals",
  "Goals with action links",
  "Goals without action links",
  "Action links",
  "Open Goals",
  "Open Projects",
  "Open Tasks",
  "Open Habits",
];

const conditionalExecutionBridgeStatusText = [
  "Some active goals are not connected to projects, tasks, or habits yet.",
  "Your active goals are connected to action.",
];

const riskyTodayMemoryText = [
  "AI memory",
  "vector",
  "embeddings",
  "document upload",
  "file parsing",
  "public sharing",
  "external AI processing",
  "emotional analysis",
  "mental health analysis",
  "diagnosis",
  "prediction",
  "forecast",
  "getting better",
  "getting worse",
  "therapy",
];

const riskyExecutionBridgeText = [
  "goal health",
  "success score",
  "bad goal",
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
    console.error("Focused Today command center production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:today");
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
  console.error("Today command center production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Today command-center text, production may not have deployed the latest commit yet.");
  console.error("");
}

async function expectBodyText(page, text, timeout = 15000) {
  await expect(page.locator("body")).toContainText(text, { timeout });
  pass(`Found text: ${text}`);
}

async function main() {
  requireConfig();

  console.log("");
  console.log("=== Life Pulse Today Command Center Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not complete tasks/habits, quick-capture items, or write data.");
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

    await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/today/, { timeout: 30000 });
    if (page.url().includes("/login")) {
      const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "<unavailable>");
      throw new Error(`Today redirected to login. Current URL: ${page.url()}. Body excerpt: ${bodyText.slice(0, 300)}`);
    }
    if (page.url().includes("/onboarding")) {
      throw new Error("Smoke-test account is not onboarded. Use an existing onboarded LIFE_PULSE_TEST_EMAIL account for this read-only Today check.");
    }
    await expect(page.getByRole("heading", { name: /Good / })).toBeVisible({ timeout: 20000 });
    pass("Today page loaded");

    for (const text of requiredCommandCenterText) {
      await expectBodyText(page, text);
    }

    const ecosystem = page.locator("section", { hasText: "Active ecosystem" }).first();
    await expect(ecosystem).toBeVisible({ timeout: 15000 });
    pass("Active ecosystem strip is visible");

    for (const label of requiredEcosystemLinks) {
      await expect(ecosystem.getByRole("link", { name: new RegExp(`^${label}(?:\\s+Preview)?$`) })).toBeVisible({ timeout: 15000 });
      pass(`Found ecosystem link: ${label}`);
    }

    const previewCount = await ecosystem.getByText("Preview", { exact: true }).count();
    if (previewCount > 0) {
      pass("Preview label appears for visible preview module");
    } else {
      skip("No preview module is visible in the current Today ecosystem strip");
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load dashboard")) {
      throw new Error("Today page loaded with an error state.");
    }

    const executionBridgeVisible = bodyText.includes("Execution bridge");
    if (executionBridgeVisible) {
      pass("Execution bridge section is visible");
      for (const text of conditionalExecutionBridgeText) {
        await expectBodyText(page, text);
      }

      const statusText = conditionalExecutionBridgeStatusText.find((text) => bodyText.includes(text));
      if (statusText) {
        pass(`Found Execution bridge status text: ${statusText}`);
      } else {
        skip("Execution bridge status text is not visible; metrics are present");
      }
    } else {
      skip("Execution bridge section is data-dependent and not visible for this account/goal state");
    }

    for (const text of requiredMemoryLoopText) {
      await expectBodyText(page, text);
    }

    if (bodyText.includes("Captured today")) {
      pass("Today reflection state visible: Captured today");
    } else if (bodyText.includes("Not captured yet")) {
      pass("Today reflection state visible: Not captured yet");
    } else {
      throw new Error("Memory loop did not show a Today reflection state.");
    }

    await expect(page.getByText("Open Weekly Review", { exact: true })).toBeVisible({ timeout: 15000 });
    pass("Weekly Review action text is visible but not clicked");

    for (const text of riskyTodayMemoryText) {
      expect(bodyText.toLowerCase()).not.toContain(text.toLowerCase());
      pass(`Did not find risky Today memory text: ${text}`);
    }

    for (const text of riskyExecutionBridgeText) {
      expect(bodyText.toLowerCase()).not.toContain(text.toLowerCase());
      pass(`Did not find risky Today execution bridge text: ${text}`);
    }

    console.log("");
    console.log("Today command center production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
