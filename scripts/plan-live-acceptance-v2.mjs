// PLAN V1 Prompt 2 live RLS acceptance (daily priorities + plan events).
// Same safe pattern as plan-live-acceptance.mjs: privileged key ONLY for
// QA provisioning/cleanup; ALL assertions run as normal anon sessions.
// Requires applied migration 00045 + .env.test.local (URL/secret/ACK=1).
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
function loadEnv(p) {
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}
const env = { ...loadEnv(resolve(root, ".env.local")), ...loadEnv(resolve(root, ".env.test.local")), ...process.env };
const APP_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const QA_URL = env.SUPABASE_URL;
const ADMIN_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const ACK = env.LIFE_PULSE_RLS_LIVE_WRITE_ACK === "1";
const hostOf = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "?";
  }
};
if (!APP_URL || !ANON_KEY || !QA_URL || !ADMIN_KEY || !ACK) {
  console.error("Missing QA env. Refusing.");
  process.exit(2);
}
if (hostOf(QA_URL) !== hostOf(APP_URL)) {
  console.error("Project mismatch. Refusing.");
  process.exit(2);
}
console.log(`QA target host: ${hostOf(QA_URL)} (matches app project)`);

let passed = 0;
let failed = 0;
const failures = [];
function pass(m) {
  passed += 1;
  console.log(`  PASS ${m}`);
}
function fail(m) {
  failed += 1;
  failures.push(m);
  console.log(`  FAIL ${m}`);
}
const errClass = (e) => (e ? `${e.code ?? "?"}:${String(e.message ?? "").slice(0, 90)}` : "no-error");

function adminClient() {
  return createClient(QA_URL, ADMIN_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
function anonClient() {
  return createClient(QA_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
const supabaseA = anonClient();
const supabaseB = anonClient();
const admin = adminClient();
{
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.error(`Admin validation failed: ${errClass(error)}`);
    process.exit(2);
  }
  pass("admin credential valid (provisioning/cleanup only)");
}

const RUN = `pland-${Date.now().toString(36)}`;
async function createQaUser(label) {
  const email = `plan-qa-${label}-${RUN}@example.invalid`;
  const password = `Pl-${randomBytes(24).toString("base64url")}!9x`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { plan_qa_run: RUN, disposable: true },
  });
  if (error || !data.user?.id) throw new Error(`provision ${label}: ${errClass(error)}`);
  return { email, password, userId: data.user.id };
}
const qaA = await createQaUser("da");
const qaB = await createQaUser("db");
pass("PLAN QA A/B provisioned confirmed");
async function signInAnon(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`signin failed: ${errClass(error)}`);
  return data.user.id;
}
const userAId = await signInAnon(supabaseA, qaA.email, qaA.password);
const userBId = await signInAnon(supabaseB, qaB.email, qaB.password);
const TODAY = new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0") + "-" + String(new Date().getDate()).padStart(2, "0");

// Own entities for link-ownership checks.
const { data: taskA } = await supabaseA.from("tasks").insert({ title: `QA T ${RUN}`, user_id: userAId }).select().single();
const { data: realmA } = await supabaseA.from("realms").insert({ name: `QA R ${RUN}`, color: "#6366f1", icon: "star", user_id: userAId }).select().single();
const { data: habitA } = await supabaseA.from("habits").insert({ title: `QA H ${RUN}`, user_id: userAId, realm_id: realmA.id }).select().single();
const { data: taskB } = await supabaseB.from("tasks").insert({ title: `QB T ${RUN}`, user_id: userBId }).select().single();
const { data: realmB } = await supabaseB.from("realms").insert({ name: `QB Realm ${RUN}`, color: "#6366f1", icon: "star", user_id: userBId }).select().single();
const { data: habitB } = await supabaseB.from("habits").insert({ title: `QB H ${RUN}`, user_id: userBId, realm_id: realmB.id }).select().single();

// A owner CRUD on priorities.
const { data: p1, error: p1Err } = await supabaseA
  .from("today_priorities")
  .insert({ user_id: userAId, local_date: TODAY, position: 1, text: "QA day one", task_id: taskA.id })
  .select()
  .single();
if (p1Err || !p1) fail(`A create priority: ${errClass(p1Err)}`);
else pass("A creates priority with task link");
{
  const { error } = await supabaseA.from("today_priorities").update({ done: true }).eq("id", p1.id);
  if (!error) pass("A updates own priority");
  else fail(`A update priority: ${errClass(error)}`);
}

// B cannot read/touch A's priorities.
{
  const { data } = await supabaseB.from("today_priorities").select("id").eq("user_id", userAId);
  if (!data || data.length === 0) pass("B reads zero A priorities");
  else fail("B read A priorities");
}
{
  const { data, error } = await supabaseB.from("today_priorities").update({ text: "hijack" }).eq("id", p1.id).select();
  if ((!data || data.length === 0) && true) pass("B cannot alter A priority (0 rows)");
  else fail(`B altered A priority: ${errClass(error)}`);
}
{
  const { data } = await supabaseB.from("today_priorities").delete().eq("id", p1.id).select();
  if (!data || data.length === 0) pass("B cannot delete A priority (0 rows)");
  else fail("B deleted A priority");
}

