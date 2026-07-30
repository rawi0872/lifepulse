import { NextResponse } from "next/server";
import { buildNextronPreferenceUpsert, normalizeNextronPreferences, type NextronPreferenceRow, type NextronPermissionState } from "@/lib/nextron/context";
import { disconnectGoogleDrive, getGoogleDriveEnv, listDriveImports, missingGoogleDriveEnv, type DriveConnectionRow } from "@/lib/nextron/drive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREFERENCE_COLUMNS = "permission_version, allow_profile, allow_today, allow_tasks, allow_habits, allow_results, allow_goals, allow_projects, allow_knowledge, allow_drive, allow_calendar, allow_journal, allow_evening_shutdown, allow_weekly_review";

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
  if (!auth) return NextResponse.json({ error: "Sign in to manage Google Drive." }, { status: 401 });
  const [permissions, connection, imports] = await Promise.all([
    currentPermissions(auth.supabase, auth.userId),
    auth.supabase.from("google_drive_connections").select("status, token_expires_at, google_account_hint, last_error_code").eq("user_id", auth.userId).maybeSingle(),
    listDriveImports(auth.supabase, auth.userId),
  ]);
  const row = connection.data as Pick<DriveConnectionRow, "status" | "token_expires_at" | "google_account_hint" | "last_error_code"> | null;
  const env = getGoogleDriveEnv();
  return NextResponse.json({
    connected: row?.status === "connected",
    status: row?.status ?? "not_connected",
    accountHint: row?.google_account_hint ?? null,
    lastErrorCode: row?.last_error_code ?? null,
    allowNextronDrive: permissions.drive === "allowed",
    readOnly: true,
    scope: "drive.file",
    picker: { apiKey: env.pickerApiKey || null, appId: env.pickerAppId || null },
    imports,
    missingEnv: missingGoogleDriveEnv(),
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Sign in to manage Google Drive." }, { status: 401 });
  const body = await readBody(request);
  if (!body || typeof body.allowNextronDrive !== "boolean") return NextResponse.json({ error: "Invalid Drive permission request." }, { status: 400 });
  const permissions = await currentPermissions(auth.supabase, auth.userId);
  const next = { ...permissions, drive: body.allowNextronDrive ? "allowed" : "denied" } satisfies NextronPermissionState;
  const { error } = await auth.supabase.from("nextron_context_preferences").upsert(buildNextronPreferenceUpsert(auth.userId, next), { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Failed to save Drive permission." }, { status: 500 });
  return NextResponse.json({ allowNextronDrive: next.drive === "allowed" });
}

export async function DELETE() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Sign in to manage Google Drive." }, { status: 401 });
  await disconnectGoogleDrive(auth.supabase, auth.userId);
  const permissions = await currentPermissions(auth.supabase, auth.userId);
  const next = { ...permissions, drive: "denied" } satisfies NextronPermissionState;
  await auth.supabase.from("nextron_context_preferences").upsert(buildNextronPreferenceUpsert(auth.userId, next), { onConflict: "user_id" });
  return NextResponse.json({ connected: false, allowNextronDrive: false, imports: [] });
}
