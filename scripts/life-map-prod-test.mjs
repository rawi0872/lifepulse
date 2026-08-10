#!/usr/bin/env node

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
const ERROR_SCREENSHOT_PATH = "screenshot-life-map-prod-error.png";

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");
  if (missing.length > 0) {
    console.error(`Life Map production QA missing env vars: ${missing.join(", ")}`);
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

async function failWithDiagnostics(page, error) {
  await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true }).catch(() => undefined);
  console.error("Life Map production QA failed.");
  console.error(`Current URL: ${page.url()}`);
  console.error(`Screenshot: ${ERROR_SCREENSHOT_PATH}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
}

async function main() {
  requireConfig();
  console.log("\n=== Life Map Production QA ===");
  console.log(`Base URL: ${BASE}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let nextronCalls = 0;
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/nextron/ask") || url.includes("/api/nextron/daily-brief")) nextronCalls += 1;
  });

  try {
    await page.goto(`${BASE}/life-map`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    pass("/life-map is auth protected before login");

    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    pass("Submitted smoke-test account login");

    const viewports = [
      { width: 1440, height: 950 },
      { width: 1280, height: 900 },
      { width: 1024, height: 900 },
      { width: 768, height: 900 },
      { width: 430, height: 900 },
      { width: 390, height: 860 },
      { width: 360, height: 820 },
      { width: 320, height: 780 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto(`${BASE}/life-map`, { waitUntil: "networkidle", timeout: 30000 });
      await expect(page.getByRole("heading", { name: /Your explicit operating graph/i })).toBeVisible({ timeout: 20000 });
      await expect(page.getByText("No background AI")).toBeVisible({ timeout: 15000 });
      const body = page.locator("body");
      await expect(body).toContainText(/Connected Paths|No map yet/i, { timeout: 15000 });
      await expect(body).toContainText(/Goal|No map yet|No explicit support connected yet|Focus Mode/i, { timeout: 15000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      if (overflow) throw new Error(`Horizontal overflow at ${viewport.width}px`);
      pass(`Life Map renders without overflow at ${viewport.width}px`);
    }

    if (nextronCalls !== 0) throw new Error(`Life Map render triggered ${nextronCalls} NEXTRON provider routes`);
    pass("Life Map render made zero NEXTRON provider-route calls");
  } catch (error) {
    await failWithDiagnostics(page, error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log("Life Map production QA passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
