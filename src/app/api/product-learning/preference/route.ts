import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function readBody(request: Request): Promise<{ allow?: unknown } | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as { allow?: unknown };
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data } = await supabase.from("profiles").select("allow_product_improvement_events").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ allow: Boolean(data?.allow_product_improvement_events) });
}

export async function PATCH(request: Request) {
  const body = await readBody(request);
  if (typeof body?.allow !== "boolean") return NextResponse.json({ error: "Invalid product learning preference." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { error } = await supabase.from("profiles").update({ allow_product_improvement_events: body.allow }).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Preference was not saved." }, { status: 500 });
  return NextResponse.json({ allow: body.allow });
}
