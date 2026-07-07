#!/usr/bin/env node

// Focused production QA for the read-only Finance safety copy polish.
// This intentionally avoids typing into Finance fields, clicking add/edit/delete/save controls, CRUD, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-finance-prod-error.png";

const requiredFinanceText = [
  /Finance/,
  /manual tracker/i,
  /Not financial advice/i,
  /No bank connection/i,
];

const requiredFinanceSectionText = [
  "Recent Transactions",
  "Budget Health",
  "Accounts",
];

const conditionalFinanceKpiText = [
  "Income",
  "Expenses",
  "Net Cashflow",
  "Budget Used",
];

const riskyFinanceText = [
  "You're spending less than you earn",
  "You're spending more than you earn",
  "getting worse",
  "getting better",
  "financial advisor",
  "prediction",
  "forecast",
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused Finance production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:finance");
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
  console.error("Finance production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Finance text, production may not have deployed the latest commit yet.");
  console.error("");
}

async function expectBodyText(page, text, timeout = 15000) {
  await expect(page.locator("body")).toContainText(text, { timeout });
  pass(`Found text: ${text}`);
}

async function expectVisibleIfPresent(page, bodyText, text) {
  if (!bodyText.includes(text)) {
    pass(`Text not visible in current Finance state: ${text}`);
    return;
  }

  await expect(page.locator("body")).toContainText(text, { timeout: 15000 });
  pass(`Found conditional text: ${text}`);
}

async function assertBodyDoesNotContain(page, bodyText, text) {
  expect(bodyText).not.toContain(text);
  pass(`Did not find risky text: ${text}`);
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
  console.log("=== Life Pulse Finance Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not type into Finance fields, click Finance buttons, or write data.");
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

    await page.goto(`${BASE}/finance`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/finance/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Finance");
    await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible({ timeout: 20000 });
    pass("Finance page loaded");

    for (const text of requiredFinanceText) {
      await expectBodyText(page, text);
    }

    for (const text of requiredFinanceSectionText) {
      await expectBodyText(page, text);
    }

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Finance page loaded with an error state.");
    }

    for (const text of conditionalFinanceKpiText) {
      await expectVisibleIfPresent(page, bodyText, text);
    }

    for (const text of riskyFinanceText) {
      await assertBodyDoesNotContain(page, bodyText, text);
    }

    console.log("");
    console.log("Finance production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
