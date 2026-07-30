import { NextResponse } from "next/server";
import { listDriveImports, refreshDriveImport, removeDriveImport } from "@/lib/nextron/drive";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to refresh Google Drive imports." }, { status: 401 });
  const { id } = await context.params;
  const result = await refreshDriveImport(supabase, user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ ...result, imports: await listDriveImports(supabase, user.id) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to remove Google Drive imports." }, { status: 401 });
  const { id } = await context.params;
  const removed = await removeDriveImport(supabase, user.id, id);
  if (!removed) return NextResponse.json({ error: "IMPORT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ removed: true, imports: await listDriveImports(supabase, user.id) });
}
