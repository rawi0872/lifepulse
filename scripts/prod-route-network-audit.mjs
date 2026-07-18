#!/usr/bin/env node

// Read-only production route network audit.
// Captures sanitized Supabase REST/RPC request counts and route timing for key pages.

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

const BASE = env.LIFE_PULSE_PROD_BASE_URL || env.LIFE_PULSE_BASE_URL || "https://lifepulse-sand.vercel.app";
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;

const routes = [
  { path: "/today", label: "Today", visibleText: "Daily focus" },
  { path: "/insights", label: "Insights", visibleText: "Life Pulse Insights" },
  { path: "/habits", label: "Habits", visibleText: "Habits" },
  { path: "/finance", label: "Finance", visibleText: "Finance" },
  { path: "/weekly-review", label: "Weekly Review", visibleText: "Weekly Review" },
];

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");
  if (missing.length > 0) {
    console.error("Production network audit requires smoke-test account credentials.");
    console.error(`Missing env vars: ${missing.join(", ")}`);
    process.exit(2);
  }
}

function summarizeRequest(rawUrl, summary) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return;
  }

  const restMarker = "/rest/v1/";
  const markerIndex = parsed.pathname.indexOf(restMarker);
  if (markerIndex === -1) return;

  const endpoint = parsed.pathname.slice(markerIndex + restMarker.length);
  if (endpoint.startsWith("rpc/")) {
    const fn = endpoint.slice(4);
    summary.rpcRequests += 1;
    summary.rpc[fn] = (summary.rpc[fn] ?? 0) + 1;
    if (fn === "get_xp_totals") summary.getXpTotals = true;
    return;
  }

  const table = endpoint.split("/")[0];
  summary.restRequests += 1;
  summary.rest[table] = (summary.rest[table] ?? 0) + 1;

  const query = parsed.searchParams;
  if (table === "xp_events") summary.xpEventsRest = true;
  if (table === "habit_logs" && !query.has("completed_date")) summary.habitLogsUnbounded = true;
  if (table === "finance_transactions" && !query.has("transaction_date")) summary.financeTransactionsUnbounded = true;
}

function makeSummary(route) {
  return {
    route: route.path,
    visibleMs: null,
    networkIdleMs: null,
    restRequests: 0,
    rpcRequests: 0,
    getXpTotals: false,
    xpEventsRest: false,
    habitLogsUnbounded: false,
    financeTransactionsUnbounded: false,
    rest: {},
    rpc: {},
  };
}

async function main() {
  requireConfig();

  console.log("");
  console.log("=== Life Pulse Production Network Audit ===");
  console.log(`Base URL: ${BASE}`);
  console.log("Read-only check: route loads, sanitized Supabase REST/RPC request counts, and timing only.");
  console.log("");

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    console.log("Authenticated smoke-test account.");

    const results = [];
    for (const route of routes) {
      const summary = makeSummary(route);
      const onRequest = (request) => summarizeRequest(request.url(), summary);
      page.on("request", onRequest);

      const start = Date.now();
      await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (page.url().includes("/login")) throw new Error(`${route.label} redirected to login.`);
      await expect(page.locator("body")).toContainText(route.visibleText, { timeout: 30000 });
      summary.visibleMs = Date.now() - start;
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => null);
      summary.networkIdleMs = Date.now() - start;

      page.off("request", onRequest);
      results.push(summary);
    }

    for (const result of results) {
      console.log(`\n${result.route}`);
      console.log(`  visibleMs: ${result.visibleMs}`);
      console.log(`  networkIdleMs: ${result.networkIdleMs}`);
      console.log(`  restRequests: ${result.restRequests}`);
      console.log(`  rpcRequests: ${result.rpcRequests}`);
      console.log(`  get_xp_totals: ${result.getXpTotals ? "yes" : "no"}`);
      console.log(`  xp_events_rest: ${result.xpEventsRest ? "yes" : "no"}`);
      console.log(`  habit_logs_unbounded: ${result.habitLogsUnbounded ? "yes" : "no"}`);
      console.log(`  finance_transactions_unbounded: ${result.financeTransactionsUnbounded ? "yes" : "no"}`);
      console.log(`  restTables: ${JSON.stringify(result.rest)}`);
      console.log(`  rpcFunctions: ${JSON.stringify(result.rpc)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Network audit failed: ${error.message}`);
  process.exit(1);
});
