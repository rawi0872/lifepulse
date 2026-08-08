import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const contextRoute = read("src/app/api/nextron/context/route.ts");
const coachPage = read("src/app/coach/page.tsx");
const askRoute = read("src/app/api/nextron/ask/route.ts");

assert(contextRoute.includes('if (!user) return NextResponse.json({ error: "Sign in to load NEXTRON context." }, { status: 401 })'), "A context endpoint must require authentication.");
assert(contextRoute.includes('permissions.calendar !== "allowed" ? "permission_denied"') && contextRoute.includes('runNextronCalendarReadOnly({ supabase, userId, permissions'), "B Calendar details must be absent when permission is false.");
assert(contextRoute.includes('calendar.reason === "DISCONNECTED" ? "disconnected"') && contextRoute.includes('events: []'), "C Calendar details must be absent when disconnected.");
assert(contextRoute.includes('.from("tasks").select("project_id").eq("user_id", userId)') && contextRoute.includes('.from("projects").select("id, title, status, updated_at").eq("user_id", userId)'), "D Task/Project panel data must be owner-scoped.");
const responseBody = contextRoute.slice(contextRoute.indexOf("panels: {"));
assert(!responseBody.includes("user_id") && !responseBody.includes("userId"), "E context DTO must not return user IDs.");
assert(!/encrypted_tokens|token_iv|token_tag|access_token|refresh_token|authorization|Bearer/i.test(contextRoute), "F context DTO must not expose OAuth or token values.");
assert(!contextRoute.includes('google_drive_file_id') && !contextRoute.includes('resource_key'), "G context DTO must not expose Drive file IDs or resource keys.");
assert(coachPage.includes('No more events today.') && coachPage.includes('No active projects.') && coachPage.includes('No saved conversations yet.'), "H UI must include compact empty states.");
assert(contextRoute.includes('PROJECT_PANEL_LIMIT = 4') && contextRoute.includes('.limit(PROJECT_PANEL_LIMIT)') && contextRoute.includes('items: projectRows.map'), "I project panel list must be bounded.");
assert(contextRoute.includes('CALENDAR_PANEL_LIMIT = 4') && contextRoute.includes('.slice(0, CALENDAR_PANEL_LIMIT)') && contextRoute.includes('runNextronCalendarReadOnly'), "J Calendar panel list must be bounded by panel and calendar read limits.");
assert(!/createConfiguredNextronProvider|runNextronProvider|Groq|openai|anthropic/i.test(contextRoute), "K panel data must not use model/provider calls.");
assert(askRoute.includes('conversationId') && coachPage.includes('loadConversations') && coachPage.includes('ConversationTurn'), "L conversation behavior must remain wired while live panels are added.");
assert(contextRoute.includes('normalizeNextronPreferences') && contextRoute.includes('buildNextronEvidencePacket(supabase, userId, permissions)') && coachPage.includes('Saved permissions remain the authority'), "M saved permissions must remain authoritative.");
assert(coachPage.includes('window.addEventListener("focus", refreshIfVisible)') && !coachPage.includes('setInterval('), "Refresh strategy must use focus/re-entry, not polling.");
assert(coachPage.includes('View Today') && coachPage.includes('View Tasks') && coachPage.includes('View Projects') && coachPage.includes('Calendar settings'), "Panels must click through to canonical modules.");

console.log("NEXTRON Live Context v1 contract checks passed.");
