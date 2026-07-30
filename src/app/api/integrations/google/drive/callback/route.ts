import { NextResponse } from "next/server";
import { encryptCalendarTokens } from "@/lib/nextron/calendar";
import { exchangeGoogleDriveCode, GOOGLE_DRIVE_SCOPE, GOOGLE_DRIVE_SCOPES, sha256Base64Url } from "@/lib/nextron/drive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FORBIDDEN_DRIVE_SCOPES = new Set(["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.readonly"]);

function settingsRedirect(request: Request, status: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("drive", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return settingsRedirect(request, "cancelled");
  if (!code || !state) return settingsRedirect(request, "error");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return settingsRedirect(request, "signin_required");

  const cookieState = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("lp_google_drive_oauth_state="))?.split("=")[1];
  if (!cookieState || cookieState !== state) return settingsRedirect(request, "state_error");

  const stateHash = await sha256Base64Url(state);
  const { data: stateRow } = await supabase.from("google_drive_oauth_states").select("state_hash, user_id, expires_at, consumed_at").eq("state_hash", stateHash).eq("user_id", user.id).maybeSingle();
  const validState = stateRow as { state_hash: string; user_id: string; expires_at: string; consumed_at: string | null } | null;
  if (!validState || validState.consumed_at || Date.parse(validState.expires_at) < Date.now()) return settingsRedirect(request, "state_error");

  try {
    const tokens = await exchangeGoogleDriveCode(code);
    const grantedScopes = new Set(tokens.scope?.split(/\s+/).filter(Boolean) ?? [...GOOGLE_DRIVE_SCOPES]);
    if (!grantedScopes.has(GOOGLE_DRIVE_SCOPE) || Array.from(grantedScopes).some((scope) => FORBIDDEN_DRIVE_SCOPES.has(scope))) return settingsRedirect(request, "scope_error");
    const encrypted = await encryptCalendarTokens(tokens);
    await supabase.from("google_drive_connections").upsert({
      user_id: user.id,
      ...encrypted,
      scopes: [GOOGLE_DRIVE_SCOPE],
      token_expires_at: tokens.expires_at ?? null,
      status: "connected",
      last_error_code: null,
      connected_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    await supabase.from("google_drive_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state_hash", stateHash).eq("user_id", user.id);
    const response = settingsRedirect(request, "connected");
    response.cookies.set("lp_google_drive_oauth_state", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
    return response;
  } catch {
    await supabase.from("google_drive_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state_hash", stateHash).eq("user_id", user.id);
    return settingsRedirect(request, "error");
  }
}
