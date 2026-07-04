#!/usr/bin/env node

// Focused production QA for the read-only Weekly Review and Insights polish.
// This intentionally avoids reflection saves, form submission, CRUD, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-weekly-insights-prod-error.png";

const requiredWeeklyReviewText = [
  "Weekly Review",
  "Reset, reflect, and choose what deserves attention next week.",
  "This week at a glance",
  "Body and mind signals",
  "Execution and progress",
  "Creative and personal energy",
  "Weekly reset",
  "Next week focus",
];

const requiredInsightsText = [
  "Life Pulse Insights",
  "Patterns across your activity, consistency, and active life areas.",
  "Pattern snapshot",
  "Current momentum",
  "Consistency pattern",
  "Streak health",
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused Weekly/Insights production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:weekly-insights");
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
  console.error("Weekly/Insights production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Weekly Review or Insights text, production may not have deployed the latest commit yet.");
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
  console.log("=== Life Pulse Weekly/Insights Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not submit reflections, click Save to Journal, or write data.");
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

    await page.goto(`${BASE}/weekly-review`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/weekly-review/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Weekly Review");
    await expect(page.getByRole("heading", { name: "Weekly Review" })).toBeVisible({ timeout: 20000 });
    pass("Weekly Review page loaded");

    for (const text of requiredWeeklyReviewText) {
      await expectBodyText(page, text);
    }

    await expect(page.getByRole("button", { name: "Save to Journal" })).toBeVisible({ timeout: 15000 });
    pass("Save to Journal button is visible but not clicked");

    await page.goto(`${BASE}/insights`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/insights/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Insights");
    await expect(page.getByRole("heading", { name: "Life Pulse Insights" })).toBeVisible({ timeout: 20000 });
    pass("Insights page loaded");

    for (const text of requiredInsightsText) {
      await expectBodyText(page, text);
    }

    const financeSignalCount = await page.getByText("Finance signal", { exact: true }).count();
    if (financeSignalCount > 0) {
      pass("Finance signal section is visible");
    } else {
      skip("Finance signal section is not visible for this account/data state");
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Weekly Review or Insights loaded with an error state.");
    }

    console.log("");
    console.log("Weekly/Insights production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
