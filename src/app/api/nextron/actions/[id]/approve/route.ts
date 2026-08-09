import { NextResponse } from "next/server";
import { approveActionProposal } from "@/lib/nextron/actions";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function validId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Invalid action proposal." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to approve this proposal." }, { status: 401 });
  const result = await approveActionProposal(supabase, id);
  if (!result.ok) return NextResponse.json({ error: result.message, reason: result.reason }, { status: result.reason === "TASK_ACTIONS_NOT_ALLOWED" || result.reason === "TASK_PRECONDITION_FAILED" ? 409 : 404 });
  return NextResponse.json({ proposal: result.proposal, taskExecutionEnabled: result.proposal.status === "completed" });
}
