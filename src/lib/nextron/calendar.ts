import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextronCoachResponse, NextronUserRequest } from "@/lib/nextron/coach";
import { isNextronContextAllowed, type NextronPermissionState } from "@/lib/nextron/context";

export const GOOGLE_CALENDAR_MCP_ENDPOINT = "https://calendarmcp.googleapis.com/mcp/v1";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
  "https://www.googleapis.com/auth/calendar.events.readonly",
] as const;

export const GOOGLE_CALENDAR_ALLOWED_TOOLS = ["list_calendars", "list_events", "get_event", "search_events"] as const;
export const GOOGLE_CALENDAR_DENIED_TOOLS = ["create_event", "update_event", "delete_event", "respond_to_event"] as const;

const CALENDAR_MAX_EVENTS = 12;
const CALENDAR_MAX_TOTAL_TEXT = 1_500;
const CALENDAR_MCP_TIMEOUT_MS = 15_000;

type CalendarToolName = typeof GOOGLE_CALENDAR_ALLOWED_TOOLS[number];

export interface CalendarConnectionRow {
  user_id: string;
  encrypted_tokens: string;
  token_iv: string;
  token_tag: string;
  scopes: string[] | null;
  token_expires_at: string | null;
  google_account_hint: string | null;
  status: "connected" | "error" | "revoked";
  last_error_code: string | null;
}

interface CalendarTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  token_type?: string;
}

export interface SanitizedCalendarEvent {
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  timezone: string | null;
  calendar: string | null;
  location: string | null;
}

export type CalendarReadResult =
  | { ok: true; events: SanitizedCalendarEvent[]; rangeLabel: string; toolsUsed: CalendarToolName[] }
  | { ok: false; reason: "PERMISSION_DENIED" | "DISCONNECTED" | "ENV_MISSING" | "TOKEN_UNAVAILABLE" | "MCP_UNAVAILABLE" | "TIMEOUT" | "WRITE_DENIED"; toolsUsed: CalendarToolName[] };

export function getGoogleCalendarEnv() {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() || "",
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() || "",
    mcpUrl: process.env.GOOGLE_CALENDAR_MCP_URL?.trim() || "",
    encryptionKey: process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY?.trim() || "",
  };
}

export function missingGoogleCalendarEnv(): string[] {
  const env = getGoogleCalendarEnv();
  const missing: string[] = [];
  if (!env.clientId) missing.push("GOOGLE_CALENDAR_CLIENT_ID");
  if (!env.clientSecret) missing.push("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!env.redirectUri) missing.push("GOOGLE_CALENDAR_REDIRECT_URI");
  if (!env.mcpUrl) missing.push("GOOGLE_CALENDAR_MCP_URL");
  if (!env.encryptionKey) missing.push("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY");
  return missing;
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function createOAuthState(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = getGoogleCalendarEnv().encryptionKey;
  if (secret.length < 32) throw new Error("CALENDAR_ENCRYPTION_KEY_MISSING");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCalendarTokens(tokens: CalendarTokenSet): Promise<{ encrypted_tokens: string; token_iv: string; token_tag: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(tokens));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoded));
  const body = encrypted.slice(0, -16);
  const tag = encrypted.slice(-16);
  return { encrypted_tokens: Buffer.from(body).toString("base64"), token_iv: Buffer.from(iv).toString("base64"), token_tag: Buffer.from(tag).toString("base64") };
}

export async function decryptCalendarTokens(row: Pick<CalendarConnectionRow, "encrypted_tokens" | "token_iv" | "token_tag">): Promise<CalendarTokenSet> {
  const body = Buffer.from(row.encrypted_tokens, "base64");
  const tag = Buffer.from(row.token_tag, "base64");
  const iv = Buffer.from(row.token_iv, "base64");
  const encrypted = Buffer.concat([body, tag]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await encryptionKey(), encrypted);
  return JSON.parse(new TextDecoder().decode(decrypted)) as CalendarTokenSet;
}

export function buildGoogleCalendarAuthUrl(state: string): string {
  const env = getGoogleCalendarEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  return url.toString();
}

export async function exchangeGoogleCalendarCode(code: string): Promise<CalendarTokenSet> {
  const env = getGoogleCalendarEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.clientId, client_secret: env.clientSecret, redirect_uri: env.redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!token.access_token) throw new Error("GOOGLE_TOKEN_MISSING");
  return { access_token: token.access_token, refresh_token: token.refresh_token, expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined, scope: token.scope, token_type: token.token_type };
}

