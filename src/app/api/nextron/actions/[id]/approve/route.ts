import { NextResponse } from "next/server";
import { approveActionProposal } from "@/lib/nextron/actions";
import { resolveNextronAuth } from "@/lib/supabase/nextron-auth";

export const runtime = "nodejs";

function validId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Invalid action proposal." }, { status: 404 });
  // Same auth contract as /api/nextron/ask: Bearer (mobile) or cookie (web).
  const auth = await resolveNextronAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: "Sign in to approve this proposal." }, { status: 401 });
  const supabase = auth.supabase;
  const result = await approveActionProposal(supabase, id);
  if (!result.ok) return NextResponse.json({ error: result.message, reason: result.reason }, { status: result.reason.includes("ACTION") || result.reason.includes("TASK") ? 409 : 404 });
  return NextResponse.json({ proposal: result.proposal, taskExecutionEnabled: result.proposal.status === "completed" });
}
