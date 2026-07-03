#!/usr/bin/env node

// Focused production QA for Life Pulse onboarding personalization.
// This intentionally avoids broad save-flow checks from prod-smoke-test.mjs.

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
const CREATE_DISPOSABLE = env.LIFE_PULSE_ONBOARDING_CREATE_DISPOSABLE === "true";
const ALLOW_MAIN_ACCOUNT = env.LIFE_PULSE_ONBOARDING_ALLOW_MAIN_ACCOUNT === "true";
const SHOULD_TEST_SETTINGS_UPDATE = env.LIFE_PULSE_ONBOARDING_TEST_SETTINGS_UPDATE === "true";

const MAIN_SMOKE_EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PROVIDED_EMAIL = env.LIFE_PULSE_ONBOARDING_TEST_EMAIL;
const PROVIDED_PASSWORD = env.LIFE_PULSE_ONBOARDING_TEST_PASSWORD;
const DISPOSABLE_DOMAIN = env.LIFE_PULSE_ONBOARDING_DISPOSABLE_EMAIL_DOMAIN;
const DISPOSABLE_PASSWORD = env.LIFE_PULSE_ONBOARDING_DISPOSABLE_PASSWORD || PROVIDED_PASSWORD;

const TEST_EMAIL = CREATE_DISPOSABLE
  ? `lifepulse-onboarding-${Date.now()}@${DISPOSABLE_DOMAIN || ""}`
  : PROVIDED_EMAIL;
const TEST_PASSWORD = CREATE_DISPOSABLE ? DISPOSABLE_PASSWORD : PROVIDED_PASSWORD;

const results = [];
const ERROR_SCREENSHOT_PATH = "screenshot-onboarding-personalization-prod-error.png";

function pass(label) {
  results.push({ status: "PASS", label });
  console.log(`  PASS ${label}`);
}

function fail(label, detail = "") {
  results.push({ status: "FAIL", label, detail });
  console.log(`  FAIL ${label}${detail ? ` - ${detail}` : ""}`);
}

function step(label) {
  console.log(`  STEP ${label}`);
}

function requireConfig() {
  const missing = [];
  if (CREATE_DISPOSABLE) {
    if (!DISPOSABLE_DOMAIN) missing.push("LIFE_PULSE_ONBOARDING_DISPOSABLE_EMAIL_DOMAIN");
    if (!TEST_PASSWORD) missing.push("LIFE_PULSE_ONBOARDING_DISPOSABLE_PASSWORD or LIFE_PULSE_ONBOARDING_TEST_PASSWORD");
  } else {
    if (!TEST_EMAIL) missing.push("LIFE_PULSE_ONBOARDING_TEST_EMAIL");
    if (!TEST_PASSWORD) missing.push("LIFE_PULSE_ONBOARDING_TEST_PASSWORD");
  }

  if (missing.length > 0) {
    console.error("");
    console.error("Focused onboarding production QA requires a dedicated onboarding test account.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Option A: provide an existing non-onboarded account:");
    console.error("  LIFE_PULSE_ONBOARDING_TEST_EMAIL=...");
    console.error("  LIFE_PULSE_ONBOARDING_TEST_PASSWORD=...");
    console.error("");
    console.error("Option B: explicitly create a disposable account if production email confirmation allows immediate sessions:");
    console.error("  LIFE_PULSE_ONBOARDING_CREATE_DISPOSABLE=true");
    console.error("  LIFE_PULSE_ONBOARDING_DISPOSABLE_EMAIL_DOMAIN=example.com");
    console.error("  LIFE_PULSE_ONBOARDING_DISPOSABLE_PASSWORD=...");
    console.error("");
    process.exit(2);
  }

  if (!CREATE_DISPOSABLE && MAIN_SMOKE_EMAIL && TEST_EMAIL === MAIN_SMOKE_EMAIL && !ALLOW_MAIN_ACCOUNT) {
    console.error("");
    console.error("Refusing to run against LIFE_PULSE_TEST_EMAIL by default.");
    console.error("Use a dedicated onboarding test account, or set LIFE_PULSE_ONBOARDING_ALLOW_MAIN_ACCOUNT=true if you intentionally want to mutate the main smoke-test account.");
    console.error("");
    process.exit(2);
  }
}

async function waitForVisibleText(page, text, timeout = 15000) {
  step(`Waiting for visible text: ${text}`);
  await expect(page.getByText(text).first()).toBeVisible({ timeout });
}

async function waitForBodyToContain(page, text, timeout = 15000) {
  step(`Waiting for page text: ${text}`);
  await expect(page.locator("body")).toContainText(text, { timeout });
}

async function clickContinue(page) {
  const button = page.locator('button:has-text("Continue")').first();
  await button.waitFor({ state: "visible", timeout: 10000 });
  await button.click();
}

async function signUpDisposable(page) {
  step("Opening signup for disposable onboarding account");
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator("#firstName").fill("Onboarding");
  await page.locator("#lastName").fill("QA");
  await page.locator("#birthDate").fill("1990-01-01");
  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  if (page.url().includes("/onboarding")) {
    pass("Disposable signup reached onboarding");
    return;
  }

  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  if (bodyText.includes("Check your email")) {
    throw new Error("Signup requires email confirmation, so disposable immediate onboarding is not available for this environment.");
  }

  throw new Error(`Disposable signup did not reach onboarding. Current URL: ${page.url()}`);
}

