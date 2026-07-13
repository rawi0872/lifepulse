"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  function getResetRedirectUrl() {
    return `${window.location.origin}/reset-password`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: getResetRedirectUrl(),
        },
      );

      if (resetError) {
        console.error("Forgot password error:", resetError.message);
        // Don't reveal whether the email exists; show a generic message
        setSent(true);
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch (err) {
      console.error("Forgot password exception:", err);
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
          <h1 className="text-2xl font-bold text-[var(--text)]">Reset your password</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Enter the email for your Life Pulse account. If an account exists, we&apos;ll send a reset link.
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
              If an account exists for that email, we sent a password reset link.
            </div>
            <Link
              href="/login"
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:bg-[var(--accent)]"
            >
              Back to login
            </Link>
          </div>
        ) : (
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

            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        {!sent && (
          <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-[var(--accent)] hover:text-[var(--accent)]">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
