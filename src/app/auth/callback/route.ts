import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ALLOWED_REDIRECT = ["/onboarding", "/today", "/settings", "/reset-password"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const nextParam = searchParams.get("next") ?? (type === "recovery" ? "/reset-password" : "/onboarding");
  const next = ALLOWED_REDIRECT.includes(nextParam) ? nextParam : "/onboarding";

  if (code) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const redirectUrl = next === "/reset-password" ? `${origin}${next}?recovery=1` : `${origin}${next}`;
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieHeader
              .split("; ")
              .filter(Boolean)
              .map((c) => {
                const [name, ...rest] = c.split("=");
                return { name, value: rest.join("=") };
              });
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=session_expired`);
    }
    return response;
  }

  return NextResponse.redirect(`${origin}${next}`);
}
