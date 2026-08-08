import { NextResponse } from "next/server";
import { getGoogleDrivePickerToken, missingGoogleDriveEnv } from "@/lib/nextron/drive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const missingEnv = missingGoogleDriveEnv();
  if (missingEnv.length > 0) return NextResponse.json({ error: "Google Drive connector is not configured.", missingEnv }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to import Google Drive files." }, { status: 401 });
  const result = await getGoogleDrivePickerToken(supabase, user.id);
  if (!result.ok && result.reason === "DRIVE_RECONNECT_REQUIRED") return NextResponse.json({ error: "DRIVE_RECONNECT_REQUIRED" }, { status: 409 });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 403 });
  return NextResponse.json({ accessToken: result.accessToken, expiresAt: result.expiresAt, scope: "drive.file" });
}
