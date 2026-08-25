import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NextronAuthResult =
  | { supabase: SupabaseClient; user: { id: string; email?: string | null }; method: "bearer" | "cookie" }
  | { supabase: null; user: null; error: "unauthenticated" };

export async function resolveNextronAuth(request?: Request): Promise<NextronAuthResult> {
  let authHeader: string | null = null;
  if (request) {
    authHeader = request.headers.get("authorization");
  } else {
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      authHeader = h.get("authorization");
    } catch {
      authHeader = null;
    }
  }
  if (authHeader) {
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!bearer) {
      return { supabase: null, user: null, error: "unauthenticated" };
    }
    // Verify token using anon client + explicit token, do not trust claims
    const supabase = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      },
    );
    const { data, error } = await supabase.auth.getUser(bearer);
    if (error || !data.user) {
      return { supabase: null, user: null, error: "unauthenticated" };
    }
    // Re-create client with bearer for RLS-bound queries
    // (already set via global header, but ensure)
    return { supabase, user: data.user, method: "bearer" };
  }

  // Web cookie path — preserve existing behavior
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase: null, user: null, error: "unauthenticated" };
  }
  return { supabase, user: data.user, method: "cookie" };
}
