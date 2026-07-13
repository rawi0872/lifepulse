"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

function friendlyAuthError(error: { message: string; status?: number }): string {
  const msg = error.message?.toLowerCase() ?? "";

  if (msg.includes("invalid login credentials")) {
    return "Wrong email or password. Please try again.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox.";
  }
  if (msg.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("user already registered")) {
    return "This email is already registered. Try signing in instead.";
  }
  if (msg.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (msg.includes("email link is invalid") || msg.includes("expired")) {
    return "This link is invalid or has expired. Please request a new one.";
  }
  if (msg.includes("unable to validate")) {
    return "Could not verify your credentials. Please try again.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("connect")) {
    return "Unable to connect. Check your internet connection and try again.";
  }

  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        console.error("Login error:", signInError.message);
        setError(friendlyAuthError(signInError));
        setLoading(false);
        return;
      }

      setLoading(false);
      router.refresh();
    } catch (err) {
      console.error("Login exception:", err);
      setError("Unable to connect. Check your internet connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]">
            <LifePulseLogo variant="mark" size="md" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Sign in to your Life Pulse account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-[var(--text-muted)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
               className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-[var(--text-muted)]">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
               className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          No account?{" "}
          <Link href="/signup" className="font-medium text-[var(--accent)] hover:text-[var(--accent)]">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
