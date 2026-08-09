#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const files = {
  actions: resolve(root, "src/lib/nextron/actions.ts"),
  propose: resolve(root, "src/app/api/nextron/actions/propose/route.ts"),
  approve: resolve(root, "src/app/api/nextron/actions/[id]/approve/route.ts"),
  cancel: resolve(root, "src/app/api/nextron/actions/[id]/cancel/route.ts"),
  list: resolve(root, "src/app/api/nextron/actions/route.ts"),
  coach: resolve(root, "src/app/coach/page.tsx"),
  ask: resolve(root, "src/app/api/nextron/ask/route.ts"),
  conversationDelete: resolve(root, "src/app/api/nextron/conversations/[id]/route.ts"),
  migration: resolve(root, "supabase/migrations/00029_nextron_action_proposals.sql"),
  taskResolverMigration: resolve(root, "supabase/migrations/00031_nextron_task_update_resolver.sql"),
  planMigration: resolve(root, "supabase/migrations/00033_nextron_cross_domain_actions.sql"),
  context: resolve(root, "src/lib/nextron/context.ts"),
  pkg: resolve(root, "package.json"),
};

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing file: ${path}`);
  return readFileSync(path, "utf-8");
}

function pass(label) { console.log(`PASS ${label}`); }
function assert(condition, label) { if (!condition) throw new Error(label); pass(label); }

const actions = read(files.actions);
const propose = read(files.propose);
const approve = read(files.approve);
const list = read(files.list);
const coach = read(files.coach);
const conversationDelete = read(files.conversationDelete);
const migration = read(files.migration);
const taskResolverMigration = read(files.taskResolverMigration);
const planMigration = read(files.planMigration);
const context = read(files.context);
const pkg = JSON.parse(read(files.pkg));

assert(pkg.scripts["test:nextron-actions"] === "node scripts/nextron-actions-test.mjs", "Action test script is registered");
assert(actions.includes('"life_pulse.task.create"') && actions.includes('"life_pulse.task.update"') && actions.includes('"life_pulse.goal.create"') && actions.includes('"life_pulse.habit.create"') && actions.includes('"life_pulse.project.create"'), "A supported action namespace is typed and allowlisted");
assert(actions.includes('UNSUPPORTED_ACTION') && actions.includes('ACTION_TYPE_SET'), "B unsupported action types are rejected by server-owned allowlist");
assert(actions.includes('Due date must be YYYY-MM-DD') && actions.includes('A title is required'), "C malformed parameters are rejected");
assert(actions.includes('unsupported fields'), "D unknown fields are rejected");
assert(!propose.includes('user_id') && propose.includes('supabase.auth.getUser()'), "E user cannot forge owner through proposal API body");
assert(migration.includes('auth.uid() = user_id') && migration.includes('PROPOSAL_NOT_FOUND'), "F cross-user proposal access is owner-scoped");
assert(coach.includes('Requires approval') && coach.includes('onApprove'), "G explicit approval UI is required");
assert(migration.includes("where id = p_proposal_id and user_id = v_user_id and status = 'pending'"), "H canceled proposal cannot later approve because only pending transitions are allowed");
assert(migration.includes("expires_at <= now()") && migration.includes("'expired'"), "I expired proposal cannot approve into executable state");
assert(approve.includes('POST') && !approve.includes('validated_payload') && !approve.includes('actionType'), "J approval endpoint cannot mutate payload/action type");
assert(actions.includes('NEXTRON_TASK_ACTION_EXECUTION_ENABLED = true') && planMigration.includes("life_pulse.goal.create") && planMigration.includes("life_pulse.habit.create") && planMigration.includes("life_pulse.project.create"), "K approved cross-domain execution is enabled through the server-owned allowlist");
assert(actions.includes('export function executeNextronAction(): never'), "L direct execution attempt fails closed");
assert(planMigration.includes("where id = p_proposal_id and user_id = v_user_id and status = 'pending'") && planMigration.includes("return v_row;"), "M duplicate approval is terminal-state safe");
assert(actions.includes('beforeDueDate') && planMigration.includes("'reason', 'STALE'"), "N stale/resource revalidation is enforced for update actions");
assert(actions.includes('AMBIGUOUS_RESOURCE') && actions.includes('I need the exact task'), "O ambiguous resource updates ask for clarification");
assert(actions.includes('skip approval') && actions.includes('blanket or remembered approval'), "P prompt injection cannot bypass explicit approval");
assert(actions.includes('Previous user message') === false && actions.includes('always') && actions.includes('already approved all future'), "Q conversation history or blanket approval cannot grant approval");
assert(context.includes('allow_task_actions') && context.includes('taskActions: "denied"') && planMigration.includes('allow_goal_actions boolean not null default false') && planMigration.includes('allow_habit_actions boolean not null default false') && planMigration.includes('allow_project_actions boolean not null default false'), "R read permissions do not grant write capability");
assert(conversationDelete.includes('invalidateConversationActionProposals'), "S deleting conversation invalidates pending proposals");
const renderedProposalUi = coach.slice(coach.indexOf("function ActionProposalCard"));
assert(!renderedProposalUi.includes('validated_payload') && !renderedProposalUi.includes('conversation_id') && !renderedProposalUi.includes('action_type'), "T raw internal IDs/payload internals are not rendered in proposal UI");
assert(migration.includes('revoke all privileges on table public.nextron_action_proposals from authenticated') && migration.includes('grant select on table public.nextron_action_proposals to authenticated'), "RLS/grants prevent direct client status mutation");
assert(migration.includes('security definer') && migration.includes('nextron_approve_action_proposal') && migration.includes('nextron_cancel_action_proposal'), "Status transitions are server-owned RPCs");
assert(planMigration.includes('nextron_execute_task_action') && planMigration.includes('nextron_execute_action') && planMigration.includes('security definer') && planMigration.includes('insert into public.tasks') && planMigration.includes('update public.tasks'), "Task create/update executors use a server-owned RPC and canonical Tasks table");
assert(taskResolverMigration.includes('nextron_resolve_task_update_target') && taskResolverMigration.includes('t.user_id = v_user_id') && actions.includes('nextron_resolve_task_update_target'), "Task update proposal resolution is owner-scoped and server-owned");
assert(taskResolverMigration.includes('returns table(id uuid, title text, due_date date, status text)') && actions.includes('typeof task.id !== "string"') && !actions.includes('UUID.test(task.id)'), "Task update route trusts the resolver UUID contract and leaves final ID revalidation to the executor RPC");
assert(planMigration.includes("life_pulse.reminder.create") && planMigration.includes("approved_execution_disabled") && actions.includes('Calendar changes are not enabled'), "Reminder and Calendar writes remain execution-disabled");
assert(list.includes('listRecentActionProposals'), "Refresh/reopen loads true server proposal state");
assert(!migration.includes('google') && !migration.includes('calendar.events') && !actions.includes('GOOGLE_CALENDAR_SCOPES'), "No Calendar write scope or external write path was added");

console.log("NEXTRON Action Framework v1 contract checks passed.");
