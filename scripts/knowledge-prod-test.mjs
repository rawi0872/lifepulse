#!/usr/bin/env node

// Focused production QA for the read-only Knowledge search and filter UI.
// This intentionally avoids creating, deleting, submitting forms, or writing data.

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
const ERROR_SCREENSHOT_PATH = "screenshot-knowledge-prod-error.png";

const requiredKnowledgeText = [
  "Knowledge",
  "Overview",
  "Add Knowledge",
  "Collections",
  "Recent Items",
];

const requiredSearchFilterText = [
  "All types",
  "All categories",
  "Showing",
  "Private manual knowledge library. No AI summaries or external processing.",
];

const riskyKnowledgeText = [
  "AI memory",
  "vector",
  "embeddings",
  "document upload",
  "file parsing",
  "public sharing",
  "external AI processing",
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Focused Knowledge production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:knowledge");
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

async function failWithDiagnostics(page, error) {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "<unavailable>");
  await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true }).catch(() => undefined);

  console.error("");
  console.error("Knowledge production QA failed.");
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
  console.error("If this failure is for newly added Knowledge text, production may not have deployed the latest commit yet.");
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
  console.log("=== Life Pulse Knowledge Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: this script only clicks tabs and changes local search/filter controls.");
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

    await page.goto(`${BASE}/knowledge`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/knowledge/, { timeout: 30000 });
    await assertAuthenticatedRoute(page, "Knowledge");
    await expect(page.getByRole("heading", { name: "Knowledge", exact: true })).toBeVisible({ timeout: 20000 });
    pass("Knowledge page loaded");

    for (const text of requiredKnowledgeText) {
      await expectBodyText(page, text);
    }

    await page.getByRole("button", { name: "Recent Items" }).click();
    pass("Opened Recent Items tab");

    const bodyText = await page.locator("body").innerText({ timeout: 10000 });
    if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
      throw new Error("Knowledge page loaded with an error state.");
    }

    if (bodyText.includes("No knowledge items yet")) {
      info("Search/filter controls are data-dependent and not visible because this account has no knowledge items.");
    } else {
      await expect(page.getByPlaceholder("Search knowledge...")).toBeVisible({ timeout: 15000 });
      pass("Search input is visible");

      for (const text of requiredSearchFilterText) {
        await expectBodyText(page, text);
      }

      const searchInput = page.getByPlaceholder("Search knowledge...");
      await searchInput.fill("zzz-no-match-prod-qa");
      pass("Typed harmless local-only search query");

      const searchedBodyText = await page.locator("body").innerText({ timeout: 10000 });
      if (searchedBodyText.includes("No matching knowledge found.")) {
        pass("No-match empty state is visible");
      } else {
        expect(searchedBodyText).toContain("Showing");
        pass("Result count remains visible after search");
      }

      await searchInput.fill("");
      pass("Cleared local-only search query");

      const filters = page.locator("select");
      const filterCount = await filters.count();
      if (filterCount > 0 && await filters.nth(0).locator("option").count() > 1) {
        await filters.nth(0).selectOption({ index: 1 });
        pass("Changed type filter without submitting data");
      }
      if (filterCount > 1 && await filters.nth(1).locator("option").count() > 1) {
        await filters.nth(1).selectOption({ index: 1 });
        pass("Changed category filter without submitting data");
      }
    }

    const finalBodyText = await page.locator("body").innerText({ timeout: 10000 });
    for (const text of riskyKnowledgeText) {
      expect(finalBodyText.toLowerCase()).not.toContain(text.toLowerCase());
      pass(`Did not find risky Knowledge text: ${text}`);
    }

    console.log("");
    console.log("Knowledge production QA passed.");
    console.log("");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
