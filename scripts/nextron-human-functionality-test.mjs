#!/usr/bin/env node

import { chromium, expect } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

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

const appEnv = loadEnv(resolve(__dirname, "..", ".env.local"));
const testEnv = loadEnv(resolve(__dirname, "..", ".env.test.local"));
const env = { ...appEnv, ...testEnv, ...process.env };

const BASE = env.LIFE_PULSE_BASE_URL || "http://localhost:3000";
const HEADLESS = env.LIFE_PULSE_TEST_HEADLESS !== "false";
const EMAIL = env.LIFE_PULSE_TEST_EMAIL;
const PASSWORD = env.LIFE_PULSE_TEST_PASSWORD;

function requireConfig() {
  const missing = [];
  if (!EMAIL) missing.push("LIFE_PULSE_TEST_EMAIL");
  if (!PASSWORD) missing.push("LIFE_PULSE_TEST_PASSWORD");
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    process.exit(2);
  }
}

function pass(label) {
  console.log(`  PASS ${label}`);
}

function mockAskBody(prompt) {
  const conversation = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Human functionality test",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const response = {
    facts: [{ category: "today", text: "This is a bounded visible-response regression check." }],
    interpretation: "NEXTRON received the message and returned a visible, bounded answer for this human-path regression.",
    nextAction: { label: "Open Today", href: "/today", rationale: "Use Today if you want to turn the answer into execution." },
    priority: "calm",
    ruleId: "human_functionality_mock_response",
    supportingEvidence: ["This is a bounded visible-response regression check."],
    source: "deterministic",
  };
  return {
    response,
    source: "deterministic",
    conversation,
    messages: [
      { id: "22222222-2222-4222-8222-222222222222", conversation_id: conversation.id, role: "user", content: prompt, response: null, metadata: {}, created_at: new Date().toISOString() },
      { id: "33333333-3333-4333-8333-333333333333", conversation_id: conversation.id, role: "assistant", content: response.interpretation, response, metadata: { intent: "GENERAL_SUPPORTED" }, created_at: new Date().toISOString() },
    ],
  };
}

function mockBriefBody() {
  return {
    brief: {
      date: "2026-08-11",
      headline: "Human-path brief is visible",
      summary: "The Daily Brief control returned explicit visible feedback in the regression path.",
      priorities: [{ title: "Keep interaction feedback explicit", reason: "Every visible control must respond clearly.", sourceRefs: ["Today"] }],
      scheduleSummary: null,
      openLoops: [],
      recommendedApproach: "Use one visible next step and avoid silent states.",
      generatedAt: new Date().toISOString(),
      sources: ["Today"],
      source: "deterministic",
    },
    meta: { maxPriorities: 3, cache: "test", persisted: false, modelCalls: 0, provider: "deterministic", knowledgeAutomaticRetrieval: false, memoryAutomaticUse: false },
  };
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => undefined);
  if (page.url().includes("/login")) {
    const authError = await page.locator("form").locator("text=/Wrong email|Unable to connect|Something went wrong|Please confirm|Too many attempts/i").first().textContent().catch(() => null);
    throw new Error(`Login did not complete${authError ? `: ${authError}` : "."}`);
  }
}

async function installMocks(page) {
  let askMode = "success";
  await page.route("**/api/nextron/ask", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    if (askMode === "network") return route.abort("failed");
    if (askMode === "api") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "NEXTRON could not answer that request right now. Try again in a moment.", code: "TEST_FAILURE" }) });
    if (askMode === "malformed") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ response: null }) });
    if (askMode === "timeout") await new Promise((resolveDelay) => setTimeout(resolveDelay, 45_000));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockAskBody(String(body?.prompt ?? "test prompt"))) });
  });
  await page.route("**/api/nextron/daily-brief", async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockBriefBody()) });
  });
  return { setAskMode: (mode) => { askMode = mode; } };
}

async function waitForReady(page) {
  await expect(page.locator("#nextron-question")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("#nextron-question-status")).not.toContainText("loading permitted context", { timeout: 60000 });
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ body: document.body.scrollWidth, doc: document.documentElement.scrollWidth, inner: window.innerWidth }));
  if (metrics.body > metrics.inner + 2 || metrics.doc > metrics.inner + 2) throw new Error(`${label} overflow: body=${metrics.body}, doc=${metrics.doc}, inner=${metrics.inner}`);
}

