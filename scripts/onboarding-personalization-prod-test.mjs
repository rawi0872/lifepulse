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
    vars[trimmed.slice(0, eqIdx).trim()] = normalizeEnvValue(trimmed.slice(eqIdx + 1).trim());
  }
  return vars;
}

function normalizeEnvValue(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value;
}

const fileEnv = loadEnv(resolve(__dirname, "..", ".env.test.local"));
const env = { ...fileEnv, ...process.env };

function envValue(name) {
  return normalizeEnvValue(env[name] || "");
}

const BASE = envValue("LIFE_PULSE_PROD_BASE_URL") || "https://lifepulse-sand.vercel.app";
const HEADLESS = envValue("LIFE_PULSE_TEST_HEADLESS") !== "false";
const CREATE_DISPOSABLE = envValue("LIFE_PULSE_ONBOARDING_CREATE_DISPOSABLE") === "true";
const ALLOW_MAIN_ACCOUNT = envValue("LIFE_PULSE_ONBOARDING_ALLOW_MAIN_ACCOUNT") === "true";
const SHOULD_TEST_SETTINGS_UPDATE = envValue("LIFE_PULSE_ONBOARDING_TEST_SETTINGS_UPDATE") === "true";

const MAIN_SMOKE_EMAIL = envValue("LIFE_PULSE_TEST_EMAIL");
const PROVIDED_EMAIL = envValue("LIFE_PULSE_ONBOARDING_TEST_EMAIL");
const PROVIDED_PASSWORD = envValue("LIFE_PULSE_ONBOARDING_TEST_PASSWORD");
const DISPOSABLE_DOMAIN = envValue("LIFE_PULSE_ONBOARDING_DISPOSABLE_EMAIL_DOMAIN");
const DISPOSABLE_PASSWORD = envValue("LIFE_PULSE_ONBOARDING_DISPOSABLE_PASSWORD") || PROVIDED_PASSWORD;

const TEST_EMAIL = CREATE_DISPOSABLE
  ? `lifepulse-onboarding-${Date.now()}@${DISPOSABLE_DOMAIN || ""}`
  : PROVIDED_EMAIL;
const TEST_PASSWORD = CREATE_DISPOSABLE ? DISPOSABLE_PASSWORD : PROVIDED_PASSWORD;

const results = [];
const ERROR_SCREENSHOT_PATH = "screenshot-onboarding-personalization-prod-error.png";

class AlreadyOnboardedSkip extends Error {
  constructor(message) {
    super(message);
    this.name = "AlreadyOnboardedSkip";
  }
}

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

function maskIdentifier(value) {
  if (!value) return "missing";
  const [localPart, domain] = value.split("@");
  if (!domain) return "configured";
  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function sanitizeText(text) {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (match) => maskIdentifier(match));
}

async function getSafeLoginErrorText(page) {
  const selectors = ["[role='alert']", "[aria-live='polite']", "[aria-live='assertive']"];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      const text = (await locator.innerText().catch(() => "")).trim();
      if (text) return sanitizeText(text).slice(0, 240);
    }
  }

  const knownAuthMessages = [
    "Wrong email or password. Please try again.",
    "Please confirm your email address before signing in. Check your inbox.",
    "Enter a valid email address.",
    "Too many attempts. Please wait a moment and try again.",
    "Could not verify your credentials. Please try again.",
    "Unable to connect. Check your internet connection and try again.",
    "Something went wrong. Please try again.",
  ];

  for (const message of knownAuthMessages) {
    if (await page.getByText(message, { exact: true }).isVisible().catch(() => false)) {
      return message;
    }
  }

  return "none detected";
}

function logConfigDiagnostics() {
  console.log(`Config LIFE_PULSE_ONBOARDING_CREATE_DISPOSABLE present: ${Boolean(env.LIFE_PULSE_ONBOARDING_CREATE_DISPOSABLE)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_EMAIL present: ${Boolean(PROVIDED_EMAIL)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_EMAIL file present: ${Boolean(fileEnv.LIFE_PULSE_ONBOARDING_TEST_EMAIL)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_EMAIL process present: ${Boolean(process.env.LIFE_PULSE_ONBOARDING_TEST_EMAIL)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_EMAIL process overrides file: ${Boolean(fileEnv.LIFE_PULSE_ONBOARDING_TEST_EMAIL && process.env.LIFE_PULSE_ONBOARDING_TEST_EMAIL && fileEnv.LIFE_PULSE_ONBOARDING_TEST_EMAIL !== process.env.LIFE_PULSE_ONBOARDING_TEST_EMAIL)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_PASSWORD present: ${Boolean(PROVIDED_PASSWORD)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_PASSWORD file present: ${Boolean(fileEnv.LIFE_PULSE_ONBOARDING_TEST_PASSWORD)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_PASSWORD process present: ${Boolean(process.env.LIFE_PULSE_ONBOARDING_TEST_PASSWORD)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_TEST_PASSWORD process overrides file: ${Boolean(fileEnv.LIFE_PULSE_ONBOARDING_TEST_PASSWORD && process.env.LIFE_PULSE_ONBOARDING_TEST_PASSWORD && fileEnv.LIFE_PULSE_ONBOARDING_TEST_PASSWORD !== process.env.LIFE_PULSE_ONBOARDING_TEST_PASSWORD)}`);
  console.log(`Config LIFE_PULSE_ONBOARDING_DISPOSABLE_EMAIL_DOMAIN present: ${Boolean(DISPOSABLE_DOMAIN)}`);
  console.log(`Config LIFE_PULSE_TEST_EMAIL present: ${Boolean(MAIN_SMOKE_EMAIL)}`);
  console.log(`Config onboarding account equals smoke account: ${Boolean(TEST_EMAIL && MAIN_SMOKE_EMAIL && TEST_EMAIL === MAIN_SMOKE_EMAIL)}`);
}

