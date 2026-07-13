#!/usr/bin/env node

// Focused production QA for the read-only authenticated navigation polish.
// This intentionally avoids nav clicks, form submission, CRUD, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-navigation-prod-error.png";

const requiredGroupText = ["Core", "Build later", "Track later", "Review later", "Preview", "System"];

const requiredNavText = [
  "Today",
  "Coach",
  "Weekly Review",
  "Goals",
  "Projects",
  "Tasks",
  "Habits",
  "Body",
  "Mind",
  "Passions",
  "Finance",
  "Journal",
  "Insights",
  "Devices",
  "Settings",
];

const removedNavText = ["Today\u2019s Pulse", "Life Domains", "Money"];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused navigation production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:navigation");
    console.error("");
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

async function failWithDiagnostics(page, error) {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "<unavailable>");
  await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true }).catch(() => undefined);

  console.error("");
  console.error("Navigation production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added navigation text, production may not have deployed the latest commit yet.");
  console.error("");
}

async function expectNavText(sidebar, text, timeout = 15000) {
  await expect(sidebar).toContainText(text, { timeout });
  pass(`Found nav text: ${text}`);
}

async function expectNavTextAbsent(sidebar, text, timeout = 5000) {
  await expect(sidebar).not.toContainText(text, { timeout });
  pass(`Old nav text absent: ${text}`);
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
  console.log("=== Life Pulse Navigation Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script verifies the desktop sidebar without clicking nav links or writing data.");
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
    await assertAuthenticatedRoute(page, "Today");

    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible({ timeout: 20000 });
    await expect(sidebar.getByText("Life Pulse", { exact: true })).toBeVisible({ timeout: 15000 });
    pass("Authenticated desktop sidebar is visible");

    for (const text of requiredGroupText) {
      await expectNavText(sidebar, text);
    }

    for (const text of requiredNavText) {
      await expectNavText(sidebar, text);
    }

    for (const text of removedNavText) {
      await expectNavTextAbsent(sidebar, text);
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Authenticated navigation loaded with an error state.");
    }

    console.log("");
    console.log("Navigation production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
