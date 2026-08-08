import { NextResponse } from "next/server";
import { buildConversationTitle } from "@/lib/nextron/conversation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load NEXTRON conversations." }, { status: 401 });

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a NEXTRON conversation." }, { status: 401 });

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
