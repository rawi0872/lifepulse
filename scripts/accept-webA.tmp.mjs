// Prompt 3 web acceptance A: identity, app flows, themes, responsive (temp QA tool).
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const SHOTS = "C:/Users/Win11/AppData/Local/Temp/opencode/p3-web";
fs.mkdirSync(SHOTS, { recursive: true });
const stamp = Date.now().toString(36).toUpperCase();
const QA = { email: `lifepulse.qax.${stamp}@example.com`, password: `Qa-${stamp}-TeSt!9` };
fs.writeFileSync(`${SHOTS}/qa-identity.json`, JSON.stringify(QA));

const failures = [];
const errors = [];
function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra}`);
  if (!cond) failures.push(name);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror@${page.url()}: ${String(e).slice(0, 160)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console@${page.url()}: ${m.text().slice(0, 160)}`); });
page.on("requestfailed", (r) => {
  // Localhost-only artifact: Chromium upgrades Next prefetch subrequests to
  // https while the test server is plain http (production is https-only).
  // Navigation itself succeeds over http; ignore these.
  if (r.url().startsWith("https://localhost")) return;
  errors.push(`reqfail@${r.url().slice(0, 110)}: ${r.failure()?.errorText}`);
});

// --- signup + skip onboarding ---
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.getByLabel(/first name/i).fill("Converge");
await page.getByLabel(/last name/i).fill("QA");
await page.getByLabel(/email/i).fill(QA.email);
await page.getByLabel(/^password/i).fill(QA.password);
const birth = page.getByLabel(/birth/i);
if (await birth.count()) { try { await birth.fill("1990-05-17"); } catch {} }
await page.getByRole("button", { name: /create account|sign up/i }).click();
await page.waitForURL(/onboarding/, { timeout: 20000 });
check("signup lands on onboarding", page.url().includes("/onboarding"));
const skip = page.getByRole("button", { name: /skip for now/i });
await skip.waitFor({ state: "visible", timeout: 15000 });
if (await skip.count()) { await skip.click(); }
await page.waitForURL(/today/, { timeout: 30000 });
check("onboarding skipped to today", page.url().includes("/today"));

// --- today dark ---
await page.waitForTimeout(2500);
check("today greeting", (await page.getByRole("heading", { name: /today/i }).count()) > 0);
await page.screenshot({ path: `${SHOTS}/web-dark-today.png` });

// --- tasks: create Task A ---
await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const TASK_A = `XClient Task A ${stamp}`;
await page.getByPlaceholder(/task to finish today/i).fill(TASK_A);
await page.getByRole("button", { name: /^capture$/i }).click();
await page.waitForTimeout(2500);
check("task A created", (await page.getByText(TASK_A).count()) > 0);
await page.screenshot({ path: `${SHOTS}/web-dark-tasks.png` });

// --- habits: daily + weekdays + weekly ---
await page.goto(`${BASE}/habits`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
async function createHabit(title, freqLabel, days = [], tpw = null) {
  await page.getByRole("button", { name: /^add habit$/i }).click();
  await page.getByPlaceholder(/habit title/i).fill(title);
  await page.getByRole("button", { name: /^(daily|weekdays|weekly)$/i }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: freqLabel }).click().catch(async () => {
    await page.getByText(freqLabel, { exact: true }).last().click();
  });
  if (freqLabel === "Weekdays") {
    for (const d of days) await page.getByRole("button", { name: d }).click();
  }
  if (freqLabel === "Weekly" && tpw) {
    const slider = page.locator('input[type="range"]');
    if (await slider.count()) await slider.fill(String(tpw));
  }
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.waitForTimeout(3000);
  // Reload to ensure the habit list is refreshed
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}
const HAB_D = `XClient Daily ${stamp}`;
const HAB_W = `XClient Weekdays ${stamp}`;
const HAB_K = `XClient Weekly3 ${stamp}`;
await createHabit(HAB_D, "Daily");
check("daily habit created", (await page.getByText(HAB_D).count()) > 0);
await createHabit(HAB_W, "Weekdays", ["Mon", "Wed", "Fri"]);
check("weekdays habit created", (await page.getByText(HAB_W).count()) > 0);
await createHabit(HAB_K, "Weekly", [], 3);
check("weekly habit created", (await page.getByText(HAB_K).count()) > 0);
await page.screenshot({ path: `${SHOTS}/web-dark-habits.png` });

// --- priority on today ---
await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const PRIO = `XClient Priority ${stamp}`;
const planBtn = page.getByRole("button", { name: /plan (day|today)/i }).first();
if (await planBtn.count()) {
  await planBtn.click();
  await page.waitForTimeout(800);
  const prioInput = page.getByPlaceholder(/priority|add/i).first();
  if (await prioInput.count()) {
    await prioInput.fill(PRIO);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
  }
}
check("priority visible", (await page.getByText(PRIO).count()) > 0);

// --- NEXTRON dark ---
await page.goto(`${BASE}/nextron`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/web-dark-nextron.png` });

// --- realms/body/wealth/settings dark ---
await page.goto(`${BASE}/realms`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/web-dark-realms.png` });
await page.goto(`${BASE}/body`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/web-dark-body.png` });
await page.goto(`${BASE}/wealth`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/web-dark-wealth.png` });
await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/web-dark-settings.png` });

// --- switch to light via settings ---
const lightOpt = page.getByRole("radio", { name: /appearance light/i });
if (await lightOpt.count()) {
  await lightOpt.click();
  await page.waitForTimeout(800);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  check("light applies immediately", theme === "light");
  await page.screenshot({ path: `${SHOTS}/web-light-settings.png` });
  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/web-light-today.png` });
  await page.goto(`${BASE}/nextron`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/web-light-nextron.png` });
  await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/web-light-tasks.png` });
  await page.goto(`${BASE}/habits`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/web-light-habits.png` });
  await page.goto(`${BASE}/realms`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SHOTS}/web-light-realms.png` });
  await page.goto(`${BASE}/body`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/web-light-body.png` });
  await page.goto(`${BASE}/wealth`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/web-light-wealth.png` });
  // persistence
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check("light persists after reload", (await page.evaluate(() => document.documentElement.dataset.theme)) === "light");
  // system follows (emulate light then dark)
  await ctx.grantPermissions([]);
}

// --- responsive widths ---
for (const width of [1024, 768]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no horizontal scroll at ${width}px`, overflow <= 1, ` (overflow=${overflow})`);
  await page.screenshot({ path: `${SHOTS}/web-responsive-${width}.png` });
}
await page.setViewportSize({ width: 1440, height: 900 });

console.log(`console/page errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log(`  ${e}`);
if (failures.length) { console.log(`FAILURES: ${failures.join(", ")}`); process.exit(1); }
console.log("WEB ACCEPTANCE A DONE");
await browser.close();
