import { NextResponse } from "next/server";
import { buildLifeMapGraph } from "@/lib/life-map";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load your Life Map." }, { status: 401 });

  try {
    const graph = await buildLifeMapGraph(supabase, user.id);
    return NextResponse.json({ graph });
  } catch {
    return NextResponse.json({ error: "Life Map is unavailable right now." }, { status: 503 });
  }
}