async function loginDedicatedAccount(page) {
  step("Opening login for dedicated onboarding account");
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(8000);

  if (page.url().includes("/today")) {
    throw new Error("Dedicated onboarding account is already onboarded. Use a fresh/non-onboarded account for this focused QA.");
  }

  if (!page.url().includes("/onboarding")) {
    throw new Error(`Login did not reach onboarding. Current URL: ${page.url()}`);
  }

  pass("Dedicated account login reached onboarding");
}

async function completeOnboarding(page) {
  await waitForVisibleText(page, "Build your personal operating system");
  pass("Onboarding welcome step loaded");
  await clickContinue(page);

  await waitForVisibleText(page, "What are you using Life Pulse for?");
  await waitForVisibleText(page, "Personal life");
  await waitForVisibleText(page, "Business / entrepreneurship");
  await waitForVisibleText(page, "Team / organization");
  await waitForVisibleText(page, "Mixed use");
  pass("Intended-use question and all options visible");

  const blockedButton = page.locator('button:has-text("Choose setup")').first();
  await blockedButton.waitFor({ state: "visible", timeout: 10000 });
  if (!(await blockedButton.isDisabled())) {
    throw new Error("Setup step can continue before intended use is selected.");
  }
  pass("Cannot continue without intended-use selection");

  await page.locator('button:has-text("Personal life")').first().click();
  pass("Selected Personal life");
  await waitForVisibleText(page, "Recommended starting areas");
  await waitForBodyToContain(page, "Life Pulse will emphasize these areas first");
  for (const moduleLabel of ["Today", "Habits", "Journal", "Goals"]) {
    await waitForVisibleText(page, moduleLabel);
  }
  await waitForBodyToContain(page, "Available");
  await waitForBodyToContain(page, "Preview");
  pass("Personal setup module recommendation preview is visible");
  await clickContinue(page);

  await waitForVisibleText(page, "These are the areas your progress will be organized around");
  await waitForVisibleText(page, "Mind");
  await waitForVisibleText(page, "Body");
  pass("Realm selection still appears");
  await clickContinue(page);

  await waitForVisibleText(page, "Each day, Life Pulse guides you through a simple rhythm");
  pass("Daily Loop step still appears");
  await clickContinue(page);

  await waitForVisibleText(page, "Enter my dashboard");
  await page.locator('button:has-text("Enter my dashboard")').click();
  step("Waiting for onboarding redirect to /today");
  await page.waitForURL(/\/today/, { timeout: 30000 });
  pass("Onboarding completed and redirected to /today");
}

async function verifyToday(page, expectedCopy = "Personal OS - Daily rhythm") {
  step("Opening Today page for post-onboarding verification");
  await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForURL(/\/today/, { timeout: 30000 });
  step("Waiting for stable Today page header");
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible({ timeout: 20000 });
  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  if (bodyText.includes("Failed to load dashboard") || bodyText.includes("Application error")) {
    throw new Error("Today loaded with an error state.");
  }
  await waitForBodyToContain(page, expectedCopy);
  pass(`Today loads with expected copy: ${expectedCopy}`);
}

async function verifySettings(page) {
  step("Opening Settings page for setup verification");
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForURL(/\/settings/, { timeout: 30000 });
  await waitForVisibleText(page, "Settings");
  await waitForVisibleText(page, "Life Pulse setup");
  await waitForVisibleText(page, "Starting mode");
  pass("Settings shows Life Pulse setup card");

  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  if (bodyText.includes("Application error")) {
    throw new Error("Settings loaded with an application error.");
  }

  if (!SHOULD_TEST_SETTINGS_UPDATE) {
    console.log("  SKIP Settings mode update not run. Set LIFE_PULSE_ONBOARDING_TEST_SETTINGS_UPDATE=true to mutate the dedicated test account.");
    return;
  }

  await page.locator("select").selectOption("business");
  await page.locator('button:has-text("Save setup")').click();
  await waitForBodyToContain(page, "Setup preference saved.", 10000);
  pass("Settings can save starting mode");

  await verifyToday(page, "Business focus - Daily execution");
}

async function main() {
  requireConfig();

  console.log("");
  console.log("=== Life Pulse Onboarding Personalization Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Account strategy: ${CREATE_DISPOSABLE ? "disposable signup" : "provided dedicated account"}`);
  console.log(`Test account: ${TEST_EMAIL}`);
  console.log("This full onboarding path mutates the account. Reset onboarding_completed=false before rerunning with the same dedicated account.");
  console.log("");

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    if (CREATE_DISPOSABLE) {
      await signUpDisposable(page);
    } else {
      await loginDedicatedAccount(page);
    }

    await completeOnboarding(page);
    await verifyToday(page);
    await verifySettings(page);

    console.log("");
    console.log("=== Result: PASS ===");
  } catch (error) {
    fail("Focused onboarding personalization QA", error.message);
    const title = await page.title().catch(() => "<unavailable>");
    console.log(`  DIAG Current URL: ${page.url()}`);
    console.log(`  DIAG Page title: ${title}`);
    await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true });
    console.log(`  DIAG Screenshot: ${ERROR_SCREENSHOT_PATH}`);
    console.log("  NOTE Reset the dedicated QA account before rerunning the full onboarding path.");
    console.log("");
    console.log("=== Result: FAIL ===");
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