async function refreshGoogleCalendarToken(refreshToken: string): Promise<CalendarTokenSet> {
  const env = getGoogleCalendarEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.clientId, client_secret: env.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("GOOGLE_TOKEN_REFRESH_FAILED");
  const token = await response.json() as { access_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!token.access_token) throw new Error("GOOGLE_TOKEN_MISSING");
  return { access_token: token.access_token, refresh_token: refreshToken, expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined, scope: token.scope, token_type: token.token_type };
}

export async function revokeGoogleCalendarToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

export function isAllowedCalendarTool(toolName: string): toolName is CalendarToolName {
  return (GOOGLE_CALENDAR_ALLOWED_TOOLS as readonly string[]).includes(toolName) && !(GOOGLE_CALENDAR_DENIED_TOOLS as readonly string[]).includes(toolName);
}

function safeText(value: unknown, max = 90): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<!--[^>]*-->/g, " ").replace(/[{}<>]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\S+@\S+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function sanitizeEvent(input: unknown): SanitizedCalendarEvent | null {
  // Calendar event content is untrusted external data; keep only bounded user-facing fields.
  const event = input as Record<string, unknown>;
  const start = event.start as Record<string, unknown> | undefined;
  const end = event.end as Record<string, unknown> | undefined;
  const startsAt = typeof start?.dateTime === "string" ? start.dateTime : typeof start?.date === "string" ? start.date : typeof event.startTime === "string" ? event.startTime : null;
  if (!startsAt) return null;
  const endsAt = typeof end?.dateTime === "string" ? end.dateTime : typeof end?.date === "string" ? end.date : typeof event.endTime === "string" ? event.endTime : null;
  return {
    title: safeText(event.summary ?? event.title, 90) ?? "Busy",
    startsAt,
    endsAt,
    allDay: Boolean(start?.date || event.allDay),
    timezone: safeText(start?.timeZone ?? event.timeZone, 60),
    calendar: safeText(event.calendarSummary ?? event.calendar, 60),
    location: safeText(event.location, 80),
  };
}

export function sanitizeCalendarEvents(payload: unknown): SanitizedCalendarEvent[] {
  const record = payload as Record<string, unknown>;
  const structured = record.structuredContent as Record<string, unknown> | undefined;
  const candidate = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.events)
      ? record.events
      : Array.isArray(structured?.events)
        ? structured.events
        : Array.isArray(payload)
          ? payload
          : [];
  const events = candidate.map(sanitizeEvent).filter((event): event is SanitizedCalendarEvent => Boolean(event)).slice(0, CALENDAR_MAX_EVENTS);
  let total = 0;
  return events.filter((event) => {
    total += JSON.stringify(event).length;
    return total <= CALENDAR_MAX_TOTAL_TEXT;
  });
}

function calendarRangeForRequest(request: NextronUserRequest, now = new Date()): { timeMin: string; timeMax: string; rangeLabel: string } {
  const start = new Date(now);
  const prompt = request.normalizedPrompt;
  if (prompt.includes("tomorrow")) start.setDate(start.getDate() + 1);
  if (prompt.includes("afternoon")) start.setHours(12, 0, 0, 0);
  else start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (prompt.includes("afternoon")) end.setHours(18, 0, 0, 0);
  else if (prompt.includes("this week") || prompt.includes("week")) end.setDate(end.getDate() + 7);
  else end.setHours(23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString(), rangeLabel: prompt.includes("tomorrow") ? "tomorrow" : prompt.includes("week") ? "this week" : "the requested window" };
}

