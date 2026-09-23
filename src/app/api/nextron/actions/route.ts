import { NextResponse } from "next/server";
import { listRecentActionProposals } from "@/lib/nextron/actions";
import { resolveNextronAuth } from "@/lib/supabase/nextron-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // Same auth contract as /api/nextron/ask: Bearer (mobile) or cookie (web).
  const auth = await resolveNextronAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: "Sign in to load NEXTRON action proposals." }, { status: 401 });
  const supabase = auth.supabase;
  return NextResponse.json({ proposals: await listRecentActionProposals(supabase) });
}
