import { NextResponse } from "next/server";
import { buildConversationTitle } from "@/lib/nextron/conversation";
import { resolveNextronAuth } from "@/lib/supabase/nextron-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await resolveNextronAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: "Sign in to load NEXTRON conversations." }, { status: 401 });
  const supabase = auth.supabase;
  const user = auth.user;

  const { data, error } = await supabase
    .from("nextron_conversations")
    .select("id, title, archived_at, deleted_at, created_at, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: "NEXTRON conversations could not be loaded." }, { status: 503 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await resolveNextronAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: "Sign in to create a NEXTRON conversation." }, { status: 401 });
  const supabase = auth.supabase;
  const user = auth.user;

  const body = await request.json().catch(() => null) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? buildConversationTitle(body.title) : "New NEXTRON conversation";
  const { data, error } = await supabase
    .from("nextron_conversations")
    .insert({ user_id: user.id, title })
    .select("id, title, archived_at, deleted_at, created_at, updated_at")
    .single();
  if (error || !data) return NextResponse.json({ error: "NEXTRON conversation could not be created." }, { status: 503 });
  return NextResponse.json({ conversation: data, messages: [] });
}
