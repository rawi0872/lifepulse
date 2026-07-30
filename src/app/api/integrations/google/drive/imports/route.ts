import { NextResponse } from "next/server";
import { importSelectedDriveFile, listDriveImports } from "@/lib/nextron/drive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view Google Drive imports." }, { status: 401 });
  return NextResponse.json({ imports: await listDriveImports(supabase, user.id) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to import Google Drive files." }, { status: 401 });
  const body = await readBody(request);
  const fileId = typeof body?.fileId === "string" ? body.fileId.trim() : "";
  const resourceKey = typeof body?.resourceKey === "string" ? body.resourceKey.trim() : null;
  if (!fileId) return NextResponse.json({ error: "Missing selected Google Drive file." }, { status: 400 });
  const result = await importSelectedDriveFile({ supabase, userId: user.id, fileId, resourceKey });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ ...result, imports: await listDriveImports(supabase, user.id) });
}