// Cross-user link rejection (habit exists under B → RLS must reject, not FK).
{
  const { error } = await supabaseA
    .from("today_priorities")
    .insert({ user_id: userAId, local_date: TODAY, position: 2, text: "QA foreign", habit_id: habitB.id })
    .select();
  if (error && String(error.code) === "42501") pass(`foreign habit link rejected by RLS (${errClass(error)})`);
  else fail(`foreign habit link not RLS-rejected: ${errClass(error)}`);
}
{
  const { error } = await supabaseA
    .from("today_priorities")
    .insert({ user_id: userAId, local_date: TODAY, position: 2, text: "QA foreign task", task_id: taskB.id })
    .select();
  if (error && String(error.code) === "42501") pass(`foreign task link rejected by RLS (${errClass(error)})`);
  else fail(`foreign task link not RLS-rejected: ${errClass(error)}`);
}

// Single-reference CHECK + must_win partial unique at DB level.
{
  const { error } = await supabaseA
    .from("today_priorities")
    .insert({ user_id: userAId, local_date: TODAY, position: 2, text: "QA double", task_id: taskA.id, habit_id: habitA.id })
    .select();
  if (error && String(error.code) === "23514") pass(`double reference rejected by DB CHECK (${error.code})`);
  else fail(`double reference not DB-rejected: ${errClass(error)}`);
}
const { data: p2 } = await supabaseA
  .from("today_priorities")
  .insert({ user_id: userAId, local_date: TODAY, position: 2, text: "QA day two" })
  .select()
  .single();
await supabaseA.from("today_priorities").update({ is_must_win: true }).eq("id", p1.id);
{
  const { error } = await supabaseA.from("today_priorities").update({ is_must_win: true }).eq("id", p2.id);
  if (error && String(error.code) === "23505") pass(`second Daily Must Win rejected (unique ${error.code})`);
  else fail(`second must_win not rejected: ${errClass(error)}`);
}
await supabaseA.from("today_priorities").update({ is_must_win: false }).eq("id", p1.id);

// Events: insert allowed, update/delete denied (append-only).
{
  const { error: insErr } = await supabaseA
    .from("daily_plan_events")
    .insert({ user_id: userAId, local_date: TODAY, event_type: "morning_plan_confirmed", priority_id: p1.id });
  if (!insErr) pass("A appends plan event");
  else fail(`A event insert: ${errClass(insErr)}`);
  const { data: ev } = await supabaseA.from("daily_plan_events").select("id").eq("user_id", userAId).eq("local_date", TODAY).limit(1);
  const evId = ev && ev[0] && ev[0].id;
  const { error: updErr } = await supabaseA.from("daily_plan_events").update({ detail: "x" }).eq("id", evId);
  if (updErr) pass(`event update denied (${errClass(updErr)})`);
  else fail("event update allowed (must be append-only)");
  const { error: delErr } = await supabaseA.from("daily_plan_events").delete().eq("id", evId);
  if (delErr) pass(`event delete denied (${errClass(delErr)})`);
  else fail("event delete allowed (must be append-only)");
  const { data: bEvents } = await supabaseB.from("daily_plan_events").select("id").eq("user_id", userAId);
  if (!bEvents || bEvents.length === 0) pass("B reads zero A events");
  else fail("B read A events");
  const { error: bInsErr } = await supabaseB
    .from("daily_plan_events")
    .insert({ user_id: userBId, local_date: TODAY, event_type: "midday_reset", priority_id: p1.id });
  if (bInsErr) pass(`B cannot log events against A priority (${errClass(bInsErr)})`);
  else fail("B logged event against A priority");
}

// Anonymous sees nothing.
{
  const anon = anonClient();
  const { data } = await anon.from("today_priorities").select("id").limit(1);
  if (!data || data.length === 0) pass("anonymous reads zero priorities");
  else fail("anonymous read priorities");
}

// Cleanup.
{
  let residue = 0;
  for (const id of [qaA.userId, qaB.userId]) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) fail(`delete QA user: ${errClass(error)}`);
  }
  for (const table of ["today_priorities", "daily_plan_events"]) {
    const { count } = await admin.from(table).select("user_id", { count: "exact", head: true }).in("user_id", [qaA.userId, qaB.userId]);
    residue += count ?? 0;
  }
  if (residue === 0) pass("QA users + rows fully cleaned (residue=0)");
  else fail(`cleanup residue: rows=${residue}`);
}

console.log("");
console.log(`PLAN daily live acceptance: pass=${passed} fail=${failed}`);
if (failed > 0) process.exit(1);
