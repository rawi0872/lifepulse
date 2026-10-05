// PLAN V1 live acceptance (Prompt 1/3 correction).
// Pattern reused from scripts/rls-smoke-test.mjs:
// - privileged key ONLY for QA provisioning, schema inspection, cleanup
// - ALL RLS/data assertions run as normal anon-key authenticated sessions
// - never prints secrets (hostnames + id suffixes only)
// Requires: .env.test.local with SUPABASE_URL, SUPABASE_SECRET_KEY,
// LIFE_PULSE_RLS_LIVE_WRITE_ACK=1. Refuses to run otherwise.
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

const env = {
  ...loadEnv(resolve(root, ".env.local")),
  ...loadEnv(resolve(root, ".env.test.local")),
  ...process.env,
};
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
  console.error("Missing QA env (SUPABASE_URL / secret / ACK). Refusing.");
  process.exit(2);
}
if (hostOf(QA_URL) !== hostOf(APP_URL)) {
  console.error(`Project mismatch: qa=${hostOf(QA_URL)} app=${hostOf(APP_URL)}. Refusing.`);
  process.exit(2);
}
console.log(`QA target host: ${hostOf(QA_URL)} (matches app project)`);
console.log("ACK: live-write acknowledged");

const RUN = `plan-${Date.now().toString(36)}`;
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
const shortId = (id) => (typeof id === "string" ? `...${id.slice(-6)}` : "?");
const errClass = (e) => (e ? `${e.code ?? "?"}:${String(e.message ?? "").slice(0, 90)}` : "no-error");

