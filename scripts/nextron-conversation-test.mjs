import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const migration = read("supabase/migrations/00028_nextron_conversations.sql");
const conversationLib = read("src/lib/nextron/conversation.ts");
const askRoute = read("src/app/api/nextron/ask/route.ts");
const conversationsRoute = read("src/app/api/nextron/conversations/route.ts");
const conversationRoute = read("src/app/api/nextron/conversations/[id]/route.ts");
const coachPage = read("src/app/coach/page.tsx");

assert(migration.includes("create table if not exists public.nextron_conversations"), "Conversation migration must create nextron_conversations.");
assert(migration.includes("create table if not exists public.nextron_messages"), "Conversation migration must create nextron_messages.");
assert(migration.includes("alter table public.nextron_conversations enable row level security"), "Conversations must enable RLS.");
assert(migration.includes("alter table public.nextron_messages enable row level security"), "Messages must enable RLS.");
assert((migration.match(/auth\.uid\(\) = user_id/g) ?? []).length >= 8, "Conversation policies must be owner-scoped.");
assert(migration.includes("c.deleted_at is null"), "Message access must be denied for deleted conversations.");
assert(migration.includes("where client_message_id is not null"), "Client message idempotency must be indexed only when present.");
assert(migration.includes("revoke all privileges on table public.nextron_conversations from anon"), "Conversations must not grant anon access.");
assert(migration.includes("revoke all privileges on table public.nextron_messages from anon"), "Messages must not grant anon access.");
assert(migration.includes("No hidden prompts, raw evidence, tokens, or chain-of-thought"), "Migration must document forbidden stored data.");

assert(conversationLib.includes("NEXTRON_CONVERSATION_TURN_LIMIT = 10"), "Conversation context must cap turn count.");
assert(conversationLib.includes("NEXTRON_CONVERSATION_CONTEXT_MAX_CHARS = 2_400"), "Conversation context must cap characters.");
assert(conversationLib.includes("buildConversationTitle") && !conversationLib.includes("createConfiguredNextronProvider"), "Conversation titles must be deterministic and not model-generated.");
assert(conversationLib.includes("safeResponseMetadata") && conversationLib.includes("sources:") && !conversationLib.includes("oauth") && !conversationLib.includes("access_token"), "Persisted metadata must be narrow and token-free.");
assert(conversationLib.includes("resolvePromptWithConversation") && conversationLib.includes("re-check current Calendar evidence") && conversationLib.includes("current permitted Knowledge evidence"), "Follow-ups must remain grounded in current permitted evidence.");
assert(!conversationLib.includes("chain_of_thought") && !conversationLib.includes("rawEvidence") && !conversationLib.includes("google_drive_file_id"), "Conversation storage helpers must not persist forbidden internals.");

assert(askRoute.includes("conversationId?: unknown") && askRoute.includes("clientMessageId?: unknown"), "Ask route must accept optional conversation fields.");
assert(askRoute.includes("ensureConversation") && askRoute.includes("loadConversationMessages") && askRoute.includes("persistConversationTurn"), "Ask route must load and persist conversation turns.");
assert(askRoute.includes("buildNextronEvidencePacket(supabase, userId, permissions)"), "Ask route must re-read current permitted evidence per ask.");
assert(/retrieveRelevantPreferenceMemories\(supabase, (userId|user\.id), parsedRequest\)/.test(askRoute), "Memory retrieval must use the resolved request without making conversation Memory.");
assert(askRoute.includes("body.conversationId !== undefined") && askRoute.includes("status: 404"), "Malformed or unavailable conversation ids must not create a new thread.");
assert(askRoute.includes("conversation: activeConversation, messages"), "Ask route must return updated conversation and messages.");
assert(!askRoute.includes("files.list") && !askRoute.includes("callGoogleDriveRest"), "Conversation ask route must not add Drive-wide access.");

assert(conversationsRoute.includes(".eq(\"user_id\", user.id)") && conversationsRoute.includes(".is(\"deleted_at\", null)") && conversationsRoute.includes(".limit(30)"), "Conversation list route must be owner-scoped, active-only, and bounded.");
assert(conversationRoute.includes(".eq(\"id\", id)") && conversationRoute.includes(".eq(\"user_id\", user.id)") && conversationRoute.includes(".limit(120)"), "Conversation detail route must be owner-scoped and bounded.");
assert(conversationRoute.includes("update({ deleted_at:") && conversationRoute.includes("from(\"nextron_messages\").delete()"), "Conversation delete must soft-delete the thread and remove its messages.");

assert(coachPage.includes("Conversations are saved privately to your Life Pulse account") && coachPage.includes("Memory still requires explicit remember commands"), "UI must explain private conversation persistence and Memory boundary.");
assert(coachPage.includes("New conversation") && coachPage.includes("Retry history") && coachPage.includes("ConversationTurn"), "UI must expose thread creation, retry, and message timeline rendering.");
assert(coachPage.includes("conversationId: currentConversation?.id ?? null") && coachPage.includes("clientMessageId: crypto.randomUUID()"), "Client ask calls must include current thread and idempotency token.");
assert(coachPage.includes("Successful turns are saved to this private conversation, not to Memory"), "Composer copy must distinguish conversation history from Memory.");

console.log("NEXTRON Conversation v1 contract checks passed.");
