#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read(resolve(root, "package.json")));
const migration = read(resolve(root, "supabase/migrations/00033_nextron_cross_domain_actions.sql"));
const actions = read(resolve(root, "src/lib/nextron/actions.ts"));
const context = read(resolve(root, "src/lib/nextron/context.ts"));
const actionPermissionsRoute = read(resolve(root, "src/app/api/nextron/action-permissions/route.ts"));
const approveRoute = read(resolve(root, "src/app/api/nextron/actions/[id]/approve/route.ts"));
const proposeRoute = read(resolve(root, "src/app/api/nextron/actions/propose/route.ts"));
const onboardingRoute = read(resolve(root, "src/app/api/nextron/onboarding/route.ts"));
const onboardingPage = read(resolve(root, "src/app/onboarding/page.tsx"));
const coachPage = read(resolve(root, "src/app/coach/page.tsx"));

function assert(condition, label) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exit(1);
  }
  console.log(`PASS ${label}`);
}

assert(pkg.scripts["test:nextron-action-plans"] === "node scripts/nextron-action-plans-test.mjs", "Action plan test script is registered");

for (const actionType of ["task.create", "task.update", "goal.create", "goal.update", "habit.create", "habit.update", "project.create", "project.update", "action_plan.execute"]) {
  assert(actions.includes(`life_pulse.${actionType}`) && migration.includes(`life_pulse.${actionType}`), `Allowed action type is enumerated: ${actionType}`);
}

assert(!actions.includes("parameters.table") && !actions.includes("rpcName") && !actions.includes("rawSql"), "Action contract does not expose arbitrary table/RPC/SQL controls");
assert(actions.includes("rejectExtra") && actions.includes("Action parameters contained unsupported fields"), "Forbidden fields are rejected server-side");
assert(!actions.includes("user_id") && !actions.includes("owner_id"), "Model-proposed owner identifiers are not accepted by action validation");
assert(actions.includes("Calendar changes are not enabled") && actions.includes("Destructive delete actions are not enabled"), "Calendar writes and destructive deletes fail safely");

for (const column of ["allow_goal_actions", "allow_habit_actions", "allow_project_actions"]) {
  assert(migration.includes(`${column} boolean not null default false`) && context.includes(column), `${column} defaults false and is normalized`);
}
assert(context.includes("goalActions: \"denied\"") && context.includes("habitActions: \"denied\"") && context.includes("projectActions: \"denied\""), "New write permissions default denied in app state");
assert(actionPermissionsRoute.includes("WRITE_DOMAINS") && actionPermissionsRoute.includes("taskActions") && actionPermissionsRoute.includes("goalActions") && actionPermissionsRoute.includes("habitActions") && actionPermissionsRoute.includes("projectActions"), "Permission endpoint only changes explicit write domains");
assert(actionPermissionsRoute.includes("supabase.auth.getUser()") && !actionPermissionsRoute.includes("service_role"), "Permission endpoint is authenticated and does not use service role");

assert(migration.includes("partially_failed") && migration.includes("stale") && migration.includes("failed"), "Plan lifecycle includes partial failure, stale, and failed terminal states");
assert(/where id = p_proposal_id and user_id = v_user_id and status = 'pending'\s+for update/.test(migration), "Execution locks only pending owner-scoped proposals");
assert(migration.includes("return v_row;") && migration.includes("select * into v_row from public.nextron_action_proposals where id = p_proposal_id and user_id = v_user_id"), "Replay of terminal proposals returns durable state instead of re-executing");
assert(migration.includes("create unique index if not exists idx_nextron_action_proposals_user_idempotency"), "Durable idempotency key protects duplicate proposal creation");
assert(migration.includes("lower(title) = lower(v_title)") && migration.includes("'mutation', 'existing'"), "Create execution deduplicates obvious existing entities by title");

assert(migration.includes("nextron_action_permission_allowed") && migration.includes("allow_goal_actions is true") && migration.includes("allow_habit_actions is true") && migration.includes("allow_project_actions is true"), "Permissions are rechecked at execution time");
assert(migration.includes("v_actions := case when v_row.action_type = 'life_pulse.action_plan.execute'") && migration.includes("public.nextron_execute_single_domain_action(v_user_id") && migration.includes("return jsonb_build_object('ok', false, 'reason', 'PERMISSION_DENIED')"), "Direct action-plan approval cannot execute domain writes without server-side permissions");
assert(migration.includes("and user_id = p_user_id") && migration.includes("title = p_payload ->> 'beforeTitle'"), "Updates enforce owner and expected-state stale checks");
assert(migration.includes("alter column realm_id drop not null") && migration.includes("realm_id is null or public.realm_belongs_to_user(realm_id)"), "Habit actions can work for Prompt 2 users without weakening realm ownership checks");

assert(proposeRoute.includes("supabase.auth.getUser()") && proposeRoute.includes("validId(body.conversationId)") && !proposeRoute.includes("GET("), "Proposal API requires auth and does not mutate through GET");
assert(approveRoute.includes("export async function POST") && approveRoute.includes("approveActionProposal") && !approveRoute.includes("request.json"), "Approval API uses explicit POST and cannot mutate payload/action type");
assert(actions.includes("supabase.rpc(\"nextron_execute_action\"") && migration.includes("nextron_execute_task_action"), "Generic executor is used while Task RPC compatibility remains");

assert(actions.includes("setupDraftToActions") && actions.includes("normalizeLifeSetupDraft") && actions.includes("createOnboardingSetupActionPlan"), "Onboarding draft converts deterministically from saved validated draft");
assert(onboardingRoute.includes("build_plan") && onboardingRoute.includes("createOnboardingSetupActionPlan"), "Onboarding exposes explicit build-plan transition");
assert(onboardingPage.includes("Build my Life Pulse") && onboardingPage.includes("Allow NEXTRON to create these items?") && onboardingPage.includes("Allow setup changes") && onboardingPage.includes("Approve"), "Onboarding UX separates plan preview, permission review, and approval");
assert(onboardingPage.includes("setupPermissionsGranted") && onboardingPage.includes("Grant permissions first") && onboardingPage.includes("!setupPermissionsGranted"), "Onboarding setup approval is unavailable until explicit write permissions are granted");
assert(onboardingPage.includes("Enter Life Pulse") && onboardingPage.includes('router.push("/today")'), "Completed setup has an explicit path into Today through canonical completion transition");
assert(!actions.includes("createConfiguredNextronProvider") && !actions.includes("runNextronProvider"), "Action preview/execution code makes no model call");
assert(!onboardingPage.includes("setInterval") && !coachPage.includes("setInterval"), "No polling added to action UX");

assert(coachPage.includes("goal|habit|project|calendar|delete") && coachPage.includes("Goals, Habits, Projects, and Tasks"), "Normal NEXTRON direct action UX supports cross-domain proposals");
assert(coachPage.includes("partially_failed") && coachPage.includes("This changed since NEXTRON prepared the preview"), "Preview UX handles partial failure and stale outcomes truthfully");
assert(!migration.includes("google_calendar") && !actions.includes("calendar.create") && !actions.includes("event.create"), "Calendar remains read-only; no Calendar mutation action exists");
assert(!migration.includes("delete from public.goals") && !migration.includes("delete from public.habits") && !migration.includes("delete from public.projects") && !migration.includes("delete from public.tasks"), "No destructive domain delete executor exists");

console.log("NEXTRON Cross-Domain Action Plan v1 contract checks passed.");
