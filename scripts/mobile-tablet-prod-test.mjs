#!/usr/bin/env node

// Read-only production QA for mobile, tablet, and desktop browser readiness.
// This verifies authenticated route loads, mobile navigation basics, and horizontal overflow only.

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

const BASE = env.LIFE_PULSE_BASE_URL || env.LIFE_PULSE_PROD_BASE_URL || "https://lifepulse-sand.vercel.app";
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;
const OVERFLOW_TOLERANCE_PX = 2;

const viewports = [
  { name: "phone", width: 390, height: 844, expectsMobileNav: true },
  { name: "tablet", width: 768, height: 1024, expectsMobileNav: false },
  { name: "desktop", width: 1280, height: 900, expectsMobileNav: false },
];

const routes = [
  { path: "/today", label: "Today", text: ["Good ", "Daily focus", "Start with one priority.", "Quick capture", "Daily execution"] },
  { path: "/tasks", label: "Tasks", text: ["Tasks"] },
  { path: "/habits", label: "Habits", text: ["Habits"] },
  { path: "/goals", label: "Goals", text: ["Goals"] },
  { path: "/projects", label: "Projects", text: ["Projects"] },
  { path: "/journal", label: "Journal", text: ["Journal"] },
  { path: "/knowledge", label: "Knowledge", text: ["Knowledge"] },
  { path: "/weekly-review", label: "Weekly Review", text: ["Weekly Review"] },
  { path: "/insights", label: "Insights", text: ["Insights"] },
  { path: "/coach", label: "Coach", text: ["Coach"] },
  { path: "/body", label: "Body", text: ["Body"] },
  { path: "/mind", label: "Mind", text: ["Mind Pulse", "Mind Habits", "Log Today's Mind Data"] },
  { path: "/finance", label: "Finance", text: ["Finance"] },
  { path: "/passions", label: "Passions", text: ["Passions", "Your hobbies, skills, and creative pursuits", "Active Passions"] },
  { path: "/settings", label: "Settings", text: ["Settings", "Profile", "Save setup"] },
  { path: "/devices", label: "Devices", text: ["Device Pulse", "Coming Soon", "No devices connected"] },
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error("");
    console.error("Mobile/tablet/desktop production QA requires the smoke-test account credentials.");
    console.error("Missing env vars:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("");
    console.error("Provide them in .env.test.local or the shell, then run:");
    console.error("  npm run test:prod:mobile-tablet");
    console.error("");
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

async function failWithDiagnostics(page, viewportName, label, error) {
  const currentUrl = page.url();
  const title = await page.title().catch(() => "<unavailable>");
  const screenshot = `screenshot-mobile-tablet-${viewportName}-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-error.png`;
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);

  console.error("");
  console.error("Mobile/tablet/desktop production QA failed.");
  console.error(`Viewport: ${viewportName}`);
  console.error(`Route/check: ${label}`);
  console.error(`Current URL: ${currentUrl}`);
  console.error(`Page title: ${title}`);
  console.error(`Screenshot: ${screenshot}`);
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  console.error("");
}

async function assertAuthenticatedRoute(page, routeName) {
  if (page.url().includes("/login")) {
    const bodyText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "<unavailable>");
    throw new Error(`${routeName} redirected to login. Current URL: ${page.url()}. Body excerpt: ${bodyText.slice(0, 300)}`);
  }
  if (page.url().includes("/onboarding")) {
    throw new Error(`Smoke-test account is not onboarded. Use an existing onboarded LIFE_PULSE_TEST_EMAIL account for ${routeName}.`);
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  pass("Submitted smoke-test account login");
}

async function expectAnyBodyText(page, candidates, label) {
  await expect
    .poll(async () => {
      const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
      const normalizedBodyText = bodyText.toLowerCase();
      return candidates.some((text) => normalizedBodyText.includes(text.toLowerCase()));
    }, { timeout: 30000, message: `${label} should show stable route text` })
    .toBe(true);
  pass(`${label} stable route text is visible`);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  const maxAllowed = metrics.innerWidth + OVERFLOW_TOLERANCE_PX;
  if (metrics.docScrollWidth > maxAllowed || metrics.bodyScrollWidth > maxAllowed) {
    throw new Error(
      `${label} horizontal overflow: document=${metrics.docScrollWidth}, body=${metrics.bodyScrollWidth}, viewport=${metrics.innerWidth}`,
    );
  }

  pass(`${label} has no horizontal overflow (${metrics.innerWidth}px viewport)`);
}

async function verifyMobileNavigation(page) {
  const bottomNav = page.locator("nav").filter({ hasText: "More" }).last();
  await expect(bottomNav).toBeVisible({ timeout: 15000 });
  await expect(bottomNav.getByRole("link", { name: /^Today$/ })).toBeVisible({ timeout: 15000 });
  await expect(bottomNav.getByRole("link", { name: /^Tasks$/ })).toBeVisible({ timeout: 15000 });
  await expect(bottomNav.getByRole("link", { name: /^Habits$/ })).toBeVisible({ timeout: 15000 });
  await expect(bottomNav.getByRole("link", { name: /^Journal$/ })).toBeVisible({ timeout: 15000 });
  pass("Phone bottom navigation is visible");

  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: "More" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("link", { name: /^Goals$/ })).toBeVisible({ timeout: 15000 });
  pass("Phone More menu opens and shows secondary routes");

  await page.getByRole("button", { name: "Close more menu" }).click();
  await expect(page.getByRole("heading", { name: "More" })).toBeHidden({ timeout: 15000 });
  pass("Phone More menu closes");
}

function routeUrlPattern(path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
  return new RegExp(`${escaped}\/?(?:$|[?#])`);
}

async function runViewport(browser, viewport) {
  console.log("");
  console.log(`--- ${viewport.name} ${viewport.width}x${viewport.height} ---`);

  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();

  try {
    await login(page);

    for (const route of routes) {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForURL(routeUrlPattern(route.path), { timeout: 30000 });
      await assertAuthenticatedRoute(page, route.label);
      await expectAnyBodyText(page, route.text, `${viewport.name} ${route.label}`);

      const bodyText = await page.locator("body").innerText({ timeout: 10000 });
      if (bodyText.includes("Application error") || bodyText.includes("Failed to load")) {
        throw new Error(`${route.label} loaded with an error state.`);
      }

      await assertNoHorizontalOverflow(page, `${viewport.name} ${route.label}`);
    }

    if (viewport.expectsMobileNav) {
      await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForURL(routeUrlPattern("/today"), { timeout: 30000 });
      await assertAuthenticatedRoute(page, "Today mobile navigation");
      await verifyMobileNavigation(page);
      await assertNoHorizontalOverflow(page, `${viewport.name} More menu`);
    }
  } catch (error) {
    await failWithDiagnostics(page, viewport.name, "route-check", error);
    await context.close();
    throw error;
  }

  await context.close();
}

async function main() {
  requireConfig();

  console.log("");
  console.log("=== Life Pulse Mobile/Tablet/Desktop Production QA ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("Read-only check: route loads, mobile navigation, and horizontal overflow only.");

  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    for (const viewport of viewports) {
      await runViewport(browser, viewport);
    }
  } catch {
    await browser.close();
    process.exit(1);
  }

  await browser.close();

  console.log("");
  console.log("Mobile/tablet/desktop production QA passed.");
  console.log("");
}

main();
