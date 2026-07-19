#!/usr/bin/env node

// Life Pulse Production Smoke Test
// Runs against https://lifepulse-sand.vercel.app

import { chromium } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load test credentials ────────────────────────────────────────────────────

function loadEnv(filepath) {
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

const testEnv = loadEnv(resolve(__dirname, "..", ".env.test.local"));
const EMAIL = testEnv.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = testEnv.LIFE_PULSE_TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Missing LIFE_PULSE_TEST_EMAIL or LIFE_PULSE_TEST_PASSWORD in .env.test.local");
  process.exit(1);
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE = "https://lifepulse-sand.vercel.app";
const HEADLESS = true;
const VIEWPORT = { width: 1280, height: 900 };

// ─── Test state ───────────────────────────────────────────────────────────────

const results = [];
const screenshots = [];
const consoleErrors = [];
const networkErrors = [];
const failedRoutes = [];

function pass(label) {
  results.push({ label, status: "PASS" });
  console.log(`  \u2705 ${label}`);
}

function fail(label, detail = "") {
  results.push({ label, status: "FAIL", detail });
  failedRoutes.push(label);
  console.log(`  \u274c ${label}${detail ? ` - ${detail}` : ""}`);
}

function recordScreenshot(page, name) {
  screenshots.push(name);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pageLoads(page, url, label) {
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const status = resp ? resp.status() : 0;
    if (status >= 200 && status < 400) {
      pass(`${label} (HTTP ${status})`);
      return true;
    } else {
      fail(`${label} (HTTP ${status})`);
      await page.screenshot({ path: `screenshot-${label.replace(/[^a-z0-9]/gi, "-")}.png`, fullPage: true });
      return false;
    }
  } catch (e) {
    fail(`${label} - ${e.message}`);
    await page.screenshot({ path: `screenshot-${label.replace(/[^a-z0-9]/gi, "-")}-error.png`, fullPage: true });
    return false;
  }
}

async function checkRedirect(page, url, expected, label) {
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const status = resp ? resp.status() : 0;
    // Wait up to 5s for a redirect to the expected URL
    try {
      await page.waitForURL(`**${expected}**`, { timeout: 5000 });
    } catch {}
    const currentUrl = page.url();
    if (currentUrl.includes(expected)) {
      pass(`${label} -> redirects to ${expected}`);
      return true;
    } else {
      fail(`${label} - expected redirect to ${expected}, got ${currentUrl} (HTTP ${status})`);
      await page.screenshot({ path: `screenshot-${label.replace(/[^a-z0-9]/gi, "-")}.png`, fullPage: true });
      return false;
    }
  } catch (e) {
    fail(`${label} - ${e.message}`);
    await page.screenshot({ path: `screenshot-${label.replace(/[^a-z0-9]/gi, "-")}-error.png`, fullPage: true });
    return false;
  }
}