async function askLikeHuman(page, prompt) {
  await page.locator("#nextron-question").fill(prompt);
  await page.getByRole("button", { name: "Send to NEXTRON" }).click();
  await expect(page.locator("#nextron-question-status")).toContainText("received your message", { timeout: 5000 });
  await expect(page.locator('[data-nextron-pending-turn="true"]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator("body")).toContainText(/NEXTRON received the message|NEXTRON did not finish that answer/, { timeout: 15000 });
}

async function exerciseControls(page) {
  await expect(page.getByRole("heading", { name: "NEXTRON" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Talk to NEXTRON")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading", { name: "What should we work through?" })).toBeVisible({ timeout: 10000 });
  await expect(page.locator("#nextron-question")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "Send to NEXTRON" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "What should I focus on today?" }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "What needs my attention?" }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "What can you help me with?" }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator("summary").filter({ hasText: "More intelligence" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("NEXTRON Signals")).toBeHidden({ timeout: 10000 });

  await askLikeHuman(page, "What can you help me with?");
  pass("composer submit has acknowledgement and visible result");

  await page.locator("#nextron-question").fill("How am I doing?");
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toContainText("NEXTRON received the message", { timeout: 15000 });
  pass("Enter-key submit has visible result");

  const quickQuestion = page.getByRole("button", { name: "What should I focus on today?" }).first();
  if (await quickQuestion.isVisible().catch(() => false)) {
    await quickQuestion.click();
    await expect(page.locator("body")).toContainText("NEXTRON received the message", { timeout: 15000 });
    pass("quick question control asks visibly");
  }

  await page.locator("summary").filter({ hasText: "More intelligence" }).click();
  await expect(page.getByText("History, live context, Signals, Actions, and permissions.")).toBeVisible({ timeout: 10000 });
  pass("secondary intelligence is reachable by disclosure");

  await expect(page.getByRole("button", { name: "New conversation" })).toBeVisible({ timeout: 10000 });
  pass("conversation reset control is reachable in secondary intelligence");

  const attentionRefresh = page.locator('[data-nextron-attention="true"]').getByRole("button", { name: /Refresh|Checking/ });
  if (await attentionRefresh.isVisible().catch(() => false)) {
    await attentionRefresh.click();
    await expect(attentionRefresh).toBeVisible({ timeout: 10000 });
    pass("attention refresh gives visible state");
  } else {
    pass("compact attention stays quiet when nothing meaningful surfaces");
  }

  const signalsRefresh = page.locator('[data-nextron-signals="true"]').getByRole("button", { name: /Refresh signals|Refreshing/ });
  await signalsRefresh.click();
  await expect(signalsRefresh).toBeVisible({ timeout: 10000 });
  pass("signals refresh gives visible state");

  const actionRefresh = page.locator('[data-nextron-actions="true"]').getByRole("button", { name: /Refresh proposals|Loading/ });
  await actionRefresh.click();
  await expect(actionRefresh).toBeVisible({ timeout: 10000 });
  pass("proposal refresh gives visible state");

  const briefButton = page.locator('[data-nextron-daily-brief="true"]').getByRole("button", { name: /Generate brief|Refresh brief|Generating/ });
  if (await briefButton.isEnabled().catch(() => false)) {
    await briefButton.click();
    await expect(page.locator('[data-nextron-daily-brief="true"]')).toContainText(/Reviewing current|Human-path brief is visible/, { timeout: 10000 });
    pass("daily brief control gives visible state");
  }

  await page.getByText("Context permissions and access controls").click();
  await expect(page.getByText("Saved permissions control what evidence enters NEXTRON")).toBeVisible({ timeout: 10000 });
  pass("context permissions disclosure opens visibly");
}

async function exerciseErrorPaths(page, controls) {
  async function askExpectError(mode, prompt, label) {
    controls.setAskMode(mode);
    await page.locator("#nextron-question").fill(prompt);
    await page.getByRole("button", { name: "Send to NEXTRON" }).click();
    await expect(page.locator('[data-nextron-ask-error="true"]')).toBeVisible({ timeout: mode === "timeout" ? 45000 : 10000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 5000 });
    pass(`${label} shows retryable error`);
  }

  await page.locator("#nextron-question").fill("Busy path check");
  controls.setAskMode("timeout");
  await page.getByRole("button", { name: "Send to NEXTRON" }).click();
  await expect(page.locator('[data-nextron-pending-turn="true"]')).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Ask about today" }).first().click();
  await expect(page.locator("#nextron-question-status")).toContainText("already answering", { timeout: 5000 });
  pass("busy repeated ask gives visible feedback");
  await expect(page.locator('[data-nextron-ask-error="true"]')).toBeVisible({ timeout: 45000 });
  pass("timeout path shows retryable error");

  controls.setAskMode("success");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("body")).toContainText("NEXTRON received the message", { timeout: 15000 });
  pass("retry recovers after timeout");

  await askExpectError("network", "Network failure path", "network failure");
  await askExpectError("api", "API failure path", "non-200 API failure");
  await askExpectError("malformed", "Malformed response path", "malformed response");
  controls.setAskMode("success");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("body")).toContainText("NEXTRON received the message", { timeout: 15000 });
  pass("retry recovers after malformed response");
}

async function runViewport(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const controls = await installMocks(page);
  await login(page);
  await page.goto(`${BASE}/nextron`, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (page.url().includes("/login")) throw new Error(`${label} redirected to login`);
  if (page.url().includes("/onboarding")) throw new Error(`${label} redirected to onboarding; use an onboarded QA account`);
  await waitForReady(page);
  await exerciseControls(page);
  if (label === "desktop") await exerciseErrorPaths(page, controls);
  const firstScreen = await page.evaluate(() => ({ composerTop: document.querySelector("#nextron-question")?.getBoundingClientRect().top ?? 9999, answerTop: document.querySelector("#nextron-answer")?.getBoundingClientRect().top ?? 9999 }));
  if (firstScreen.composerTop > viewport.height || firstScreen.answerTop > viewport.height * 1.4) throw new Error(`${label} does not keep conversation primary enough: ${JSON.stringify(firstScreen)}`);
  await assertNoOverflow(page, label);
  await context.close();
  pass(`${label} human-path controls verified`);
}

async function main() {
  requireConfig();
  console.log("\n=== NEXTRON Human Functionality Browser QA ===");
  console.log(`Base URL: ${BASE}`);
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    await runViewport(browser, { width: 1440, height: 960 }, "desktop");
    await runViewport(browser, { width: 390, height: 844 }, "390px mobile");
    await runViewport(browser, { width: 320, height: 780 }, "320px narrow mobile");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
