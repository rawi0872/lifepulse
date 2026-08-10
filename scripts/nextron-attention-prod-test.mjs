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

const env = { ...loadEnv(resolve(__dirname, "..", ".env.test.local")), ...process.env };
const BASE = env.LIFE_PULSE_BASE_URL || env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;
const viewports = [1440, 1280, 1024, 768, 430, 390, 360, 320];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(7000);
  if (page.url().includes("/login")) {
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(7000);
  }
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ body: document.body.scrollWidth, doc: document.documentElement.scrollWidth, inner: window.innerWidth }));
  if (metrics.body > metrics.inner + 2 || metrics.doc > metrics.inner + 2) throw new Error(`${label} horizontal overflow: body=${metrics.body}, doc=${metrics.doc}, viewport=${metrics.inner}`);
  pass(`${label} has no horizontal overflow`);
}

async function assertAuthenticated(page, label) {
  if (page.url().includes("/login")) throw new Error(`${label} redirected to login.`);
  if (page.url().includes("/onboarding")) throw new Error(`${label} redirected to onboarding.`);
}

async function verifyNextronAttention(page, label) {
  await page.goto(`${BASE}/nextron`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await assertAuthenticated(page, label);
  await expect(page.locator('[data-nextron-attention="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator("body")).toContainText("NEXTRON Noticed", { timeout: 30000 });
  await expect(page.locator("body")).toContainText("Model calls: 0", { timeout: 30000 });
  await assertNoOverflow(page, `${label} NEXTRON attention`);
}

async function verifyTodayAttention(page, label) {
  await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await assertAuthenticated(page, label);
  await expect(page.locator('[data-today-nextron-attention="true"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator("body")).toContainText("NEXTRON Noticed", { timeout: 30000 });
  await expect(page.locator("body")).toContainText("Model calls: 0", { timeout: 30000 });
  await assertNoOverflow(page, `${label} Today attention`);
}

async function main() {
  requireConfig();
  console.log("\n=== NEXTRON Attention Production QA ===");
  console.log(`Base URL: ${BASE}`);
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    for (const width of viewports) {
      const context = await browser.newContext({ viewport: { width, height: width <= 430 ? 820 : 960 } });
      const page = await context.newPage();
      await login(page);
      await verifyNextronAttention(page, `${width}px`);
      await verifyTodayAttention(page, `${width}px`);
      if (width === 1440) {
        const askLink = page.locator('[data-today-nextron-attention="true"]').getByRole("link", { name: "Ask NEXTRON" }).first();
        if (await askLink.isVisible().catch(() => false)) {
          await askLink.click();
          await expect(page).toHaveURL(/\/nextron\?subject=today/, { timeout: 30000 });
          await expect(page.locator("#nextron-question")).not.toHaveValue("", { timeout: 15000 });
          pass("Today attention bridges to a normal NEXTRON draft ask");
        } else {
          pass("Today attention calm state has no Ask bridge to test");
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log("NEXTRON Attention production QA passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
