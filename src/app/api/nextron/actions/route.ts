import { NextResponse } from "next/server";
import { listRecentActionProposals } from "@/lib/nextron/actions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load NEXTRON action proposals." }, { status: 401 });
  return NextResponse.json({ proposals: await listRecentActionProposals(supabase) });
}
