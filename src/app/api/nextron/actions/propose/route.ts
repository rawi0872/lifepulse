import { NextResponse } from "next/server";
import { createActionProposal, parseNextronActionIntent } from "@/lib/nextron/actions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function readBody(request: Request): Promise<{ prompt?: unknown; conversationId?: unknown } | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body as { prompt?: unknown; conversationId?: unknown } : null;
  } catch {
    return null;
  }
}

function validId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body || typeof body.prompt !== "string") return NextResponse.json({ error: "Invalid action proposal request." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to propose a NEXTRON action." }, { status: 401 });

  const parsed = parseNextronActionIntent(body.prompt);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message, reason: parsed.reason }, { status: parsed.reason === "NO_ACTION" ? 404 : 400 });
  const result = await createActionProposal({ supabase, conversationId: validId(body.conversationId), actionType: parsed.actionType, parameters: parsed.parameters });
  if (!result.ok) return NextResponse.json({ error: result.message, reason: result.reason, diagnostic: result.diagnostic ?? null }, { status: 400 });
  return NextResponse.json({ proposal: result.proposal });
}
