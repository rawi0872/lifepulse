import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyViewport, EVENT_STATUS, EVENT_SURFACE, sanitizeProductLearningMetadata } from "@/lib/product-learning/events";

export const runtime = "nodejs";

const CATEGORIES = new Set(["bug", "confusing", "idea", "praise", "other"]);

function normalizeRoutePath(value: unknown) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.length > 120) return null;
  if (/[\r\n?#]/.test(value)) return null;
  return value;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  if (body.userId !== undefined) return NextResponse.json({ error: "Owner identity is derived from the session." }, { status: 400 });

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 1 || message.length > 2000) return NextResponse.json({ error: "Feedback must be 1-2000 characters." }, { status: 400 });
  const category = typeof body.category === "string" && CATEGORIES.has(body.category) ? body.category : null;
  if (body.category && !category) return NextResponse.json({ error: "Unsupported feedback category." }, { status: 400 });
  const rating = typeof body.rating === "number" && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
  if (body.rating !== undefined && body.rating !== null && rating === null) return NextResponse.json({ error: "Unsupported feedback rating." }, { status: 400 });
  const pagePath = normalizeRoutePath(body.routePath);
  if (body.routePath !== undefined && !pagePath) return NextResponse.json({ error: "Unsupported feedback route." }, { status: 400 });
  const viewport = classifyViewport(typeof body.viewportWidth === "number" ? body.viewportWidth : null);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    page_path: pagePath,
    rating,
    category,
    message,
    browser_info: `viewport:${viewport}`,
  });
  if (error) return NextResponse.json({ error: "Feedback was not saved." }, { status: 500 });

  const { data: profile } = await supabase.from("profiles").select("allow_product_improvement_events").eq("user_id", user.id).maybeSingle();
  const metadata = sanitizeProductLearningMetadata("feedback_submitted", { viewport });
  if (profile?.allow_product_improvement_events && metadata) {
    await supabase.from("product_learning_events").insert({
      user_id: user.id,
      event_type: "feedback_submitted",
      surface: EVENT_SURFACE.feedback_submitted,
      status: EVENT_STATUS.feedback_submitted ?? null,
      reason: null,
      viewport: metadata.viewport ?? null,
      release_version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
