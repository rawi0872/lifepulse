import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${message}`);
}

const cleanupMigration = read("supabase/migrations/00035_goal_links_target_delete_cleanup.sql");
const verifier = read("scripts/prompt7-disposable-prod-verifier.mjs");
const pkg = JSON.parse(read("package.json"));

assert(cleanupMigration.includes("cleanup_goal_links_for_project_delete") && cleanupMigration.includes("linked_type = 'project'"), "Project delete cleans project goal_links");
assert(cleanupMigration.includes("cleanup_goal_links_for_task_delete") && cleanupMigration.includes("linked_type = 'task'"), "Task delete cleans task goal_links");
assert(cleanupMigration.includes("cleanup_goal_links_for_habit_delete") && cleanupMigration.includes("linked_type = 'habit'"), "Habit delete cleans habit goal_links");
assert(cleanupMigration.includes("after delete on public.projects") && cleanupMigration.includes("after delete on public.tasks") && cleanupMigration.includes("after delete on public.habits"), "Goal link cleanup is trigger-backed for hard deletes");
assert(verifier.includes("LIFE_PULSE_PROMPT7_PROD_WRITE_ACK") && verifier.includes("SUPABASE_SERVICE_ROLE_KEY") && verifier.includes("createUser") && verifier.includes("deleteUser"), "Disposable verifier is CLI-only, guarded, and owns auth user lifecycle");
assert(verifier.includes("EXPECTED_BASE") && verifier.includes("https://lifepulse-sand.vercel.app") && verifier.includes("Refusing to run against unexpected target"), "Disposable verifier refuses unknown production targets");
assert(verifier.includes("nextron_create_action_proposal") && verifier.includes("nextron_execute_action") && verifier.includes("life_pulse.goal.link") && verifier.includes("life_pulse.goal.unlink"), "Disposable verifier exercises approved action execution and relationships");
assert(verifier.includes("Zero residue for") && !verifier.includes("console.log(SERVICE_ROLE_KEY") && !verifier.includes("console.log(PASSWORD"), "Disposable verifier verifies cleanup without printing secrets");
assert(pkg.scripts["test:prod:prompt7-disposable"] === "node scripts/prompt7-disposable-prod-verifier.mjs", "Disposable production verifier script is registered");

if (process.exitCode) process.exit(1);
console.log("Prompt 7 final gate contract checks passed.");
