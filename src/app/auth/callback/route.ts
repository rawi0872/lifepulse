import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ALLOWED_REDIRECT = ["/onboarding", "/today", "/settings"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/onboarding";
  const next = ALLOWED_REDIRECT.includes(nextParam) ? nextParam : "/onboarding";

  if (code) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const response = NextResponse.redirect(`${origin}${next}`);

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
