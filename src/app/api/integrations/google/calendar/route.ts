import { NextResponse } from "next/server";
import { buildNextronPreferenceUpsert, normalizeNextronPreferences, type NextronPreferenceRow, type NextronPermissionState } from "@/lib/nextron/context";
import { decryptCalendarTokens, missingGoogleCalendarEnv, revokeGoogleCalendarToken, type CalendarConnectionRow } from "@/lib/nextron/calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

async function authenticated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

async function currentPermissions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<NextronPermissionState> {
  const { data } = await supabase.from("nextron_context_preferences").select(PREFERENCE_COLUMNS).eq("user_id", userId).maybeSingle();
  return normalizeNextronPreferences(data as NextronPreferenceRow | null).permissions;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Sign in to manage Google Calendar." }, { status: 401 });
  const [permissions, connection] = await Promise.all([
    currentPermissions(auth.supabase, auth.userId),
    auth.supabase.from("google_calendar_connections").select("status, token_expires_at, google_account_hint, last_error_code").eq("user_id", auth.userId).maybeSingle(),
  ]);
  const row = connection.data as Pick<CalendarConnectionRow, "status" | "token_expires_at" | "google_account_hint" | "last_error_code"> | null;
  return NextResponse.json({
    connected: row?.status === "connected",
    status: row?.status ?? "not_connected",
    accountHint: row?.google_account_hint ?? null,
    lastErrorCode: row?.last_error_code ?? null,
    allowNextronCalendar: permissions.calendar === "allowed",
    readOnly: true,
    missingEnv: missingGoogleCalendarEnv(),
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Sign in to manage Google Calendar." }, { status: 401 });
  const body = await readBody(request);
  if (!body || typeof body.allowNextronCalendar !== "boolean") return NextResponse.json({ error: "Invalid Calendar permission request." }, { status: 400 });
  const permissions = await currentPermissions(auth.supabase, auth.userId);
  const next = { ...permissions, calendar: body.allowNextronCalendar ? "allowed" : "denied" } satisfies NextronPermissionState;
  const { error } = await auth.supabase.from("nextron_context_preferences").upsert(buildNextronPreferenceUpsert(auth.userId, next), { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Failed to save Calendar permission." }, { status: 500 });
  return NextResponse.json({ allowNextronCalendar: next.calendar === "allowed" });
}

export async function DELETE() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Sign in to manage Google Calendar." }, { status: 401 });
  const { data } = await auth.supabase.from("google_calendar_connections").select("user_id, encrypted_tokens, token_iv, token_tag, scopes, token_expires_at, google_account_hint, status, last_error_code").eq("user_id", auth.userId).maybeSingle();
  const row = data as CalendarConnectionRow | null;
  if (row) {
    try {
      const tokens = await decryptCalendarTokens(row);
      await revokeGoogleCalendarToken(tokens.refresh_token ?? tokens.access_token);
    } catch {}
  }
  await auth.supabase.from("google_calendar_connections").delete().eq("user_id", auth.userId);
  const permissions = await currentPermissions(auth.supabase, auth.userId);
  const next = { ...permissions, calendar: "denied" } satisfies NextronPermissionState;
  await auth.supabase.from("nextron_context_preferences").upsert(buildNextronPreferenceUpsert(auth.userId, next), { onConflict: "user_id" });
  return NextResponse.json({ connected: false, allowNextronCalendar: false });
}
