#!/usr/bin/env node

// Focused production QA for the read-only Goals action-link visibility UI.
// This intentionally avoids goal/link creation, editing, deletion, form submission, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-goals-prod-error.png";

const requiredGoalsText = [
  "Goal Pulse",
  "Long-term outcomes that matter",
  "Active Goals",
  "Completed",
  "Add a goal",
];

const riskyGoalText = [
  "goal health",
  "success score",
  "failure",
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
    console.error("Focused Goals production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:goals");
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
  console.error("Goals production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Goals action-link text, production may not have deployed the latest commit yet.");
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
  console.log("=== Life Pulse Goals Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not create, edit, delete, link, unlink, or submit goal data.");
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

    await page.goto(`${BASE}/goals`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/goals/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Goals");
    await expect(page.getByRole("heading", { name: "Goal Pulse", exact: true })).toBeVisible({ timeout: 20000 });
    pass("Goals page loaded");

    for (const text of requiredGoalsText) {
      await expectBodyText(page, text);
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Goals page loaded with an error state.");
    }

    const hasNoGoalsState = bodyText.includes("No goals yet");
    const supportsCount = await page.getByText(/^Supports:/).count();
    const noActionLinksCount = await page.getByText("No action links yet", { exact: true }).count();

    if (hasNoGoalsState) {
      skip("Goals action-link visibility is data-dependent and not visible for this account/goal state");
    } else {
      pass("Goal cards/list rows are visible");
      if (supportsCount === 0 && noActionLinksCount === 0) {
        throw new Error("Goal cards are visible, but neither Supports: nor No action links yet was found.");
      }
      if (supportsCount > 0) {
        pass(`Goals support action-link text is visible: ${supportsCount} row(s)`);
      }
      if (noActionLinksCount > 0) {
        pass(`Goals no-action-links text is visible: ${noActionLinksCount} row(s)`);
      }
    }

    const finalBodyText = await page.locator("body").innerText({ timeout: 10000 });
    for (const text of riskyGoalText) {
      expect(finalBodyText.toLowerCase()).not.toContain(text.toLowerCase());
      pass(`Did not find risky Goals text: ${text}`);
    }

    console.log("");
    console.log("Goals production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
