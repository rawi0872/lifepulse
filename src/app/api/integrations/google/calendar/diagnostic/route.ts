import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { decryptCalendarTokens, GOOGLE_CALENDAR_SCOPES, type CalendarConnectionRow } from "@/lib/nextron/calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MCP_ENDPOINT = "https://calendarmcp.googleapis.com/mcp/v1";

function hashPayload(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function itemsFromResult(result: unknown, names: string[]): unknown[] {
  const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
  for (const name of names) {
    if (Array.isArray(record[name])) return record[name] as unknown[];
    const structured = record.structuredContent && typeof record.structuredContent === "object" ? record.structuredContent as Record<string, unknown> : {};
    if (Array.isArray(structured[name])) return structured[name] as unknown[];
  }
  return [];
}

function safeToolError(result: unknown) {
  const raw = JSON.stringify(result ?? null);
  const record = result && typeof result === "object" ? result as { content?: unknown; structuredContent?: unknown; isError?: unknown } : {};
  const content = Array.isArray(record.content) ? record.content : [];
  const text = content.map((item) => typeof (item as { text?: unknown }).text === "string" ? (item as { text: string }).text : "").join(" ").toLowerCase();
  let category = "UNKNOWN_TOOL_ERROR";
  if (/developer preview|preview|not enabled|not been enabled|access not configured|api has not been used|disabled/.test(text)) category = "DEVELOPER_PREVIEW_REQUIRED";
  else if (/insufficient authentication scopes|insufficient permission|forbidden|permission denied|access denied/.test(text)) category = "SCOPE_DENIED";
  else if (/unauthenticated|invalid credential|invalid authentication|access token/.test(text)) category = "UNAUTHENTICATED";
  else if (/invalid argument|invalid request|bad request|unknown parameter|schema|parse/.test(text)) category = "INVALID_ARGUMENT";
  else if (/failed precondition|precondition/.test(text)) category = "FAILED_PRECONDITION";
  else if (/not found|not_found/.test(text)) category = "NOT_FOUND";
  else if (/quota|resource exhausted|rate limit/.test(text)) category = "RESOURCE_EXHAUSTED";
  else if (/internal|backend error|unavailable/.test(text)) category = "INTERNAL";
  return { category, isError: record.isError === true, fromStructuredContent: Boolean(record.structuredContent), rawHash: hashPayload(raw), rawByteLength: Buffer.byteLength(raw) };
}

async function mcp(method: string, params: Record<string, unknown> | null, accessToken?: string) {
  const start = performance.now();
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params: params ?? {} }),
  });
  const text = await response.text();
  const durationMs = Math.round(performance.now() - start);
  let payload: { result?: unknown; error?: unknown } | null = null;
  try { payload = JSON.parse(text) as { result?: unknown; error?: unknown }; } catch {}
  if (!response.ok) return { ok: false as const, durationMs, outerHttpStatus: response.status, category: `HTTP_${response.status}` };
  if (!payload) return { ok: false as const, durationMs, outerHttpStatus: response.status, category: "MCP_PROTOCOL_ERROR", rawHash: hashPayload(text), rawByteLength: Buffer.byteLength(text) };
  if (payload.error) {
    const raw = JSON.stringify(payload.error);
    return { ok: false as const, durationMs, outerHttpStatus: response.status, category: "MCP_PROTOCOL_ERROR", rawHash: hashPayload(raw), rawByteLength: Buffer.byteLength(raw) };
  }
  const resultRecord = payload.result && typeof payload.result === "object" ? payload.result as { isError?: unknown } : {};
  if (resultRecord.isError) return { ok: false as const, durationMs, outerHttpStatus: response.status, ...safeToolError(payload.result) };
  return { ok: true as const, durationMs, outerHttpStatus: response.status, result: payload.result };
}

async function restControl(accessToken: string) {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("timeMin", new Date().toISOString());
  const start = performance.now();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const durationMs = Math.round(performance.now() - start);
  await response.arrayBuffer();
  if (response.ok) return { result: "REST_CALENDAR_READ_SUCCESS", durationMs };
  if (response.status === 401) return { result: "REST_401", durationMs };
  if (response.status === 403) return { result: "REST_403", durationMs };
  if (response.status === 400) return { result: "REST_400", durationMs };
  return { result: "REST_OTHER", status: response.status, durationMs };
}

