#!/usr/bin/env node

// Focused production QA for the read-only Settings module configuration section.
// This intentionally avoids onboarding, save flows, CRUD, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-settings-modules-prod-error.png";

const requiredModuleLabels = [
  "Today",
  "Tasks",
  "Habits",
  "Journal",
  "Coach",
  "Devices",
  "Business",
  "Team",
  "Smartocaster",
  "Wearables",
  "Morning Briefing",
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused Settings modules production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:settings-modules");
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
  console.error("Settings modules production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
}

async function expectBodyText(page, text, timeout = 15000) {
  await expect(page.locator("body")).toContainText(text, { timeout });
  pass(`Found text: ${text}`);
}

async function main() {
  requireConfig();

  console.log("");
  console.log("=== Life Pulse Settings Modules Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not click Save, change setup mode, or write data.");
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

    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/settings/, { timeout: 30000 });
    if (page.url().includes("/login")) {
      const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "<unavailable>");
      throw new Error(`Settings redirected to login. Current URL: ${page.url()}. Body excerpt: ${bodyText.slice(0, 300)}`);
    }
    if (page.url().includes("/onboarding")) {
      throw new Error("Smoke-test account is not onboarded. Use an existing onboarded LIFE_PULSE_TEST_EMAIL account for this read-only Settings check.");
    }
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 });
    pass("Settings page loaded");

    await expectBodyText(page, "System control");
    await expectBodyText(page, "Preferences");
    await expectBodyText(page, "Life Pulse setup");
    await expectBodyText(page, "Progression");
    await expectBodyText(page, "How XP works");
    await expectBodyText(page, "Modules / system");
    await expectBodyText(page, "Life Pulse modules");
    await expectBodyText(page, "Your starting mode recommends areas to keep visible.");
    await expectBodyText(page, "Recommended for your starting mode");
    await expectBodyText(page, "System map");
    await expectBodyText(page, "Connected areas");
    await expectBodyText(page, "Account / security");
    await expectBodyText(page, "Available");
    await expectBodyText(page, "Preview");
    await expectBodyText(page, "Planned");

    for (const label of requiredModuleLabels) {
      await expectBodyText(page, label);
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });

    if (bodyText.includes("Application error") || bodyText.includes("Failed to")) {
      throw new Error("Settings page loaded with an error state.");
    }

    console.log("");
    console.log("Settings modules production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
