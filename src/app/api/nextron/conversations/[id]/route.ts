import { NextResponse } from "next/server";
import { invalidateConversationActionProposals } from "@/lib/nextron/actions";
import { resolveNextronAuth } from "@/lib/supabase/nextron-auth";

export const runtime = "nodejs";

function validId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Invalid conversation." }, { status: 404 });
  const auth = await resolveNextronAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: "Sign in to load this NEXTRON conversation." }, { status: 401 });
  const supabase = auth.supabase;
  const user = auth.user;

  const { data: conversation, error: conversationError } = await supabase
    .from("nextron_conversations")
    .select("id, title, archived_at, deleted_at, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (conversationError || !conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data: messages, error: messagesError } = await supabase
    .from("nextron_messages")
    .select("id, conversation_id, role, content, response, metadata, created_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(120);
  if (messagesError) return NextResponse.json({ error: "Conversation messages could not be loaded." }, { status: 503 });
  return NextResponse.json({ conversation, messages: messages ?? [] });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Invalid conversation." }, { status: 404 });
  const auth = await resolveNextronAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: "Sign in to delete this NEXTRON conversation." }, { status: 401 });
  const supabase = auth.supabase;
  const user = auth.user;

  const { error } = await supabase
    .from("nextron_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: "Conversation could not be deleted." }, { status: 503 });
  await invalidateConversationActionProposals(supabase, id);
  await supabase.from("nextron_messages").delete().eq("conversation_id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
