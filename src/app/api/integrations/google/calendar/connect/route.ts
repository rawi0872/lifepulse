import { NextResponse } from "next/server";
import { buildGoogleCalendarAuthUrl, createOAuthState, missingGoogleCalendarEnv, sha256Base64Url } from "@/lib/nextron/calendar";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const missingEnv = missingGoogleCalendarEnv();
  if (missingEnv.length > 0) return NextResponse.json({ error: "Google Calendar connector is not configured.", missingEnv }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to connect Google Calendar." }, { status: 401 });

  const state = createOAuthState();
  const stateHash = await sha256Base64Url(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from("google_calendar_oauth_states").insert({ state_hash: stateHash, user_id: user.id, redirect_path: "/settings", expires_at: expiresAt });
  if (error) return NextResponse.json({ error: "Could not start Google Calendar connection." }, { status: 500 });

  const response = NextResponse.json({ authUrl: buildGoogleCalendarAuthUrl(state) });
  response.cookies.set("lp_google_calendar_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 10 * 60 });
  return response;
}
