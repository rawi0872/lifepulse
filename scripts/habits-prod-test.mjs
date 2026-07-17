#!/usr/bin/env node

// Focused production QA for the read-only Habits goal context UI.
// This intentionally avoids habit/goal/link creation, editing, deletion, completion, form submission, and database writes.

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
const ERROR_SCREENSHOT_PATH = "screenshot-habits-prod-error.png";

const requiredHabitsText = [
  "Habits",
  "Add habit",
];

const acceptableHabitsHeaderCopy = [
  "Build the routines your future self depends on.",
  "Track the repeat actions you want to make automatic.",
  "Choose one small repeatable action and complete it today to keep the loop alive.",
];

const riskyHabitText = [
  "habit health",
  "success score",
  "failure",
  "bad habit",
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
    console.error("Focused Habits production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:habits");
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
  console.error("Habits production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Habits goal context text, production may not have deployed the latest commit yet.");
  console.error("");
}

async function expectBodyText(page, text, timeout = 15000) {
  await expect(page.locator("body")).toContainText(text, { timeout });
  pass(`Found text: ${text}`);
}

async function expectAnyBodyText(page, texts, timeout = 15000) {
  const bodyText = await page.locator("body").innerText({ timeout });
  const matched = texts.find((text) => bodyText.includes(text));
  if (!matched) {
    throw new Error(`Expected one of these texts: ${texts.join(" | ")}`);
  }
  pass(`Found acceptable text: ${matched}`);
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
  console.log("=== Life Pulse Habits Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script does not create, edit, delete, complete, link, unlink, or submit habit data.");
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

    await page.goto(`${BASE}/habits`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/habits/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Habits");
    await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible({ timeout: 20000 });
    pass("Habits page loaded");

    for (const text of requiredHabitsText) {
      await expectBodyText(page, text);
    }
    await expectAnyBodyText(page, acceptableHabitsHeaderCopy);

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Habits page loaded with an error state.");
    }

    const hasNoHabitsState = bodyText.includes("Start with one small repeatable action.");
    const goalContextCount = await page.getByText(/^Goal:\s+.+/).count();
    const supportsGoalsCount = await page.getByText(/^Supports goals:\s+.+/).count();
    const noLinkedGoalsCount = await page.getByText("No linked goals yet", { exact: true }).count();

    if (hasNoHabitsState) {
      skip("Habits goal context is data-dependent and not visible for this account/habit state");
    } else {
      pass("Habit cards/list rows are visible");
      if (goalContextCount === 0 && supportsGoalsCount === 0 && noLinkedGoalsCount === 0) {
        throw new Error("Habit cards are visible, but no habit goal context text was found.");
      }
      if (goalContextCount > 0) {
        pass(`Habit linked goal text is visible: ${goalContextCount} row(s)`);
      }
      if (supportsGoalsCount > 0) {
        pass(`Habit supports-goals text is visible: ${supportsGoalsCount} row(s)`);
      }
      if (noLinkedGoalsCount > 0) {
        pass(`Habit no-linked-goals text is visible: ${noLinkedGoalsCount} row(s)`);
      }
    }

    const finalBodyText = await page.locator("body").innerText({ timeout: 10000 });
    for (const text of riskyHabitText) {
      expect(finalBodyText.toLowerCase()).not.toContain(text.toLowerCase());
      pass(`Did not find risky Habits text: ${text}`);
    }

    console.log("");
    console.log("Habits production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
