import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const calendar = read("src/lib/nextron/calendar.ts");
const context = read("src/lib/nextron/context.ts");
const coach = read("src/lib/nextron/coach.ts");
const coachPage = read("src/app/coach/page.tsx");
const askRoute = read("src/app/api/nextron/ask/route.ts");
const settings = read("src/app/settings/page.tsx");
const connectorRoute = read("src/app/api/integrations/google/calendar/route.ts");
const connectRoute = read("src/app/api/integrations/google/calendar/connect/route.ts");
const callbackRoute = read("src/app/api/integrations/google/calendar/callback/route.ts");
const migration = read("supabase/migrations/00026_google_calendar_readonly_connector.sql");

function assert(condition, label) {
  if (!condition) throw new Error(label);
  console.log(`PASS ${label}`);
}

assert(calendar.includes('GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"') && calendar.includes('path: "/users/me/calendarList"') && calendar.includes('path: "/calendars/primary/events"') && calendar.includes('path: "/freeBusy"'), "A official Google Calendar REST read endpoints are pinned");
assert(calendar.includes('calendar.calendarlist.readonly') && calendar.includes('calendar.events.freebusy') && calendar.includes('calendar.events.readonly') && !calendar.includes('https://www.googleapis.com/auth/calendar"'), "B only configured read scopes are requested");
assert(calendar.includes('GOOGLE_CALENDAR_READ_OPERATIONS') && calendar.includes('"calendar_list"') && calendar.includes('"events_list"') && calendar.includes('"freebusy_query"'), "C REST read operations are explicitly allowlisted");
assert(calendar.includes('GOOGLE_CALENDAR_DENIED_OPERATIONS') && calendar.includes('"events_insert"') && calendar.includes('"events_update"') && calendar.includes('"events_patch"') && calendar.includes('"events_delete"'), "D Calendar write operations are explicitly denied");
assert(calendar.includes('isAllowedCalendarReadOperation') && calendar.includes('throw new Error("CALENDAR_OPERATION_DENIED")'), "E unknown or denied operations fail structurally before REST call");
assert(calendar.includes('AES-GCM') && calendar.includes('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY') && migration.includes('encrypted_tokens text not null'), "F OAuth tokens are encrypted before persistence");
assert(!/console\.log|console\.error|console\.warn/.test(calendar + connectorRoute + connectRoute + callbackRoute), "G Calendar routes do not log tokens or OAuth payloads");
assert(migration.includes('allow_calendar boolean not null default false') && context.includes('calendar: "denied"'), "H NEXTRON Calendar permission defaults denied");
assert(migration.includes('enable row level security') && migration.includes('auth.uid() = user_id') && migration.includes('revoke all privileges on table public.google_calendar_connections from anon'), "I connector storage is owner-scoped with no anon access");
assert(connectRoute.includes('lp_google_calendar_oauth_state') && callbackRoute.includes('cookieState !== state') && callbackRoute.includes('.eq("user_id", user.id)'), "J OAuth state validates CSRF and callback user binding");
assert(callbackRoute.includes('scope_error') && callbackRoute.includes('GOOGLE_CALENDAR_SCOPES'), "K callback rejects missing or broadened scope results");
assert(connectorRoute.includes('revokeGoogleCalendarToken') && connectorRoute.includes('.delete().eq("user_id", auth.userId)'), "L disconnect attempts revocation and deletes owner row");
assert(calendar.includes('sanitizeCalendarEvents') && calendar.includes('replace(/\\S+@\\S+/g') && !calendar.includes('etag'), "M Calendar events are converted to sanitized DTOs without raw internals");
assert(calendar.includes('CALENDAR_MAX_EVENTS = 12') && calendar.includes('CALENDAR_MAX_TOTAL_TEXT') && calendar.includes('CALENDAR_REST_TIMEOUT_MS') && calendar.includes('maxResults: String(CALENDAR_MAX_EVENTS)'), "N Calendar reads are bounded by calls, count, bytes, and timeout");
const routeBody = askRoute.slice(askRoute.indexOf('const fallback = () =>'));
assert(coach.includes('| "CALENDAR_QUERY"') && routeBody.includes('parsed.request.intent === "CALENDAR_QUERY"') && routeBody.indexOf('parsed.request.intent === "CALENDAR_QUERY"') < routeBody.indexOf('isNextronProviderEligibleRequest'), "O Calendar intent routes before generic provider path");
assert(calendar.includes('WRITE_DENIED') && calendar.includes('Google Calendar v1 is read-only') && !/events\.(insert|update|patch|delete)|create_event|update_event|delete_event|respond_to_event/.test(calendar), "P write prompts cannot execute Calendar writes or claim success");
assert(calendar.includes('Calendar event content is untrusted external data') && calendar.includes('safeText'), "Q event text is treated as sanitized data only");
assert(settings.includes('Google Calendar') && settings.includes('Allow NEXTRON to read Calendar') && settings.includes('Calendar v1 is read-only'), "R Settings exposes minimal read-only connector UX");
assert(askRoute.includes('allow_calendar') && connectorRoute.includes('allow_calendar'), "S API routes persist Calendar permission column");
assert(coachPage.includes('allow_knowledge, allow_calendar, allow_journal') && coachPage.includes('.select(PREFERENCE_COLUMNS)'), "T Coach permission UI loads and returns Calendar with existing permission DTO");
assert(context.includes('if (!isBoolean(value))') && context.includes('normalized[permission.domain] = permission.level') && context.includes('calendar: "denied"'), "U absent or unloaded Calendar permission remains denied");
assert(context.includes('allow_calendar: permissions.calendar === "allowed"') && connectorRoute.includes('calendar: body.allowNextronCalendar ? "allowed" : "denied"'), "V PATCH false-to-true and true-to-false writes explicit Calendar permission only");
assert(connectorRoute.includes('const next = { ...permissions, calendar:') && context.includes('allow_knowledge: permissions.knowledge === "allowed"') && context.includes('allow_journal: permissions.journal === "allowed"'), "W Calendar toggles preserve unrelated permissions including Knowledge and Journal");
assert(calendar.includes('if (!isNextronContextAllowed(args.permissions, "calendar")) return { ok: false, reason: "PERMISSION_DENIED"') && calendar.includes('if (!row || row.status !== "connected") return { ok: false, reason: "DISCONNECTED"'), "X connected false or permission false cannot read Calendar");
assert(askRoute.includes('const { permissions } = normalizeNextronPreferences') && askRoute.includes('runNextronCalendarReadOnly({ supabase, userId: user.id, permissions'), "Y prompt cannot override saved Calendar permission resolver");
assert(calendar.includes('timeMin: range.timeMin') && calendar.includes('timeMax: range.timeMax') && calendar.includes('singleEvents: "true"') && calendar.includes('orderBy: "startTime"'), "Z Calendar REST request uses official events.list argument names");
assert(calendar.includes('items: [{ id: "primary" }]') && calendar.includes('minAccessRole: "reader"'), "Z2 Calendar REST performs CalendarList and FreeBusy read probes only");
assert(calendar.includes('CALENDAR_REST_TIMEOUT_MS = 15_000') && calendar.includes('name === "AbortError"'), "Z3 Calendar REST timeout remains bounded and classifies aborts safely");
assert(calendar.includes('TOKEN_DECRYPT_FAILED') && calendar.includes('TOKEN_REFRESH_FAILED') && calendar.includes('CALENDAR_AUTH_REQUIRED') && calendar.includes('CALENDAR_SCOPE_DENIED') && calendar.includes('CALENDAR_BAD_REQUEST') && calendar.includes('CALENDAR_RATE_LIMITED') && calendar.includes('CALENDAR_API_UNAVAILABLE'), "Z4 Calendar live failures use safe REST diagnostic classifications");
assert(!calendar.includes('calendarmcp.googleapis.com') && !calendar.includes('tools/call') && !calendar.includes('GOOGLE_CALENDAR_MCP_URL') && !calendar.includes('MCP_'), "Z5 Calendar production read path has no MCP fallback or required MCP env");
