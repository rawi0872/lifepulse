import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EVENT_STATUS, EVENT_SURFACE, isProductLearningEvent, sanitizeProductLearningMetadata } from "@/lib/product-learning/events";

export const runtime = "nodejs";

async function readBody(request: Request): Promise<{ event?: unknown; metadata?: unknown; userId?: unknown } | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as { event?: unknown; metadata?: unknown; userId?: unknown };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body || !isProductLearningEvent(body.event)) {
    return NextResponse.json({ error: "Unsupported product learning event." }, { status: 400 });
  }
  if (body.userId !== undefined) {
    return NextResponse.json({ error: "Owner identity is derived from the session." }, { status: 400 });
  }

  const metadata = sanitizeProductLearningMetadata(body.event, body.metadata);
  if (!metadata) return NextResponse.json({ error: "Unsupported product learning metadata." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("allow_product_improvement_events")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.allow_product_improvement_events) {
    return NextResponse.json({ recorded: false, reason: "disabled" });
  }

  const releaseVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const { error } = await supabase.from("product_learning_events").insert({
    user_id: user.id,
    event_type: body.event,
    surface: EVENT_SURFACE[body.event],
    status: EVENT_STATUS[body.event] ?? null,
    reason: body.event === "nextron_ask_failed" ? metadata.reason ?? "unknown" : null,
    viewport: metadata.viewport ?? null,
    release_version: releaseVersion,
  });

  if (error) return NextResponse.json({ error: "Product learning event was not recorded." }, { status: 500 });
  return NextResponse.json({ recorded: true });
}
