import { NextResponse } from "next/server";
import {
  forgetPreferenceMemoryById,
  listActivePreferenceMemories,
  rememberPreferenceMemory,
  supersedePreferenceMemoryById,
} from "@/lib/nextron/memory";
import { resolveNextronAuth } from "@/lib/supabase/nextron-auth";

export const runtime = "nodejs";

async function authenticated(request?: Request) {
  const auth = await resolveNextronAuth(request);
  return auth.user && auth.supabase ? { supabase: auth.supabase, userId: auth.user.id } : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "Sign in to manage NEXTRON memory." }, { status: 401 });
  const memories = await listActivePreferenceMemories(auth.supabase, auth.userId);
  return NextResponse.json({ memories });
}

export async function POST(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return NextResponse.json({ error: "Sign in to manage NEXTRON memory." }, { status: 401 });
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid memory request." }, { status: 400 });
  const result = await rememberPreferenceMemory(auth.supabase, auth.userId, body.content);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ memory: result.memory, supersededCount: result.supersededCount });
}

export async function PATCH(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return NextResponse.json({ error: "Sign in to manage NEXTRON memory." }, { status: 401 });
  const body = await readBody(request);
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Invalid memory update request." }, { status: 400 });
  const result = await supersedePreferenceMemoryById(auth.supabase, auth.userId, body.id, body.content);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ memory: result.memory, supersededCount: result.supersededCount });
}

export async function DELETE(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return NextResponse.json({ error: "Sign in to manage NEXTRON memory." }, { status: 401 });
  const body = await readBody(request);
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Invalid memory delete request." }, { status: 400 });
  const result = await forgetPreferenceMemoryById(auth.supabase, auth.userId, body.id);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ forgottenCount: result.forgottenCount });
}
