#!/usr/bin/env node

// Life Pulse Mobile Auth Proof
// Proves mobile can authenticate with same Supabase Auth as web.

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(filepath) {
  if (!existsSync(filepath)) return {};
  const vars = {};
  for (const line of readFileSync(filepath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const env = {
  ...loadEnv(resolve(__dirname, "..", ".env.local")),
  ...process.env,
};

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.RLS_TEST_USER_A_EMAIL || process.env.LIFE_PULSE_QA_EMAIL;
const PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD || process.env.LIFE_PULSE_QA_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error("Missing test credentials (RLS_TEST_USER_A_EMAIL/PASSWORD or LIFE_PULSE_QA_EMAIL/PASSWORD)");
  process.exit(1);
}

console.log("=== Life Pulse Mobile Auth Proof ===");
console.log("");

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS ${label}`);
    passed++;
  } else {
    console.log(`  FAIL ${label}`);
    failed++;
  }
}

// Create mobile-style client
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Sign in
console.log("1. Sign in with email/password");
const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
assert(!error, "No sign-in error");
assert(Boolean(data.user), "User object returned");
assert(Boolean(data.session), "Session object returned");
assert(data.user.email?.toLowerCase() === EMAIL.toLowerCase(), "User email matches");

const userId = data.user.id;
console.log(`  User ID: ${userId}`);
console.log("");

// 2. Session contains JWT
console.log("2. Session contains valid JWT");
const token = data.session.access_token;
assert(Boolean(token), "Access token exists");
assert(token.split(".").length === 3, "Token is valid JWT format");

const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
assert(payload.sub === userId, "JWT sub matches user ID");
assert(payload.role === "authenticated", "JWT role is authenticated");
console.log(`  JWT role: ${payload.role}`);
console.log(`  JWT expires: ${new Date(payload.exp * 1000).toISOString()}`);
console.log("");

// 3. Get current session
console.log("3. Get current session");
const { data: sessionData } = await client.auth.getSession();
assert(Boolean(sessionData.session), "Session retrieved");
assert(sessionData.session.user.id === userId, "Session user matches");
console.log("");

// 4. Get current user
console.log("4. Get current user");
const { data: userData } = await client.auth.getUser();
assert(Boolean(userData.user), "User retrieved");
assert(userData.user.id === userId, "User matches");
console.log("");

// 5. Sign out
console.log("5. Sign out");
const { error: signOutError } = await client.auth.signOut();
assert(!signOutError, "No sign-out error");

const { data: postSignOut } = await client.auth.getSession();
assert(!postSignOut.session, "No session after sign out");
console.log("");

// Summary
console.log("─".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("");

if (failed > 0) {
  console.error("AUTH PROOF FAILED");
  process.exit(1);
} else {
  console.log("AUTH PROOF PASSED — Mobile client authenticates with same Supabase Auth as web.");
}
