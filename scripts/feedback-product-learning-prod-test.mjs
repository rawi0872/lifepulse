#!/usr/bin/env node
import { chromium, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(filepath) {
  if (!existsSync(filepath)) return {};
  const vars = {};
  for (const line of readFileSync(filepath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

const env = { ...loadEnv(resolve(__dirname, "..", ".env.test.local")), ...process.env };
const BASE = env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

function pass(label) { console.log(`  PASS ${label}`); }

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ body: document.body.scrollWidth, doc: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.inner + 2);
  expect(metrics.doc).toBeLessThanOrEqual(metrics.inner + 2);
  pass(`${label} has no horizontal overflow`);
}

async function openFeedback(page) {
  const button = page.getByRole("button", { name: /Feedback|Send feedback/ }).first();
  await expect(button).toBeVisible({ timeout: 15000 });
  await button.click();
  await expect(page.getByRole("heading", { name: "Private beta feedback" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Tell us what felt broken, confusing, useful, or missing.")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#feedback-message")).toBeVisible({ timeout: 10000 });
}

async function runViewport(width, height) {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await openFeedback(page);
    await assertNoOverflow(page, `${width}px feedback dialog`);

    await page.route("**/api/feedback", async (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "test failure" }) }));
    await page.locator("#feedback-message").fill("This is explicit beta feedback from a QA test.");
    await page.getByRole("button", { name: "Send feedback", exact: true }).click();
    await expect(page.getByText("Could not send feedback. Please try again.")).toBeVisible({ timeout: 10000 });
    pass(`${width}px feedback failure state visible`);
    await page.unroute("**/api/feedback");

    await page.route("**/api/feedback", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
    await page.getByRole("button", { name: "Send feedback", exact: true }).click();
    await expect(page.getByText("Feedback sent. Thank you!")).toBeVisible({ timeout: 10000 });
    pass(`${width}px feedback success state visible`);
  } finally {
    await browser.close();
  }
}

async function main() {
  requireConfig();
  console.log("\n=== Feedback Product Learning QA ===");
  console.log(`Base URL: ${BASE}`);
  await runViewport(390, 844);
  await runViewport(320, 740);
  console.log("\nFeedback product learning QA passed.\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