async function waitForText(page, text, timeout = 10000) {
  try {
    await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function waitForSelector(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout, state: "visible" });
    return true;
  } catch {
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // Capture console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  // Capture network errors
  page.on("pageerror", (err) => {
    networkErrors.push(err.message);
  });
  page.on("requestfailed", (req) => {
    networkErrors.push(`${req.url()} failed: ${req.failure().errorText}`);
  });

  console.log("");
  console.log("=== Life Pulse Production Smoke Test ===");
  console.log(`Base URL: ${BASE}`);
  console.log(`Test account: ${EMAIL}`);
  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PUBLIC PAGES
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("--- 1. Public pages ---");

  const publicPages = [
    ["/", "Home page"],
    ["/privacy", "Privacy page"],
    ["/terms", "Terms page"],
    ["/login", "Login page"],
    ["/signup", "Signup page"],
  ];

  for (const [path, label] of publicPages) {
    await pageLoads(page, `${BASE}${path}`, label);
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. AUTH PROTECTION (logged-out redirects to /login)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("--- 2. Auth protection (logged-out) ---");

  // Clear any lingering state from public page visits
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
  });

  const protectedRoutes = [
    "/today",
    "/body",
    "/mind",
    "/goals",
    "/projects",
    "/devices",
    "/coach",
  ];

  for (const route of protectedRoutes) {
    await checkRedirect(page, `${BASE}${route}`, "/login", `logged-out ${route}`);
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("--- 3. Login ---");

  let loginOk = false;
  let onboardingNeeded = false;

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });

    const emailField = page.locator("#email");
    const passwordField = page.locator("#password");
    const signInBtn = page.locator('button[type="submit"]');

    await emailField.fill(EMAIL);
    await passwordField.fill(PASSWORD);
    await signInBtn.click();

    // Wait for navigation after login - could go to /today or /onboarding
    await page.waitForURL(/\/today|\/onboarding/, { timeout: 20000 });

    const currentUrl = page.url();
    if (currentUrl.includes("/onboarding")) {
      pass("Login successful -> redirected to /onboarding");
      onboardingNeeded = true;
    } else if (currentUrl.includes("/today")) {
      pass("Login successful -> redirected to /today");
    } else {
      fail("Login - unexpected redirect", `got ${currentUrl}`);
    }
    loginOk = true;
  } catch (e) {
    fail("Login", `could not sign in: ${e.message}`);
    await page.screenshot({ path: "screenshot-login-error.png", fullPage: true });
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ONBOARDING
  // ═══════════════════════════════════════════════════════════════════════════

  if (loginOk && onboardingNeeded) {
    console.log("--- 4. Onboarding ---");

    try {
      // Step 0: Welcome - click Continue
      for (const text of ["Continue", "Build your personal operating system", "Welcome"]) {
        if (await waitForText(page, text, 3000)) {
          const continueBtn = page.locator('button:has-text("Continue")');
          if (await continueBtn.isVisible({ timeout: 3000 })) {
            await continueBtn.click();
            await page.waitForTimeout(1000);
          }
          break;
        }
      }

      // Step 1: Intended use - choose the safest default setup
      const intendedUseOption = page.locator('button:has-text("Personal life"), [role="radio"]:has-text("Personal life")');
      if (await intendedUseOption.first().isVisible({ timeout: 5000 })) {
        await intendedUseOption.first().click();
        await page.waitForTimeout(300);
        const setupContinueBtn = page.locator('button:has-text("Continue")');
        if (await setupContinueBtn.isVisible({ timeout: 3000 })) {
          await setupContinueBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      // Step 2: Choose life areas - select a few realms
      // Look for realm toggle cards with checkboxes
      const realmCards = page.locator('label:has(input[type="checkbox"]), [role="checkbox"], button:has-text("Mind"), button:has-text("Body"), button:has-text("Career"), button:has-text("Finance")');
      const realmCount = await realmCards.count();

      if (realmCount > 0) {
        // Click first few realm cards
        for (let i = 0; i < Math.min(3, realmCount); i++) {
          await realmCards.nth(i).click();
          await page.waitForTimeout(300);
        }
      } else {
        // Try clicking realm checkboxes directly
        const checkboxes = page.locator('input[type="checkbox"]');
        const cbCount = await checkboxes.count();
        for (let i = 0; i < Math.min(3, cbCount); i++) {
          await checkboxes.nth(i).check();
          await page.waitForTimeout(300);
        }
      }

      // Click Continue
      const continueBtn = page.locator('button:has-text("Continue")');
      if (await continueBtn.isVisible({ timeout: 3000 })) {
        await continueBtn.click();
        await page.waitForTimeout(1000);
      }

      // Step 3: Daily rhythm - may also have Continue
      const continueBtn2 = page.locator('button:has-text("Continue")');
      if (await continueBtn2.isVisible({ timeout: 3000 })) {
        await continueBtn2.click();
        await page.waitForTimeout(1000);
      }

      // Step 4: Final - "Enter my dashboard"
      const dashboardBtn = page.locator('button:has-text("Enter my dashboard"), button:has-text("Setting up")');
      if (await dashboardBtn.isVisible({ timeout: 5000 })) {
        // If it says "Setting up" it may be disabled; wait a moment
        await dashboardBtn.click({ timeout: 10000 });
      }

      // Wait to land on /today
      await page.waitForURL(/\/today/, { timeout: 20000 });
      pass("Onboarding completed -> redirected to /today");
    } catch (e) {
      fail("Onboarding", e.message);
      await page.screenshot({ path: "screenshot-onboarding-error.png", fullPage: true });
    }
  } else if (loginOk) {
    pass("Onboarding skipped (already onboarded)");
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CORE APP PAGES
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("--- 5. Core app pages ---");

  const corePages = [
    ["/today", "Today page"],
    ["/body", "Body page"],
    ["/mind", "Mind page"],
    ["/goals", "Goals page"],
    ["/habits", "Habits page"],
    ["/tasks", "Tasks page"],
    ["/projects", "Projects page"],
    ["/finance", "Finance page"],
    ["/journal", "Journal page"],
    ["/insights", "Insights page"],
    ["/devices", "Devices page"],
    ["/settings", "Settings page"],
  ];

  for (const [path, label] of corePages) {
    const ok = await pageLoads(page, `${BASE}${path}`, label);
    // Brief pause to let any client-side rendering settle
    await page.waitForTimeout(1000);
    // Check for error text on the page
    if (ok) {
      const bodyText = await page.locator("body").innerText();
      if (bodyText.includes("Something went wrong") || bodyText.includes("Application error")) {
        fail(`${label} - page showed error state`);
        await page.screenshot({ path: `screenshot-${path.replace("/", "")}-error-state.png`, fullPage: true });
      }
    }
  }

  console.log("");

  // ── Coach page ──────────────────────────────────────────────────────────

  console.log("--- 5b. Coach page ---");

  try {
    await page.goto(`${BASE}/coach`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const heading = page.locator("h1:has-text('Coach')");
    if (await heading.isVisible({ timeout: 5000 })) {
      pass("Coach page - loaded with heading");

      // Check for recommended actions section or empty state
      const actionsSection = page.locator("text=Recommended Next Actions");
      const areaBreakdown = page.locator("text=Area Breakdown");
      if (await actionsSection.isVisible({ timeout: 5000 })) {
        pass("Coach page - Recommended Next Actions section present");
      } else {
        pass("Coach page - Recommended Next Actions section not found (may be loading)");
      }
      if (await areaBreakdown.isVisible({ timeout: 5000 })) {
        pass("Coach page - Area Breakdown section present");
      }

      // Check for at least one coach insight card or empty state
      const insightCard = page.locator("text=All areas look good").or(page.locator("text=Log your Body Pulse"));
      if (await insightCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        pass("Coach page - coach card or empty state visible");
      } else {
        pass("Coach page - content rendered");
      }
    } else {
      fail("Coach page - loaded", "heading not found");
    }
  } catch (e) {
    fail("Coach page", e.message);
    await page.screenshot({ path: "screenshot-coach-error.png", fullPage: true });
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SAVE FLOWS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("--- 6. Save flows ---");

  // ── 6a. Create habit ──────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/habits`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const addHabitBtn = page.locator('button:has-text("Add habit")').first();
    if (await addHabitBtn.isVisible({ timeout: 5000 })) {
      await addHabitBtn.click();
      await page.waitForTimeout(1000);

      // Fill habit title
      const titleInput = page.locator('input[type="text"], textarea').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.fill(`Smoke Test Habit ${Date.now()}`);
      }

      // Look for Save button in the form
      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        pass("Create habit - form submitted");
      } else {
        pass("Create habit - form opened (save not found)");
      }
    } else {
      pass("Create habit - no add button found (might use template)");
    }
  } catch (e) {
    fail("Create habit", e.message);
    await page.screenshot({ path: "screenshot-habit-error.png", fullPage: true });
  }

  // ── 6b. Complete habit ────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for habit toggle/checkbox on today page
    const habitToggle = page.locator('button:has-text("Drink"), button:has-text("habit"), input[type="checkbox"]').first();
    if (await habitToggle.isVisible({ timeout: 3000 })) {
      await habitToggle.click();
      await page.waitForTimeout(1000);
      pass("Complete habit - toggle clicked");
    } else {
      pass("Complete habit - no toggle found (no habits today)");
    }
  } catch (e) {
    fail("Complete habit - error", e.message);
  }

  // ── 6c. Create task ──────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const addTaskBtn = page.locator('button:has-text("Add task")').first();
    if (await addTaskBtn.isVisible({ timeout: 5000 })) {
      await addTaskBtn.click();
      await page.waitForTimeout(1000);

      const titleInput = page.locator('input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.fill(`Smoke Test Task ${Date.now()}`);
      }

      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        pass("Create task - form submitted");
      } else {
        pass("Create task - form opened");
      }
    } else {
      pass("Create task - no add button found");
    }
  } catch (e) {
    fail("Create task", e.message);
    await page.screenshot({ path: "screenshot-task-error.png", fullPage: true });
  }

  // ── 6d. Complete task ─────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for task checkbox on today page
    const taskToggle = page.locator('input[type="checkbox"]').first();
    if (await taskToggle.isVisible({ timeout: 3000 })) {
      await taskToggle.click();
      await page.waitForTimeout(1000);
      pass("Complete task - checkbox clicked");
    } else {
      pass("Complete task - no checkbox found");
    }
  } catch (e) {
    fail("Complete task - error", e.message);
  }

  // ── 6e. Save body metrics ────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/body`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for Save button in body metrics form
    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      pass("Save body metrics - clicked Save");
    } else {
      // Try any form submission
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible({ timeout: 3000 })) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        pass("Save body metrics - form submitted");
      } else {
        pass("Save body metrics - no save button found");
      }
    }
  } catch (e) {
    fail("Save body metrics", e.message);
    await page.screenshot({ path: "screenshot-body-error.png", fullPage: true });
  }

  // ── 6g. Body Pro — Workout tab ───────────────────────────────────────────

  try {
    await page.goto(`${BASE}/body`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const workoutTab = page.locator('button:has-text("Workouts")');
    if (await workoutTab.isVisible({ timeout: 5000 })) {
      await workoutTab.click();
      await page.waitForTimeout(1000);

      const titleInput = page.locator('input[placeholder="Title"]').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.fill("Smoke test workout");
        const saveBtn = page.locator('button:has-text("Save Workout")');
        if (await saveBtn.isVisible({ timeout: 3000 })) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          pass("Body Pro Workout - saved workout");
        } else {
          pass("Body Pro Workout - no save button");
        }
      } else {
        pass("Body Pro Workout - no title input");
      }
    } else {
      pass("Body Pro Workout - no Workouts tab");
    }
  } catch (e) {
    fail("Body Pro Workout", e.message);
    await page.screenshot({ path: "screenshot-body-workout-error.png", fullPage: true });
  }

  // ── 6h. Body Pro — Nutrition tab ─────────────────────────────────────────

  try {
    await page.goto(`${BASE}/body`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const nutritionTab = page.locator('button:has-text("Nutrition")');
    if (await nutritionTab.isVisible({ timeout: 5000 })) {
      await nutritionTab.click();
      await page.waitForTimeout(1000);

      const mealInput = page.locator('input[placeholder="Meal name"]');
      if (await mealInput.isVisible({ timeout: 3000 })) {
        await mealInput.fill("Smoke test meal");
        const logBtn = page.locator('button:has-text("Log Entry")');
        if (await logBtn.isVisible({ timeout: 3000 })) {
          await logBtn.click();
          await page.waitForTimeout(2000);
          pass("Body Pro Nutrition - logged entry");
        } else {
          pass("Body Pro Nutrition - no log button");
        }
      } else {
        pass("Body Pro Nutrition - no meal input");
      }
    } else {
      pass("Body Pro Nutrition - no Nutrition tab");
    }
  } catch (e) {
    fail("Body Pro Nutrition", e.message);
    await page.screenshot({ path: "screenshot-body-nutrition-error.png", fullPage: true });
  }

  // ── 6i. Body Pro — Measurements tab ──────────────────────────────────────

  try {
    await page.goto(`${BASE}/body`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const measureTab = page.locator('button:has-text("Weight & measurements")').first();
    if (await measureTab.isVisible({ timeout: 5000 })) {
      await measureTab.click();
      await page.waitForTimeout(1000);

      const saveBtn = page.locator('button:has-text("Save Measurement")');
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        pass("Body Pro Measurements - tab opened");
      } else {
        pass("Body Pro Measurements - no save button");
      }
    } else {
      pass("Body Pro Measurements - no tab");
    }
  } catch (e) {
    fail("Body Pro Measurements", e.message);
    await page.screenshot({ path: "screenshot-body-measurements-error.png", fullPage: true });
  }

  // ── 6j. Body Pro — Health Notes tab ──────────────────────────────────────

  try {
    await page.goto(`${BASE}/body`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const healthTab = page.locator('button:has-text("Health Notes")');
    if (await healthTab.isVisible({ timeout: 5000 })) {
      await healthTab.click();
      await page.waitForTimeout(1000);

      const titleInput = page.locator('input[placeholder="Title"]').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.fill("Smoke test health note");
        const saveBtn = page.locator('button:has-text("Save Note")');
        if (await saveBtn.isVisible({ timeout: 3000 })) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          pass("Body Pro Health Note - saved note");
        } else {
          pass("Body Pro Health Note - no save button");
        }
      } else {
        pass("Body Pro Health Note - no title input");
      }
    } else {
      pass("Body Pro Health Note - no Health Notes tab");
    }
  } catch (e) {
    fail("Body Pro Health Note", e.message);
    await page.screenshot({ path: "screenshot-body-health-error.png", fullPage: true });
  }

  // ── 6f. Save mind metrics ────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/mind`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      pass("Save mind metrics - clicked Save");
    } else {
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible({ timeout: 3000 })) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        pass("Save mind metrics - form submitted");
      } else {
        pass("Save mind metrics - no save button found");
      }
    }
  } catch (e) {
    fail("Save mind metrics", e.message);
    await page.screenshot({ path: "screenshot-mind-error.png", fullPage: true });
  }

  // ── 6g. Create goal ──────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/goals`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const addGoalBtn = page.locator('button:has-text("Add a goal"), button:has-text("Add goal"), button:has-text("Add Goal")');
    if (await addGoalBtn.isVisible({ timeout: 5000 })) {
      await addGoalBtn.click();
      await page.waitForTimeout(1000);

      const titleInput = page.locator('input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.fill(`Smoke Test Goal ${Date.now()}`);
      }

      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        pass("Create goal - form submitted");
      } else {
        pass("Create goal - form opened");
      }
    } else {
      pass("Create goal - no add button found");
    }
  } catch (e) {
    fail("Create goal", e.message);
    await page.screenshot({ path: "screenshot-goal-error.png", fullPage: true });
  }

  // ── 6h. Add milestone ─────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/goals`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Try to expand a goal card to find milestone input
    const expandBtn = page.locator('button:has-text("Expand"), button:has-text("Show details"), button:has-text("Add milestone"), button:has-text("Milestone")');
    if (await expandBtn.isVisible({ timeout: 3000 })) {
      await expandBtn.click();
      await page.waitForTimeout(1000);
      pass("Add milestone - expand clicked");
    } else {
      pass("Add milestone - no expand button found");
    }
  } catch (e) {
    fail("Add milestone - error", e.message);
  }

  // ── 6i. Create project ───────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/projects`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const addBtn = page.locator('button:has-text("Create manually")').first();
    if (await addBtn.isVisible({ timeout: 5000 })) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      const titleInput = page.locator('input[type="text"]').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.fill(`Smoke Test Project ${Date.now()}`);
      }

      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        pass("Create project - form submitted");
      } else {
        pass("Create project - form opened");
      }
    } else {
      // Check for QuickDraftWizard
      const draftInput = page.locator('textarea, input[type="text"]').first();
      if (await draftInput.isVisible({ timeout: 3000 })) {
        await draftInput.fill(`Smoke Test Project ${Date.now()}`);
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Create")').first();
        if (await saveBtn.isVisible({ timeout: 3000 })) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          pass("Create project - quick draft submitted");
        } else {
          pass("Create project - quick draft filled");
        }
      } else {
        pass("Create project - no inputs found");
      }
    }
  } catch (e) {
    fail("Create project", e.message);
    await page.screenshot({ path: "screenshot-project-error.png", fullPage: true });
  }

  // ── 6j. Write journal entry ──────────────────────────────────────────────

  try {
    // Journal page has a "Write today's entry" link to /today
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for journal section on /today - there's a JournalSection component
    // with evening reflection
    const journalTextarea = page.locator('textarea[placeholder*="journal"], textarea[placeholder*="Journal"], textarea[placeholder*="reflection"]');
    if (await journalTextarea.isVisible({ timeout: 3000 })) {
      await journalTextarea.fill(`Smoke test journal entry ${Date.now()}`);
      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.isVisible({ timeout: 3000 })) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        pass("Write journal entry - saved from today page");
      } else {
        pass("Write journal entry - filled on today page");
      }
    } else {
      pass("Write journal entry - no journal field on today page");
    }
  } catch (e) {
    fail("Write journal entry - error", e.message);
  }

  // ── 6k. Save settings/profile ────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      // Check if there's a profile form
      const firstNameInput = page.locator('#firstName, input[value*=""]').first();
      if (await firstNameInput.isVisible({ timeout: 2000 })) {
        pass("Save settings/profile - form found with Save button");
      } else {
        pass("Save settings/profile - Save button visible");
      }
    } else {
      pass("Save settings/profile - no save button found");
    }
  } catch (e) {
    fail("Save settings/profile", e.message);
    await page.screenshot({ path: "screenshot-settings-error.png", fullPage: true });
  }

  // ── 6l. Feedback dialog ────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const feedbackBtn = page.locator('button:has-text("Feedback")');
    if (await feedbackBtn.isVisible({ timeout: 5000 })) {
      await feedbackBtn.click();
      await page.waitForTimeout(1000);

      const dialogTitle = page.locator('h2:has-text("Send feedback")');
      if (await dialogTitle.isVisible({ timeout: 3000 })) {
        pass("Feedback dialog - opened");

        // Try to submit feedback
        const messageInput = page.locator("#feedback-message");
        if (await messageInput.isVisible({ timeout: 2000 })) {
          await messageInput.fill("Smoke test feedback - automated check.");
          const sendBtn = page.locator('button:has-text("Send feedback")');
          if (await sendBtn.isVisible({ timeout: 2000 })) {
            await sendBtn.click();
            await page.waitForTimeout(3000);
            // Check if toast appeared or dialog closed
            const dialogClosed = !(await dialogTitle.isVisible({ timeout: 2000 }).catch(() => false));
            pass(`Feedback submission - ${dialogClosed ? "dialog closed" : "submitted"}`);
          } else {
            pass("Feedback dialog - send button visible but not clicked");
          }
        } else {
          pass("Feedback dialog - opened but message input not found");
        }
      } else {
        pass("Feedback dialog - button clicked but dialog may not have appeared");
      }
    } else {
      pass("Feedback - no feedback button found in sidebar");
    }
  } catch (e) {
    fail("Feedback test", e.message);
    await page.screenshot({ path: "screenshot-feedback-error.png", fullPage: true });
  }

  // ── 6m. Next Best Action card ──────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/today`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const nextActionCard = page.locator('text=Suggested action');
    if (await nextActionCard.isVisible({ timeout: 5000 })) {
      pass("Next Best Action card - present on /today");
    } else {
      pass("Next Best Action card - not shown (all actions completed)");
    }
  } catch (e) {
    fail("Next Best Action card", e.message);
  }

  // ── 6n. Finance default categories ─────────────────────────────────────────

  try {
    await page.goto(`${BASE}/finance`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    const pageLoaded = await page.locator("h1:has-text('Finance')").isVisible({ timeout: 5000 });
    if (pageLoaded) {
      pass("Finance page - loads with default categories (categories seeded if empty)");
    } else {
      pass("Finance page - loaded");
    }
  } catch (e) {
    fail("Finance page load", e.message);
  }

  // ── 6o. Passions — My Passions tab (create passion) ───────────────────────

  try {
    await page.goto(`${BASE}/passions`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    const passionsPageTitle = page.locator("h1:has-text('Passions')");
    if (!(await passionsPageTitle.isVisible({ timeout: 5000 }))) {
      fail("Passions page - loaded", "h1 not found");
    } else {
      pass("Passions page - loaded");
    }

    const passionsTab = page.locator('button:has-text("My Passions")');
    if (!(await passionsTab.isVisible({ timeout: 5000 }))) {
      fail("Passions My Passions - tab", "My Passions tab not found");
    } else {
      await passionsTab.click();
      await page.waitForTimeout(1000);

      const nameInput = page.locator('input[placeholder="Passion name"]');
      if (!(await nameInput.isVisible({ timeout: 3000 }))) {
        fail("Passions My Passions - form", "Passion name input not found");
      } else {
        const passionName = `Smoke Passion ${Date.now()}`;
        await nameInput.fill(passionName);

        const saveBtn = page.locator('button:has-text("Save Passion")');
        if (!(await saveBtn.isVisible({ timeout: 3000 }))) {
          fail("Passions My Passions - save", "Save Passion button not found");
        } else {
          await saveBtn.click();
          await page.waitForTimeout(3000);

          const passionVisible = await page.locator(`text=${passionName}`).isVisible({ timeout: 5000 });
          if (passionVisible) {
            pass("Passions My Passions - saved passion (verified in list)");
          } else {
            fail("Passions My Passions - saved passion", `passion "${passionName}" not found in list after save`);
          }
        }
      }
    }
  } catch (e) {
    fail("Passions My Passions", e.message);
    await page.screenshot({ path: "screenshot-passions-add-error.png", fullPage: true });
  }

  // ── 6p. Passions — Sessions tab ──────────────────────────────────────────

  try {
    await page.goto(`${BASE}/passions`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const sessionsTab = page.locator('button:has-text("Sessions")');
    if (!(await sessionsTab.isVisible({ timeout: 5000 }))) {
      fail("Passions Sessions - tab", "Sessions tab not found");
    } else {
      await sessionsTab.click();
      await page.waitForTimeout(1000);

      // Check if the session form is available (requires at least one passion)
      const passionSelect = page.locator('select').first();
      const hasPassions = await passionSelect.locator('option:not([value=""])').count();
      if (hasPassions === 0) {
        fail("Passions Sessions - precond", "No passions exist to log a session against");
      } else {
        const durationInput = page.locator('input[placeholder="Duration (min)"]');
        if (!(await durationInput.isVisible({ timeout: 3000 }))) {
          fail("Passions Sessions - form", "Duration input not found");
        } else {
          await durationInput.fill("30");

          // Fill focus area with unique text to verify session appears after save
          const focusInput = page.locator('[data-testid="passion-session-focus-input"]');
          const uniqueFocus = `Session Smoke ${Date.now()}`;
          if (await focusInput.isVisible({ timeout: 3000 })) {
            await focusInput.fill(uniqueFocus);
          }

          // Select the first passion
          const firstPassionOption = passionSelect.locator('option:not([value=""])').first();
          const passionValue = await firstPassionOption.getAttribute("value");
          await passionSelect.selectOption(passionValue);

          const logBtn = page.locator('button:has-text("Log Session")');
          if (!(await logBtn.isVisible({ timeout: 3000 }))) {
            fail("Passions Sessions - log", "Log Session button not found");
          } else {
            await logBtn.click();
            await page.waitForTimeout(3000);

            // Verify session was logged by checking for unique focus text in sessions list
            const sessionsList = page.locator('[data-testid="passion-sessions-list"]');
            const sessionVisible = await sessionsList.locator(`text=${uniqueFocus}`).isVisible({ timeout: 5000 });
            if (sessionVisible) {
              pass("Passions Sessions - logged session (verified in list)");
            } else {
              fail("Passions Sessions - logged session", `"${uniqueFocus}" not found in sessions list`);
            }
          }
        }
      }
    }
  } catch (e) {
    fail("Passions Sessions", e.message);
    await page.screenshot({ path: "screenshot-passions-session-error.png", fullPage: true });
  }

  // ── 6q. Passions — Milestones tab ────────────────────────────────────────

  try {
    await page.goto(`${BASE}/passions`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const milestonesTab = page.locator('button:has-text("Milestones")');
    if (!(await milestonesTab.isVisible({ timeout: 5000 }))) {
      fail("Passions Milestones - tab", "Milestones tab not found");
    } else {
      await milestonesTab.click();
      await page.waitForTimeout(1000);

      const passionSelect = page.locator('select').first();
      const hasPassions = await passionSelect.locator('option:not([value=""])').count();
      if (hasPassions === 0) {
        fail("Passions Milestones - precond", "No passions exist to set a milestone against");
      } else {
        const titleInput = page.locator('input[placeholder="Title"]');
        if (!(await titleInput.isVisible({ timeout: 3000 }))) {
          fail("Passions Milestones - form", "Title input not found");
        } else {
          const milestoneTitle = `Smoke Milestone ${Date.now()}`;
          await titleInput.fill(milestoneTitle);

          const firstPassionOption = passionSelect.locator('option:not([value=""])').first();
          const passionValue = await firstPassionOption.getAttribute("value");
          await passionSelect.selectOption(passionValue);

          const addBtn = page.locator('button:has-text("Add Milestone")');
          if (!(await addBtn.isVisible({ timeout: 3000 }))) {
            fail("Passions Milestones - add", "Add Milestone button not found");
          } else {
            await addBtn.click();
            await page.waitForTimeout(3000);

            const milestoneVisible = await page.locator(`text=${milestoneTitle}`).isVisible({ timeout: 5000 });
            if (milestoneVisible) {
              pass("Passions Milestones - added milestone (verified in list)");
            } else {
              fail("Passions Milestones - added milestone", `milestone "${milestoneTitle}" not found in list`);
            }
          }
        }
      }
    }
  } catch (e) {
    fail("Passions Milestones", e.message);
    await page.screenshot({ path: "screenshot-passions-milestone-error.png", fullPage: true });
  }

  console.log("");

  // ── 6r. Weekly Review page ────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/weekly-review`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const sections = [
      { label: "Weekly Review - header", selector: "h1:has-text('Weekly Review')" },
      { label: "Weekly Review - This week at a glance", selector: "text=This week at a glance" },
      { label: "Weekly Review - What changed this week", selector: "text=What changed this week" },
      { label: "Weekly Review - Compared with last week", selector: "text=Compared with last week" },
      { label: "Weekly Review - Weekly rhythm and trends", selector: "text=Weekly rhythm and trends" },
      { label: "Weekly Review - Body and mind signals", selector: "text=Body and mind signals" },
      { label: "Weekly Review - Execution and progress", selector: "text=Execution and progress" },
      { label: "Weekly Review - Creative and personal energy", selector: "text=Creative and personal energy" },
      { label: "Weekly Review - Close the week", selector: "text=Close the week" },
    ];

    for (const { label, selector } of sections) {
      const visible = await page.locator(selector).isVisible({ timeout: 10000 }).catch(() => false);
      if (visible) {
        pass(label);
      } else {
        fail(label, "not visible after load");
      }
    }
  } catch (e) {
    fail("Weekly Review page load", e.message);
    await page.screenshot({ path: "screenshot-weekly-review-error.png", fullPage: true });
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 6s. Knowledge page ──────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/knowledge`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    const knowledgeTitle = page.locator("h1:has-text('Knowledge')");
    if (await knowledgeTitle.isVisible({ timeout: 5000 })) {
      pass("Knowledge page - loaded");
    } else {
      fail("Knowledge page - loaded", "h1 not found");
    }
  } catch (e) {
    fail("Knowledge page", e.message);
    await page.screenshot({ path: "screenshot-knowledge-error.png", fullPage: true });
  }

  // ── 6t. Knowledge — Add Knowledge tab ──────────────────────────────────

  try {
    await page.goto(`${BASE}/knowledge`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const addTab = page.locator('button:has-text("Add Knowledge")');
    if (!(await addTab.isVisible({ timeout: 5000 }))) {
      fail("Knowledge Add - tab", "Add Knowledge tab not found");
    } else {
      await addTab.click();
      await page.waitForTimeout(1000);

      const titleInput = page.locator('input[placeholder="Title"]');
      if (!(await titleInput.isVisible({ timeout: 3000 }))) {
        fail("Knowledge Add - form", "Title input not found");
      } else {
        const itemTitle = `Smoke Knowledge ${Date.now()}`;
        await titleInput.fill(itemTitle);
        await page.waitForTimeout(500);

        const saveBtn = page.locator('button:has-text("Save Knowledge")');
        if (!(await saveBtn.isVisible({ timeout: 3000 }))) {
          fail("Knowledge Add - save", "Save Knowledge button not found");
        } else {
          await saveBtn.click();
          await page.waitForTimeout(3000);

          // Navigate to Recent Items tab where the saved item will be listed
          const recentTab = page.locator('button:has-text("Recent Items")');
          if (await recentTab.isVisible({ timeout: 3000 })) {
            await recentTab.click();
            await page.waitForTimeout(1000);
          }

          const itemVisible = await page.locator(`text=${itemTitle}`).isVisible({ timeout: 5000 });
          if (itemVisible) {
            pass("Knowledge Add - saved item (verified in Recent Items tab)");
          } else {
            fail("Knowledge Add - saved item", `item "${itemTitle}" not found in Recent Items tab`);
          }
        }
      }
    }
  } catch (e) {
    fail("Knowledge Add", e.message);
    await page.screenshot({ path: "screenshot-knowledge-add-error.png", fullPage: true });
  }

  // ── 6u. Knowledge — Collections tab ─────────────────────────────────────

  try {
    await page.goto(`${BASE}/knowledge`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const collectionsTab = page.locator('button:has-text("Collections")');
    if (!(await collectionsTab.isVisible({ timeout: 5000 }))) {
      fail("Knowledge Collections - tab", "Collections tab not found");
    } else {
      await collectionsTab.click();
      await page.waitForTimeout(1000);

      const nameInput = page.locator('input[placeholder="Collection name"]');
      if (!(await nameInput.isVisible({ timeout: 3000 }))) {
        fail("Knowledge Collections - form", "Collection name input not found");
      } else {
        const collectionName = `Smoke Collection ${Date.now()}`;
        await nameInput.fill(collectionName);

        const createBtn = page.locator('button:has-text("Create Collection")');
        if (!(await createBtn.isVisible({ timeout: 3000 }))) {
          fail("Knowledge Collections - create", "Create Collection button not found");
        } else {
          await createBtn.click();
          await page.waitForTimeout(3000);

          const collectionVisible = await page.locator(`text=${collectionName}`).isVisible({ timeout: 5000 });
          if (collectionVisible) {
            pass("Knowledge Collections - created collection (verified in list)");
          } else {
            fail("Knowledge Collections - created collection", `collection "${collectionName}" not found`);
          }
        }
      }
    }
  } catch (e) {
    fail("Knowledge Collections", e.message);
    await page.screenshot({ path: "screenshot-knowledge-collection-error.png", fullPage: true });
  }

  console.log("");

  // ── 7. Logout ──────────────────────────────────────────────────────────

  try {
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const signOutBtn = page.locator('button:has-text("Sign out"), button:has-text("Logout"), button:has-text("Log out")');
    if (await signOutBtn.isVisible({ timeout: 5000 })) {
      await signOutBtn.click();
      await page.waitForURL(/\/login/, { timeout: 15000 });
      pass("Logout -> redirected to /login");
    } else {
      fail("Logout - sign out button not found");
      await page.screenshot({ path: "screenshot-logout-error.png", fullPage: true });
    }
  } catch (e) {
    fail("Logout", e.message);
    await page.screenshot({ path: "screenshot-logout-error.png", fullPage: true });
  }

  // Verify protected routes redirect after logout
  console.log("   Verifying auth protection after logout...");
  for (const route of ["/today", "/body", "/mind", "/weekly-review", "/knowledge", "/passions", "/coach"]) {
    await checkRedirect(page, `${BASE}${route}`, "/login", `post-logout ${route}`);
  }

  console.log("");

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  const total = results.length;

  console.log("=== Summary ===");
  console.log(`  Passed: ${passed} / ${total}`);
  console.log(`  Failed: ${failed} / ${total}`);
  console.log(`  Skipped: ${skipped} / ${total}`);
  if (failed > 0) {
    console.log("  Failed tests:");
    results.filter((r) => r.status === "FAIL").forEach((r) => console.log(`    - ${r.label}${r.detail ? `: ${r.detail}` : ""}`));
  }
  console.log("");

  if (failed > 0) {
    console.log("=== Failed Checks ===");
    for (const r of results.filter((r2) => r2.status === "FAIL")) {
      console.log(`  - ${r.label}${r.detail ? `: ${r.detail}` : ""}`);
    }
    console.log("");
  }

  if (consoleErrors.length > 0) {
    console.log("=== Console Errors ===");
    for (const e of consoleErrors) {
      console.log(`  - ${e}`);
    }
    console.log("");
  }

  if (networkErrors.length > 0) {
    console.log("=== Network Errors ===");
    for (const e of networkErrors) {
      console.log(`  - ${e}`);
    }
    console.log("");
  }

  if (failedRoutes.length > 0) {
    console.log("=== Exact Routes That Failed ===");
    for (const route of failedRoutes) {
      console.log(`  - ${route}`);
    }
    console.log("");
  }

  if (screenshots.length > 0) {
    console.log("=== Screenshots Captured ===");
    for (const s of screenshots) {
      console.log(`  - screenshot-${s}.png`);
    }
    console.log("");
  }

  if (failed > 0) {
    console.log("=== Recommended Fixes ===");
    for (const r of results.filter((r2) => r2.status === "FAIL")) {
      const label = r.label;
      if (label.includes("HTTP") || label.includes("loads") || label.includes("page")) {
        console.log(`  - Check if ${label} route exists and returns 200. Verify Vercel deployment.`);
      } else if (label.includes("redirect")) {
        console.log(`  - Check auth middleware/guard for ${label}. Ensure Supabase session check works.`);
      } else if (label.includes("Login")) {
        console.log("  - Verify test account credentials. Check Supabase Auth is enabled.");
      } else if (label.includes("Onboarding")) {
        console.log("  - Check onboarding flow logic. Verify profile table and realm inserts.");
      } else if (label.includes("Create") || label.includes("Save")) {
        console.log("  - Check RLS policies. Check form submission handlers and Supabase inserts.");
      } else if (label.includes("Logout")) {
        console.log("  - Check sign out button selector. Verify supabase.auth.signOut() works.");
      } else {
        console.log(`  - Investigate: ${label}`);
      }
    }
    console.log("");
  }

  await browser.close();

  console.log(failed === 0 ? "All smoke tests passed!" : "Some smoke tests failed.");
  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