function summarizeFailure(tool: string, result: Awaited<ReturnType<typeof mcp>>) {
  return { result: "MCP_TOOL_ERROR", tool, ...Object.fromEntries(Object.entries(result).filter(([key]) => key !== "ok" && key !== "result")) };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to diagnose Calendar." }, { status: 401 });

  const tools = await mcp("tools/list", null);
  const toolsList = tools.ok ? itemsFromResult(tools.result, ["tools"]).map((tool) => tool as { name?: string; inputSchema?: { properties?: Record<string, unknown>; required?: string[] }; annotations?: { readOnlyHint?: boolean } }) : [];
  const schema = Object.fromEntries(["list_calendars", "list_events"].map((name) => {
    const tool = toolsList.find((candidate) => candidate.name === name);
    return [name, tool ? { exists: true, properties: Object.keys(tool.inputSchema?.properties ?? {}), required: tool.inputSchema?.required ?? [], readOnly: tool.annotations?.readOnlyHint === true } : { exists: false }];
  }));

  const { data } = await supabase
    .from("google_calendar_connections")
    .select("user_id, encrypted_tokens, token_iv, token_tag, scopes, token_expires_at, google_account_hint, status, last_error_code")
    .eq("user_id", user.id)
    .maybeSingle();
  const row = data as CalendarConnectionRow | null;
  const connection = {
    exists: Boolean(row),
    connected: row?.status === "connected",
    encryptedCredentialsExist: Boolean(row?.encrypted_tokens && row?.token_iv && row?.token_tag),
    requiredScopesPresent: GOOGLE_CALENDAR_SCOPES.every((scope) => row?.scopes?.includes(scope)),
    plaintextTokenShapeDetected: Boolean(row?.encrypted_tokens?.includes("access_token") || row?.encrypted_tokens?.trim().startsWith("{")),
    hasLastErrorCode: Boolean(row?.last_error_code),
    accessTokenCurrentByExpiry: row?.token_expires_at ? Date.parse(row.token_expires_at) > Date.now() + 60_000 : null,
  };
  if (!row) return NextResponse.json({ schema, connection, tokenStatus: { decrypt: "NOT_ATTEMPTED", refresh: "NOT_ATTEMPTED" } });

  let tokens: { access_token?: string; expires_at?: string };
  try {
    tokens = await decryptCalendarTokens(row);
  } catch {
    return NextResponse.json({ schema, connection, tokenStatus: { decrypt: "TOKEN_DECRYPT_FAILED", refresh: "NOT_ATTEMPTED" } });
  }
  if (!tokens.access_token) return NextResponse.json({ schema, connection, tokenStatus: { decrypt: "SUCCESS", refresh: "TOKEN_UNAVAILABLE" } });
  const expiresAt = tokens.expires_at ? Date.parse(tokens.expires_at) : 0;
  const tokenStatus = { decrypt: "SUCCESS", refresh: !expiresAt || expiresAt > Date.now() + 60_000 ? "NOT_REQUIRED" : "REQUIRED_NOT_PERFORMED" };

  const listCalendars = await mcp("tools/call", { name: "list_calendars", arguments: { pageSize: 1 } }, tokens.access_token);
  const calendars = listCalendars.ok ? itemsFromResult(listCalendars.result, ["calendars", "items"]) : [];
  const listCalendarsSummary = listCalendars.ok
    ? { result: "SUCCESS", tool: "list_calendars", durationMs: listCalendars.durationMs, resultCount: calendars.length > 0 ? ">0" : "0", timezoneFieldExisted: calendars.some((item) => typeof (item as { timeZone?: unknown }).timeZone === "string") }
    : summarizeFailure("list_calendars", listCalendars);

  let minimalListEvents: unknown = { result: "SKIPPED" };
  let explicitCalendarListEvents: unknown = { result: "SKIPPED" };
  let tomorrowRange: unknown = { result: "SKIPPED" };
  let noEventRange: unknown = { result: "SKIPPED" };

  if (listCalendars.ok) {
    const minimal = await mcp("tools/call", { name: "list_events", arguments: { pageSize: 1 } }, tokens.access_token);
    const minimalEvents = minimal.ok ? itemsFromResult(minimal.result, ["events", "items"]) : [];
    minimalListEvents = minimal.ok
      ? { result: "SUCCESS", tool: "list_events", durationMs: minimal.durationMs, resultCount: minimalEvents.length > 0 ? ">0" : "0", timezoneFieldExisted: typeof (minimal.result as { structuredContent?: { timeZone?: unknown }; timeZone?: unknown })?.structuredContent?.timeZone === "string" || typeof (minimal.result as { timeZone?: unknown })?.timeZone === "string" }
      : summarizeFailure("list_events", minimal);

    const calendarId = calendars.find((item) => typeof (item as { id?: unknown }).id === "string") as { id?: string } | undefined;
    if (!minimal.ok && calendarId?.id) {
      const explicit = await mcp("tools/call", { name: "list_events", arguments: { calendarId: calendarId.id, pageSize: 1 } }, tokens.access_token);
      const explicitEvents = explicit.ok ? itemsFromResult(explicit.result, ["events", "items"]) : [];
      explicitCalendarListEvents = explicit.ok
        ? { result: "SUCCESS", tool: "list_events", durationMs: explicit.durationMs, resultCount: explicitEvents.length > 0 ? ">0" : "0" }
        : summarizeFailure("list_events", explicit);
    }

    if (minimal.ok) {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(23, 59, 59, 999);
      const tomorrow = await mcp("tools/call", { name: "list_events", arguments: { startTime: startTime.toISOString(), endTime: endTime.toISOString(), pageSize: 12, orderBy: "startTime" } }, tokens.access_token);
      const tomorrowEvents = tomorrow.ok ? itemsFromResult(tomorrow.result, ["events", "items"]) : [];
      const argsShape = { startTime: "valid ISO timestamp", endTime: "valid ISO timestamp", startBeforeEnd: startTime < endTime, pageSize: 12 };
      tomorrowRange = tomorrow.ok
        ? { result: "SUCCESS", tool: "list_events", durationMs: tomorrow.durationMs, resultCount: tomorrowEvents.length > 0 ? ">0" : "0", argsShape }
        : { ...summarizeFailure("list_events", tomorrow), argsShape };

      const noEvent = await mcp("tools/call", { name: "list_events", arguments: { startTime: "2099-01-01T00:00:00.000Z", endTime: "2099-01-01T00:30:00.000Z", pageSize: 1 } }, tokens.access_token);
      const noEvents = noEvent.ok ? itemsFromResult(noEvent.result, ["events", "items"]) : [];
      noEventRange = noEvent.ok
        ? { result: "SUCCESS", tool: "list_events", durationMs: noEvent.durationMs, resultCount: noEvents.length > 0 ? ">0" : "0" }
        : summarizeFailure("list_events", noEvent);
    }
  }

  return NextResponse.json({
    schema,
    connection,
    tokenStatus,
    listCalendars: listCalendarsSummary,
    minimalListEvents,
    explicitCalendarListEvents,
    tomorrowRange,
    noEventRange,
    restControl: await restControl(tokens.access_token),
  });
}