function adminClient() {
  return createClient(QA_URL, ADMIN_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
function anonClient() {
  return createClient(QA_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
const supabaseA = anonClient();
const supabaseB = anonClient();

const mondayOf = (d) => {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};
const WEEK_START = mondayOf(new Date());
const weekEndOf = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 6);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};
const WEEK_END = weekEndOf(WEEK_START);
console.log(`Test week: ${WEEK_START} .. ${WEEK_END}`);

const admin = adminClient();
// Admin credential validation (no secrets printed).
{
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.error(`Admin validation failed: ${errClass(error)}`);
    process.exit(2);
  }
  pass("admin credential valid (provisioning/cleanup only)");
}

// --- tables exist? (read-only REST probe as anon) ---
for (const t of ["weekly_plans", "weekly_outcomes", "weekly_plan_links"]) {
  const res = await fetch(`${QA_URL}/rest/v1/${t}?select=id&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (res.status === 404) fail(`${t} missing remotely (PGRST205)`);
  else pass(`${t} reachable remotely (http=${res.status})`);
}
if (failed > 0) {
  console.error("Tables missing — cannot continue.");
  process.exit(1);
}

// --- live RLS/constraint behavior: anonymous (signed-out) sees nothing ---
{
  const anon = anonClient();
  const { data } = await anon.from("weekly_plans").select("id").limit(1);
  if (!data || data.length === 0) pass("anonymous reads zero plan rows (RLS, no anon grants)");
  else fail("anonymous can read plan rows");
}




// --- provision PLAN QA A + B (confirmed, tagged, random passwords) ---
function qaPassword() {
  return `Pl-${randomBytes(24).toString("base64url")}!9x`;
}
async function createQaUser(label) {
  const email = `plan-qa-${label}-${RUN}@example.invalid`;
  const password = qaPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { plan_qa_run: RUN, disposable: true },
  });
  if (error || !data.user?.id) throw new Error(`provision ${label}: ${errClass(error)}`);
  return { email, password, userId: data.user.id };
}
const qaA = await createQaUser("a");
const qaB = await createQaUser("b");
pass(`PLAN QA A/B provisioned confirmed (${shortId(qaA.userId)}, ${shortId(qaB.userId)})`);

async function signInAnon(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`signin failed: ${errClass(error)}`);
  return data.user.id;
}
const userAId = await signInAnon(supabaseA, qaA.email, qaA.password);
const userBId = await signInAnon(supabaseB, qaB.email, qaB.password);
if (userAId === qaA.userId && userBId === qaB.userId) pass("anon sessions match provisioned users");
else fail("anon session identity mismatch");

// --- §8 User A owner flows ---
let planAId = null;
{
  const { data: plan, error } = await supabaseA
    .from("weekly_plans")
    .insert({ user_id: userAId, week_start: WEEK_START, week_end: WEEK_END, intention: "QA week" })
    .select()
    .single();
  if (error || !plan) fail(`A create plan: ${errClass(error)}`);
  else {
    planAId = plan.id;
    pass("A created own weekly plan");
  }
  const { data: readBack } = await supabaseA.from("weekly_plans").select("*").eq("id", planAId);
  if (readBack && readBack.length === 1) pass("A reads own plan");
  else fail("A cannot read own plan");
  const createdUpdatedAt = plan.updated_at;
  await new Promise((r) => setTimeout(r, 1200));
  const { error: updErr } = await supabaseA.from("weekly_plans").update({ intention: "QA week v2" }).eq("id", planAId);
  if (!updErr) pass("A updates own plan");
  else fail(`A update plan: ${errClass(updErr)}`);
  const { data: reread } = await supabaseA.from("weekly_plans").select("updated_at").eq("id", planAId).single();
  if (reread && reread.updated_at && reread.updated_at !== createdUpdatedAt) {
    pass("updated_at trigger fires live");
  } else {
    fail(`updated_at trigger did not fire: ${JSON.stringify(reread)}`);
  }
}
const outcomeIds = [];
for (const [i, text] of ["QA outcome one", "QA outcome two"].entries()) {
  const { data, error } = await supabaseA
    .from("weekly_outcomes")
    .insert({ user_id: userAId, plan_id: planAId, position: i + 1, text })
    .select()
    .single();
  if (error || !data) fail(`A create outcome ${i + 1}: ${errClass(error)}`);
  else outcomeIds.push(data.id);
}
if (outcomeIds.length === 2) pass("A created 2 outcomes");
{
  const { error } = await supabaseA.from("weekly_outcomes").update({ done: true }).eq("id", outcomeIds[0]);
  if (!error) pass("A updates own outcome");
  else fail(`A update outcome: ${errClass(error)}`);
}

// QA entities via normal paths (A and B).
async function makeEntities(client, userId, tag) {
  const { data: realm } = await client.from("realms").insert({ name: `QA Realm ${tag}`, color: "#6366f1", icon: "star", user_id: userId }).select().single();
  const { data: goal } = await client.from("goals").insert({ title: `QA Goal ${tag}`, user_id: userId }).select().single();
  const { data: project } = await client.from("projects").insert({ title: `QA Project ${tag}`, user_id: userId }).select().single();
  const { data: task } = await client.from("tasks").insert({ title: `QA Task ${tag}`, user_id: userId }).select().single();
  const { data: habit } = await client.from("habits").insert({ title: `QA Habit ${tag}`, user_id: userId, realm_id: realm.id }).select().single();
  return { goal, project, task, habit };
}
const entA = await makeEntities(supabaseA, userAId, `A-${RUN}`);
const entB = await makeEntities(supabaseB, userBId, `B-${RUN}`);
if (entA.goal && entA.project && entA.task && entA.habit && entB.goal && entB.project && entB.task && entB.habit) {
  pass("QA entities created for A and B via normal paths");
} else {
  fail("QA entity setup failed");
}

// A links own entities (goal/project on outcome, task/habit on plan).
{
  const { error: e1 } = await supabaseA.from("weekly_outcomes").update({ goal_id: entA.goal.id, project_id: entA.project.id }).eq("id", outcomeIds[0]);
  const { error: e2 } = await supabaseA.from("weekly_plan_links").insert({ user_id: userAId, plan_id: planAId, linked_type: "task", linked_id: entA.task.id });
  const { error: e3 } = await supabaseA.from("weekly_plan_links").insert({ user_id: userAId, plan_id: planAId, linked_type: "habit", linked_id: entA.habit.id });
  if (!e1 && !e2 && !e3) pass("A links own goal/project/task/habit");
  else fail(`A own-entity links: ${errClass(e1 || e2 || e3)}`);
}

// --- §9 B isolation (every attempt must fail at DB/RLS) ---
async function mustFail(label, fn, kind) {
  const res = await fn();
  if (kind === "insert") {
    // RLS WITH CHECK rejections surface as errors.
    if (res && res.error) pass(`B denied: ${label} (${errClass(res.error)})`);
    else fail(`B NOT denied: ${label}`);
    return;
  }
  // RLS-blocked select/update/delete on existing rows returns zero rows.
  const rows = Array.isArray(res?.data) ? res.data : res?.data ? [res.data] : [];
  if (rows.length === 0) pass(`B denied: ${label} (0 rows)`);
  else fail(`B NOT denied: ${label}`);
}
await mustFail("read A plan", () => supabaseB.from("weekly_plans").select("*").eq("id", planAId), "read");
await mustFail("update A plan", () => supabaseB.from("weekly_plans").update({ intention: "hijack" }).eq("id", planAId).select(), "write");
await mustFail("delete A plan", () => supabaseB.from("weekly_plans").delete().eq("id", planAId).select(), "write");
await mustFail("add outcome to A plan", () =>
  supabaseB.from("weekly_outcomes").insert({ user_id: userBId, plan_id: planAId, position: 3, text: "hijack" }).select(), "insert",
);
await mustFail("alter A outcome", () => supabaseB.from("weekly_outcomes").update({ text: "hijack" }).eq("id", outcomeIds[0]).select(), "write");
await mustFail("link into A plan", () =>
  supabaseB.from("weekly_plan_links").insert({ user_id: userBId, plan_id: planAId, linked_type: "task", linked_id: entB.task.id }).select(), "insert",
);

// --- §10 cross-user entity link rejection ---
await mustFail("A links B goal", () =>
  supabaseA.from("weekly_outcomes").update({ goal_id: entB.goal.id }).eq("id", outcomeIds[1]).select(), "insert",
);
await mustFail("A links B project", () =>
  supabaseA.from("weekly_outcomes").update({ project_id: entB.project.id }).eq("id", outcomeIds[1]).select(), "insert",
);
await mustFail("A links B task", () =>
  supabaseA.from("weekly_plan_links").insert({ user_id: userAId, plan_id: planAId, linked_type: "task", linked_id: entB.task.id }).select(), "insert",
);
await mustFail("A links B habit", () =>
  supabaseA.from("weekly_plan_links").insert({ user_id: userAId, plan_id: planAId, linked_type: "habit", linked_id: entB.habit.id }).select(), "insert",
);

// --- §§4-6 cross-plan regression, both directions + squatting ---
// B builds its own plan first (also proves B owner CRUD on own rows).
let planBId = null;
let outcomeBId = null;
let linkBId = null;
{
  const { data: planB, error: planBErr } = await supabaseB
    .from("weekly_plans")
    .insert({ user_id: userBId, week_start: WEEK_START, week_end: WEEK_END })
    .select()
    .single();
  if (planBErr || !planB) fail(`B create own plan: ${errClass(planBErr)}`);
  else {
    planBId = planB.id;
    pass("B created own weekly plan");
  }
  const { data: ob } = await supabaseB
    .from("weekly_outcomes")
    .insert({ user_id: userBId, plan_id: planBId, position: 1, text: "B outcome" })
    .select()
    .single();
  outcomeBId = ob?.id ?? null;
  const { data: lb } = await supabaseB
    .from("weekly_plan_links")
    .insert({ user_id: userBId, plan_id: planBId, linked_type: "task", linked_id: entB.task.id })
    .select()
    .single();
  linkBId = lb?.id ?? null;
  if (outcomeBId && linkBId) pass("B created own outcome + link");
  else fail("B own-plan setup failed");
}
// A → B direction (must all be rejected).
await mustFail("A outcome INSERT into B plan", () =>
  supabaseA.from("weekly_outcomes").insert({ user_id: userAId, plan_id: planBId, position: 2, text: "x" }).select(), "insert",
);
await mustFail("A link INSERT into B plan", () =>
  supabaseA.from("weekly_plan_links").insert({ user_id: userAId, plan_id: planBId, linked_type: "task", linked_id: entA.task.id }).select(), "insert",
);
await mustFail("A outcome UPDATE reparent into B plan", () =>
  supabaseA.from("weekly_outcomes").update({ plan_id: planBId }).eq("id", outcomeIds[1]).select(), "insert",
);
{
  const { data: o } = await supabaseA.from("weekly_outcomes").select("plan_id").eq("id", outcomeIds[1]).single();
  if (o && o.plan_id === planAId) pass("A outcome not reparented");
  else fail(`A outcome moved: ${JSON.stringify(o)}`);
}
// B → A reparent direction (must all be rejected).
await mustFail("B outcome UPDATE reparent into A plan", () =>
  supabaseB.from("weekly_outcomes").update({ plan_id: planAId }).eq("id", outcomeBId).select(), "insert",
);
{
  const { data: o } = await supabaseB.from("weekly_outcomes").select("plan_id").eq("id", outcomeBId).single();
  if (o && o.plan_id === planBId) pass("B outcome not reparented");
  else fail(`B outcome moved: ${JSON.stringify(o)}`);
}
await mustFail("B link UPDATE reparent into A plan", () =>
  supabaseB.from("weekly_plan_links").update({ plan_id: planAId }).eq("id", linkBId).select(), "insert",
);
// Position squat: B must be RLS-rejected (not merely unique-blocked).
await mustFail("B position-3 squat into A plan", () =>
  supabaseB.from("weekly_outcomes").insert({ user_id: userBId, plan_id: planAId, position: 3, text: "squat" }).select(), "insert",
);
// Must-win squat: B must be RLS-rejected.
await mustFail("B must_win squat into A plan", () =>
  supabaseB.from("weekly_outcomes").insert({ user_id: userBId, plan_id: planAId, position: 3, text: "squat", must_win: true }).select(), "insert",
);

// --- §11 duplicate plan ---
{
  const { error } = await supabaseA
    .from("weekly_plans")
    .insert({ user_id: userAId, week_start: WEEK_START, week_end: WEEK_END })
    .select();
  if (error && String(error.code) === "23505") pass(`duplicate plan rejected (unique ${error.code})`);
  else fail(`duplicate plan not rejected: ${errClass(error)}`);
}

// --- §12 must_win partial unique ---
{
  const { error: first } = await supabaseA.from("weekly_outcomes").update({ must_win: true }).eq("id", outcomeIds[0]);
  const { error: second } = await supabaseA.from("weekly_outcomes").update({ must_win: true }).eq("id", outcomeIds[1]);
  if (!first && second && String(second.code) === "23505") pass(`second must_win rejected (unique ${second.code})`);
  else fail(`must_win invariant: first=${errClass(first)} second=${errClass(second)}`);
  await supabaseA.from("weekly_outcomes").update({ must_win: false }).eq("id", outcomeIds[0]);
  await supabaseA.from("weekly_outcomes").update({ must_win: true }).eq("id", outcomeIds[1]);
  const { data: wins } = await supabaseA.from("weekly_outcomes").select("id").eq("plan_id", planAId).eq("must_win", true);
  if (wins && wins.length === 1 && wins[0].id === outcomeIds[1]) pass("valid Must Win state restored");
  else fail("Must Win restore failed");
}

// --- §13 positions: 1-3 ok, 4 rejected by DB CHECK ---
{
  const { data: third, error: thirdErr } = await supabaseA
    .from("weekly_outcomes")
    .insert({ user_id: userAId, plan_id: planAId, position: 3, text: "QA outcome three" })
    .select()
    .single();
  if (thirdErr || !third) fail(`position 3 insert: ${errClass(thirdErr)}`);
  else pass("positions 1-3 accepted");
  const { error: fourthErr } = await supabaseA
    .from("weekly_outcomes")
    .insert({ user_id: userAId, plan_id: planAId, position: 4, text: "QA outcome four" })
    .select();
  if (fourthErr && String(fourthErr.code) === "23514") pass(`position 4 rejected by DB CHECK (${fourthErr.code})`);
  else fail(`position 4 not DB-rejected: ${errClass(fourthErr)}`);
  if (third) await supabaseA.from("weekly_outcomes").delete().eq("id", third.id);
}

// --- §14 goal/project delete → outcome survives, refs null ---
{
  await supabaseA.from("goals").delete().eq("id", entA.goal.id);
  await supabaseA.from("projects").delete().eq("id", entA.project.id);
  const { data: outcome } = await supabaseA.from("weekly_outcomes").select("id,goal_id,project_id").eq("id", outcomeIds[0]).single();
  if (outcome && outcome.goal_id === null && outcome.project_id === null) pass("outcome survived goal/project delete with null refs");
  else fail(`delete behavior wrong: ${JSON.stringify(outcome)}`);
}

// --- §15 canonicality: edit task + log habit, reload reflects live rows ---
{
  await supabaseA.from("tasks").update({ title: "QA Task A edited", status: "done" }).eq("id", entA.task.id);
  await supabaseA.from("habit_logs").insert({ user_id: userAId, habit_id: entA.habit.id, completed_date: WEEK_START });
  const { data: task } = await supabaseA.from("tasks").select("title,status").eq("id", entA.task.id).single();
  const { data: links } = await supabaseA.from("weekly_plan_links").select("linked_id").eq("plan_id", planAId).eq("linked_type", "task");
  const { data: logs } = await supabaseA.from("habit_logs").select("completed_date").eq("habit_id", entA.habit.id).eq("completed_date", WEEK_START);
  if (task && task.title === "QA Task A edited" && task.status === "done" && links?.some((l) => l.linked_id === entA.task.id) && logs?.length === 1) {
    pass("plan reflects canonical task/habit rows (no copies)");
  } else {
    fail("canonical reflection failed");
  }
}

// --- unlink / relink round-trip (edit proof, no duplication) ---
{
  const { data: before } = await supabaseA.from("weekly_plan_links").select("id").eq("plan_id", planAId).eq("linked_type", "task").eq("linked_id", entA.task.id);
  const linkId = before && before[0] && before[0].id;
  await supabaseA.from("weekly_plan_links").delete().eq("id", linkId);
  const { data: gone } = await supabaseA.from("weekly_plan_links").select("id").eq("id", linkId);
  const { data: relinked, error: relinkErr } = await supabaseA
    .from("weekly_plan_links")
    .insert({ user_id: userAId, plan_id: planAId, linked_type: "task", linked_id: entA.task.id })
    .select();
  const { data: after } = await supabaseA.from("weekly_plan_links").select("id").eq("plan_id", planAId).eq("linked_type", "task").eq("linked_id", entA.task.id);
  if ((!gone || gone.length === 0) && !relinkErr && after && after.length === 1) {
    pass("unlink / relink round-trip works, no duplication");
  } else {
    fail(`unlink/relink wrong: gone=${JSON.stringify(gone)} relink=${errClass(relinkErr)}`);
  }
}

// --- Today bridge value matches Must Win (§10 cross-client data) ---
{
  const { data: win } = await supabaseA.from("weekly_outcomes").select("text").eq("plan_id", planAId).eq("must_win", true).maybeSingle();
  if (win && win.text === "QA outcome two") pass(`bridge Must Win resolves: ${JSON.stringify(win.text)}`);
  else fail(`bridge Must Win wrong: ${JSON.stringify(win)}`);
}

// --- §22 week values on the live row ---
{
  const { data: plan } = await supabaseA.from("weekly_plans").select("week_start,week_end").eq("id", planAId).single();
  if (plan && plan.week_start === WEEK_START && plan.week_end === WEEK_END) {
    pass(`live row week ${plan.week_start}..${plan.week_end} (Monday..Sunday)`);
  } else fail(`live row week wrong: ${JSON.stringify(plan)}`);
}

// --- §24 cleanup: delete QA users (cascades QA rows), verify zero residue ---
{
  let residue = 0;
  for (const [label, id] of [["A", qaA.userId], ["B", qaB.userId]]) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) fail(`delete QA ${label}: ${errClass(error)}`);
  }
  for (const table of ["weekly_plans", "weekly_outcomes", "weekly_plan_links"]) {
    const { count } = await admin.from(table).select("user_id", { count: "exact", head: true }).in("user_id", [qaA.userId, qaB.userId]);
    residue += count ?? 0;
  }
  const { data: goneA } = await admin.auth.admin.getUserById(qaA.userId).catch(() => ({ data: null }));
  const { data: goneB } = await admin.auth.admin.getUserById(qaB.userId).catch(() => ({ data: null }));
  if (residue === 0 && !goneA?.user && !goneB?.user) pass("QA users + rows fully cleaned (residue=0)");
  else fail(`cleanup residue: rows=${residue} users=${Boolean(goneA?.user)}/${Boolean(goneB?.user)}`);
  // Sweep stale plan-qa probes from prior runs (exact naming pattern only;
  // Converge QA and all other users are never touched).
  {
    let swept = 0;
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (u.email && u.email.startsWith("plan-qa-") && u.email.endsWith("@example.invalid")) {
          const del = await admin.auth.admin.deleteUser(u.id);
          if (!del.error) swept += 1;
        }
      }
      if (data.users.length < 200) break;
      page += 1;
      if (page > 50) break;
    }
    pass(`stale plan-qa probe sweep done (removed=${swept})`);
  }
}

console.log("");
console.log(`PLAN live acceptance: pass=${passed} fail=${failed}`);
if (failures.length > 0) {
  console.log("failures:");
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