function safeAuthMessage(payload) {
  if (!payload) return "none";
  if (typeof payload === "string") return sanitizeText(payload).slice(0, 240);
  return sanitizeText(String(payload.error_description || payload.msg || payload.message || payload.error || "none")).slice(0, 240);
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

async function assertTodayAccessible(page, timeout = 20000) {
  await page.waitForURL(/\/today(?:$|[?#])/, { timeout }).catch(() => null);
  if (!page.url().includes("/today")) return false;

  const body = page.locator("body");
  await expect(body).not.toContainText("Application error", { timeout: 10000 });
  await expect(body).not.toContainText("Failed to load dashboard", { timeout: 10000 });

  const goodHeading = page.getByRole("heading", { name: /Good / }).first();
  const todayHeader = page.getByText("Today Command Center").first();
  const firstLoop = page.getByText("First Life Pulse loop").first();
  const stableTodayContentVisible = await goodHeading.isVisible().catch(() => false)
    || await todayHeader.isVisible().catch(() => false)
    || await firstLoop.isVisible().catch(() => false);

  if (!stableTodayContentVisible) {
    await expect(goodHeading.or(todayHeader).or(firstLoop).first()).toBeVisible({ timeout });
  }

  return true;
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
  const authResponsePromises = [];
  page.on("response", (response) => {
    if (response.url().includes("/auth/v1/token")) {
      authResponsePromises.push(response.text()
        .then((text) => {
          let payload = text;
          try {
            payload = JSON.parse(text);
          } catch {
            // Keep raw text for safe sanitization below.
          }
          return { status: response.status(), message: safeAuthMessage(payload) };
        })
        .catch(() => ({ status: response.status(), message: "unavailable" })));
    }
  });

  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.getByRole("button", { name: "Sign in" }).waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(500);

  const emailInput = page.locator("#email");
  const passwordInput = page.locator("#password");
  const submitButton = page.locator('button[type="submit"]').first();
  console.log(`  DIAG Login form found: ${await emailInput.isVisible().catch(() => false) && await passwordInput.isVisible().catch(() => false)}`);
  await emailInput.fill(TEST_EMAIL);
  console.log(`  DIAG Email filled: ${(await emailInput.inputValue()).length > 0}`);
  console.log(`  DIAG Email includes at-sign: ${(await emailInput.inputValue()).includes("@")}`);
  await passwordInput.fill(TEST_PASSWORD);
  console.log(`  DIAG Password filled: ${(await passwordInput.inputValue()).length > 0}`);
  await submitButton.waitFor({ state: "visible", timeout: 10000 });
  console.log(`  DIAG Submit enabled before click: ${await submitButton.isEnabled().catch(() => false)}`);
  await submitButton.click();
  console.log("  DIAG Submit clicked: true");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2500);
  console.log(`  DIAG Post-login URL after wait: ${page.url()}`);
  const authResponses = await Promise.all(authResponsePromises);
  const authSuccessSeen = authResponses.some((authResponse) => authResponse.status >= 200 && authResponse.status < 300);
  console.log(`  DIAG Auth response 200 seen: ${authSuccessSeen}`);
  if (authResponses.length > 0) {
    for (const authResponse of authResponses) {
      console.log(`  DIAG Auth response status: ${authResponse.status}`);
      console.log(`  DIAG Auth response message: ${authResponse.message}`);
    }
  } else {
    console.log("  DIAG Auth response status: none captured");
  }

  if (page.url().includes("/login")) {
    console.log(`  DIAG Visible login error text: ${await getSafeLoginErrorText(page)}`);
  }

  let fallbackAttempted = false;
  let onboardingAccessibleAfterFallback = false;
  let redirectedBackToLogin = false;

  if (authSuccessSeen && page.url().includes("/login")) {
    fallbackAttempted = true;
    await page.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/(onboarding|today|login)(?:$|[?#])/, { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);
    onboardingAccessibleAfterFallback = page.url().includes("/onboarding");
    redirectedBackToLogin = page.url().includes("/login");
  }

  console.log(`  DIAG Direct /onboarding fallback attempted: ${fallbackAttempted}`);
  console.log(`  DIAG /onboarding accessible after fallback: ${onboardingAccessibleAfterFallback}`);
  console.log(`  DIAG Redirected back to /login: ${redirectedBackToLogin}`);
  console.log(`  DIAG Current URL after fallback: ${page.url()}`);

  const accountAlreadyOnboardedAtStart = page.url().includes("/today");
  console.log(`  DIAG Account already onboarded at start: ${accountAlreadyOnboardedAtStart}`);

  if (accountAlreadyOnboardedAtStart) {
    throw new AlreadyOnboardedSkip("Onboarding QA account is already onboarded; reset required for full first-run flow.");
  }

  if (!page.url().includes("/onboarding")) {
    throw new Error(`Login did not reach onboarding. Current URL: ${page.url()}`);
  }

  pass("Dedicated account login reached onboarding");
}

async function completeOnboarding(page) {
  await waitForVisibleText(page, "Start with the daily loop");
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
  await waitForVisibleText(page, "Starting path, not a checklist");
  await waitForBodyToContain(page, "Today, action, reflection, and review are the main path");
  for (const moduleLabel of ["Today", "Tasks", "Habits", "Journal", "Weekly Review"]) {
    await waitForVisibleText(page, moduleLabel);
  }
  await waitForBodyToContain(page, "Available");
  await waitForBodyToContain(page, "Preview");
  pass("Personal setup module recommendation preview is visible");
  await clickContinue(page);

  await waitForVisibleText(page, "These labels help organize what you log");
  await waitForVisibleText(page, "Mind");
  await waitForVisibleText(page, "Body");
  pass("Realm selection still appears");
  await clickContinue(page);

  await waitForVisibleText(page, "Your first job is simple");
  pass("Daily Loop step still appears");
  await clickContinue(page);

  await waitForVisibleText(page, "Start today's loop");
  const finalCta = page.locator('button:has-text("Start today\'s loop")').first();
  let finalCtaClicked = false;
  let todayUrlObserved = false;
  let directTodayAccessibleAfterCta = false;
  let onboardingRedirectedToTodayAfterCta = false;

  await finalCta.click();
  finalCtaClicked = true;
  console.log(`  DIAG Final CTA clicked: ${finalCtaClicked}`);

  step("Checking onboarding completion after final CTA");
  await page.waitForURL(/\/today(?:$|[?#])/, { timeout: 20000 }).catch(() => null);
  todayUrlObserved = page.url().includes("/today");
  console.log(`  DIAG /today URL observed: ${todayUrlObserved}`);

  if (todayUrlObserved) {
    directTodayAccessibleAfterCta = await assertTodayAccessible(page);
  } else {
    await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
    directTodayAccessibleAfterCta = await assertTodayAccessible(page).catch(() => false);
  }
  console.log(`  DIAG Direct /today accessible after CTA: ${directTodayAccessibleAfterCta}`);

  if (directTodayAccessibleAfterCta) {
    await page.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL(/\/(today|onboarding|login)(?:$|[?#])/, { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);
    onboardingRedirectedToTodayAfterCta = page.url().includes("/today");
  }
  console.log(`  DIAG /onboarding redirected to /today after CTA: ${onboardingRedirectedToTodayAfterCta}`);

  if (!todayUrlObserved && !directTodayAccessibleAfterCta && !onboardingRedirectedToTodayAfterCta) {
    throw new Error("Onboarding final CTA did not produce a verifiable completed-onboarding state.");
  }

  pass("Onboarding completed and Today is accessible");
}

async function verifyToday(page) {
  step("Opening Today page for post-onboarding verification");
  await page.goto(`${BASE}/today`, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!await assertTodayAccessible(page)) {
    throw new Error("Today did not become accessible after onboarding.");
  }
  pass("Today loads after onboarding completion");
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
  logConfigDiagnostics();
  console.log(`Using onboarding QA account: ${TEST_EMAIL ? maskIdentifier(TEST_EMAIL) : "missing"}`);
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
    if (error instanceof AlreadyOnboardedSkip) {
      console.log(`  SKIP ${error.message}`);
      console.log("  DIAG Account already onboarded at start: true");
      console.log("  NOTE Reset onboarding_completed=false before running the full first-run onboarding path again.");
      console.log("");
      console.log("=== Result: SKIP ===");
      return;
    }

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
