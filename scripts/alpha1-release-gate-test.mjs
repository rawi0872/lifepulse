#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const verifier = read("scripts/alpha1-prod-e2e-verifier.mjs");
const pkg = read("package.json");
const guide = read("docs/alpha-1-private-testing.md");
const guideLower = guide.toLowerCase();

assert(pkg.includes('"test:prod:alpha1-e2e"') && pkg.includes("alpha1-prod-e2e-verifier.mjs"), "Alpha 1 production E2E script is registered");
assert(verifier.includes("LIFE_PULSE_ALPHA1_PROD_WRITE_ACK") && verifier.includes("I_UNDERSTAND_THIS_CREATES_AND_DELETES_SYNTHETIC_PRODUCTION_USERS"), "Verifier requires explicit production write acknowledgement");
assert(verifier.includes("SUPABASE_SECRET_KEY") && verifier.includes("SUPABASE_SERVICE_ROLE_KEY") && verifier.includes("env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY"), "Verifier prefers SUPABASE_SECRET_KEY with service-role fallback");
assert(verifier.includes("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY") && verifier.includes("LIFE_PULSE_ALPHA1_EXPECTED_SUPABASE_URL"), "Verifier requires a local server/admin credential and expected Supabase target");
assert(verifier.includes("Refusing unexpected Life Pulse target") && verifier.includes("Refusing unexpected Supabase production project URL"), "Verifier aborts on target mismatch before writes");
assert(verifier.includes("admin.auth.admin.createUser") && verifier.includes("admin.auth.admin.deleteUser"), "Verifier owns disposable auth user lifecycle");
assert(verifier.includes("--cleanup-run-id=") && verifier.includes("cleanupOnly"), "Verifier supports cleanup-only mode scoped by run ID");
assert(verifier.includes("--verify-deleted-user-id=") && verifier.includes("verifyDeletedUserResidue") && verifier.includes("Deleted-user verification requires --verify-deleted-user-id=<uuid>"), "Verifier supports deleted-user zero-residue recovery mode");
assert(verifier.includes("Zero residue for auth user") && verifier.includes("profiles") && verifier.includes("goal_links") && verifier.includes("printCounts(\"cleanup\"") && verifier.includes("assert(value === 0"), "Verifier proves zero residue with table counts");
assert(verifier.includes('select("user_id", { count: "exact", head: true })') && verifier.includes("safeSupabaseError"), "Verifier counts user-owned tables through user_id and prints safe count diagnostics");
assert(verifier.includes("printCounts(\"before cleanup\"") && verifier.includes("table zero-residue cannot be proven without the deleted user_id"), "Verifier reports partial cleanup state instead of falsely passing without a user ID");
assert(verifier.includes("expected profiles=1") && verifier.includes("onboarding_completed expected false") && verifier.includes("intended_use is unset for a truly new user"), "Verifier encodes canonical auto-created fresh profile contract");
assert(!verifier.includes("Fresh synthetic user starts with no profile"), "Verifier does not regress to expecting profile=0 for fresh auth users");
const recoveryStart = verifier.indexOf("async function verifyDeletedUserResidue");
const recoveryEnd = verifier.indexOf("async function login", recoveryStart);
const recoveryBody = verifier.slice(recoveryStart, recoveryEnd);
assert(recoveryStart > 0 && recoveryEnd > recoveryStart && !/createUser|deleteUser|insert\(|upsert\(|update\(|delete\(|nextron_create_action_proposal|nextron_execute_action|nextron_cancel_action_proposal/.test(recoveryBody), "Deleted-user recovery mode is read-only");
assert(!verifier.includes("console.log(SERVICE_ROLE_KEY") && !verifier.includes("console.log(PASSWORD") && !verifier.includes("console.log(SUPABASE_ANON_KEY"), "Verifier does not print secrets");
assert(verifier.includes("nextron_create_action_proposal") && verifier.includes("nextron_execute_action") && verifier.includes("nextron_cancel_action_proposal"), "Verifier uses canonical NEXTRON action proposal, approval, and cancel RPCs");
assert(verifier.includes("life_pulse.goal.create") && verifier.includes("life_pulse.project.create") && verifier.includes("life_pulse.habit.create") && verifier.includes("life_pulse.task.create"), "Verifier covers Goal, Project, Habit, and Task create actions");
assert(verifier.includes("life_pulse.goal.update") && verifier.includes("life_pulse.project.update") && verifier.includes("life_pulse.habit.update") && verifier.includes("life_pulse.task.update"), "Verifier covers Goal, Project, Habit, and Task update actions");
assert(verifier.includes("life_pulse.goal.link") && verifier.includes("life_pulse.goal.unlink"), "Verifier covers relationship link and unlink actions");
assert(verifier.includes("Permission revocation before execution blocks relationship mutation"), "Verifier covers permission revocation before execution");
assert(verifier.includes("Non-Task stale update rejected without overwrite"), "Verifier covers stale non-Task update rejection");
assert(verifier.includes("Project hard delete cleans polymorphic goal_links target rows"), "Verifier covers goal_links orphan cleanup trigger behavior");
assert(verifier.includes("Setup phase: permission review shown") && verifier.includes("Grant permissions first") && verifier.includes("Setup phase: approval enabled after explicit permissions"), "Verifier follows setup permission-review flow before approval");
assert(verifier.includes("POST-SETUP PATH") && verifier.includes("Post-setup destination is Today") && verifier.includes("onboarding_completed=true") && verifier.includes("onboarding status=completed"), "Verifier reports and verifies post-setup Today destination and completion state");
assert(verifier.includes("#nextron-question") && verifier.includes("Talk to NEXTRON") && verifier.includes("More intelligence") && verifier.includes("NEXTRON Alpha 1.1 human-first hierarchy"), "Verifier covers stable Alpha 1.1 NEXTRON human-first landmarks");
assert(verifier.includes("/life-map") && verifier.includes("Life Map render made zero provider-route calls"), "Verifier covers populated Life Map and zero provider-route calls");
assert(verifier.includes("390") && verifier.includes("320") && verifier.includes("1440"), "Verifier includes mobile and desktop first-run coverage");
assert(guideLower.includes("tester size") && guide.includes("3-5 trusted people initially"), "Alpha 1 private testing guide defines tester size");
assert(guide.includes("Confusion is feedback") && guideLower.includes("day 7 questions"), "Alpha 1 guide captures observation rules and follow-up questions");

console.log("Alpha 1 release gate contract checks passed.");
