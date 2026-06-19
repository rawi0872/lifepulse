import { createBrowserClient } from "@supabase/ssr";

function isPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  return val === "your_supabase_project_url"
    || val === "your_supabase_anon_key"
    || val.includes("placeholder")
    || val.startsWith("http://localhost")
    || val === "http://127.0.0.1:54321";
}

export function createClient() {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const missing: string[] = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (url && isPlaceholder(url)) {
      console.warn(
        "[Life Pulse] NEXT_PUBLIC_SUPABASE_URL appears to be a placeholder or local URL. Set it to your real Supabase project URL.",
      );
    }
    if (missing.length > 0) {
      console.warn(`[Life Pulse] Missing Supabase env vars: ${missing.join(", ")}`);
    }
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