async function callCalendarMcp(tool: CalendarToolName, accessToken: string, args: Record<string, unknown>): Promise<unknown> {
  if (!isAllowedCalendarTool(tool)) throw new Error("CALENDAR_TOOL_DENIED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALENDAR_MCP_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(getGoogleCalendarEnv().mcpUrl || GOOGLE_CALENDAR_MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "Authorization": `Bearer ${accessToken}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name: tool, arguments: args } }),
    signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(response.status === 401 ? "TOKEN_UNAVAILABLE" : "MCP_UNAVAILABLE");
  const payload = await response.json() as { result?: { isError?: boolean } | unknown; error?: unknown };
  if (payload.error || (typeof payload.result === "object" && payload.result !== null && "isError" in payload.result && payload.result.isError)) throw new Error("MCP_UNAVAILABLE");
  return payload.result;
}

async function getUsableTokens(supabase: SupabaseClient, row: CalendarConnectionRow): Promise<CalendarTokenSet> {
  const tokens = await decryptCalendarTokens(row);
  const expiresAt = tokens.expires_at ? Date.parse(tokens.expires_at) : 0;
  if (!expiresAt || expiresAt - Date.now() > 60_000) return tokens;
  if (!tokens.refresh_token) throw new Error("TOKEN_UNAVAILABLE");
  const refreshed = await refreshGoogleCalendarToken(tokens.refresh_token);
  const encrypted = await encryptCalendarTokens(refreshed);
  await supabase.from("google_calendar_connections").update({ ...encrypted, token_expires_at: refreshed.expires_at ?? null, status: "connected", last_error_code: null }).eq("user_id", row.user_id);
  return refreshed;
}

export async function runNextronCalendarReadOnly(args: { supabase: SupabaseClient; userId: string; permissions: NextronPermissionState; request: NextronUserRequest }): Promise<CalendarReadResult> {
  const toolsUsed: CalendarToolName[] = [];
  if (/(^|\b)(create|schedule|add|update|delete|cancel|respond|invite)\b/.test(args.request.normalizedPrompt)) return { ok: false, reason: "WRITE_DENIED", toolsUsed };
  if (!isNextronContextAllowed(args.permissions, "calendar")) return { ok: false, reason: "PERMISSION_DENIED", toolsUsed };
  if (missingGoogleCalendarEnv().length > 0) return { ok: false, reason: "ENV_MISSING", toolsUsed };

  const { data, error } = await args.supabase
    .from("google_calendar_connections")
    .select("user_id, encrypted_tokens, token_iv, token_tag, scopes, token_expires_at, google_account_hint, status, last_error_code")
    .eq("user_id", args.userId)
    .maybeSingle();
  if (error) return { ok: false, reason: "MCP_UNAVAILABLE", toolsUsed };
  const row = data as CalendarConnectionRow | null;
  if (!row || row.status !== "connected") return { ok: false, reason: "DISCONNECTED", toolsUsed };

  try {
    const tokens = await getUsableTokens(args.supabase, row);
    if (!tokens.access_token) return { ok: false, reason: "TOKEN_UNAVAILABLE", toolsUsed };
    const range = calendarRangeForRequest(args.request);
    toolsUsed.push("list_events");
    const result = await callCalendarMcp("list_events", tokens.access_token, { startTime: range.timeMin, endTime: range.timeMax, pageSize: CALENDAR_MAX_EVENTS, orderBy: "startTime" });
    return { ok: true, events: sanitizeCalendarEvents(result), rangeLabel: range.rangeLabel, toolsUsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP_UNAVAILABLE";
    const name = error instanceof Error ? error.name : "";
    if (message === "TOKEN_UNAVAILABLE") return { ok: false, reason: "TOKEN_UNAVAILABLE", toolsUsed };
    if (message === "CALENDAR_TOOL_DENIED") return { ok: false, reason: "WRITE_DENIED", toolsUsed };
    if (message === "AbortError" || name === "AbortError") return { ok: false, reason: "TIMEOUT", toolsUsed };
    return { ok: false, reason: "MCP_UNAVAILABLE", toolsUsed };
  }
}

export function calendarReadResponse(result: CalendarReadResult): NextronCoachResponse {
  if (!result.ok) {
    const text = result.reason === "WRITE_DENIED"
      ? "Google Calendar v1 is read-only. I cannot create, update, delete, invite, respond, or schedule events."
      : result.reason === "PERMISSION_DENIED"
        ? "NEXTRON Calendar read permission is disabled."
        : result.reason === "DISCONNECTED"
          ? "Google Calendar is not connected."
          : "Google Calendar read context is unavailable right now.";
    return { facts: [{ category: "calendar", text }], interpretation: text, nextAction: { label: "Open Settings", href: "/settings", rationale: "Use Settings to connect Calendar or change NEXTRON Calendar read permission." }, priority: "calm", ruleId: `calendar_${result.reason.toLowerCase()}`, supportingEvidence: [text], source: "deterministic" };
  }
  const facts = result.events.length > 0
    ? result.events.slice(0, 4).map((event) => ({ category: "calendar" as const, text: `${event.allDay ? "All day" : event.startsAt}: ${event.title}` }))
    : [{ category: "calendar" as const, text: `No Calendar events were found for ${result.rangeLabel}.` }];
  return { facts, interpretation: result.events.length > 0 ? `I found ${result.events.length} bounded Calendar item${result.events.length === 1 ? "" : "s"} for ${result.rangeLabel}.` : `Your Calendar appears open for ${result.rangeLabel} in the bounded read window.`, nextAction: { label: "Open Calendar", href: "/settings", rationale: "Calendar is read-only in Life Pulse v1; use Google Calendar directly to make changes." }, priority: "medium", ruleId: "calendar_read_only", supportingEvidence: facts.map((fact) => fact.text), sources: ["Google Calendar"], source: "deterministic" };
}
