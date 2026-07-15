"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function prepareRecoverySession() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") ?? hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      let recoverySessionEstablished = false;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error("Password reset session exchange error:", exchangeError.message);
        } else {
          recoverySessionEstablished = true;
        }
      } else if (tokenHash && type === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (verifyError) {
          console.error("Password reset token verification error:", verifyError.message);
        } else {
          recoverySessionEstablished = true;
        }
      } else if (accessToken && refreshToken && type === "recovery") {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) {
          console.error("Password reset session setup error:", setSessionError.message);
        } else {
          recoverySessionEstablished = true;
        }
      } else if (searchParams.get("recovery") === "1") {
        recoverySessionEstablished = true;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      setHasRecoverySession(recoverySessionEstablished && Boolean(session));
      setCheckingSession(false);

      if (recoverySessionEstablished && session) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    prepareRecoverySession().catch((err) => {
      console.error("Password reset session check failed:", err);
      if (!isMounted) return;
      setHasRecoverySession(false);
      setCheckingSession(false);
    });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        console.error("Password update error:", updateError.message);
        setError("This reset link may have expired. Please request a new password reset link.");
        setLoading(false);
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      const {
        data: { session: remainingSession },
      } = await supabase.auth.getSession();

      if (signOutError && remainingSession) {
        console.error("Password reset sign-out error:", signOutError.message);
        setPassword("");
        setConfirm("");
        setError("Your password was updated, but we could not finish signing you out. Close this tab, then sign in again with your new password.");
        setLoading(false);
        return;
      }

      if (remainingSession) {
        setPassword("");
        setConfirm("");
        setError("Your password was updated, but the reset session is still active. Close this tab, then sign in again with your new password.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Unable to update your password. Please try again.");
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]">
            <LifePulseLogo variant="mark" size="md" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Checking reset link</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            One moment while we verify this password reset link.
          </p>
        </div>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]">
              <LifePulseLogo variant="mark" size="md" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Reset link expired</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              This password reset link is missing or has expired. Request a new reset link to choose a new password.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/forgot-password"
              className="block w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:bg-[var(--accent)]"
            >
              Request a new reset link
            </Link>
            <Link
              href="/login"
              className="block w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-2.5 text-center text-sm font-medium text-[var(--text)] transition-all hover:border-[var(--accent)]/50"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]">
              <LifePulseLogo variant="mark" size="md" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Password updated</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Your password has been updated.
            </p>
          </div>
          <Link
            href="/login"
            className="block w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:bg-[var(--accent)]"
          >
            Sign in with your new password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]">
            <LifePulseLogo variant="mark" size="md" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Choose a new password</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Choose a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="text-sm font-medium text-[var(--text-muted)]">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="text-sm font-medium text-[var(--text-muted)]">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          {error && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-[var(--danger)]">{error}</p>
              {error.includes("reset link") && (
                <Link href="/forgot-password" className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent)]">
                  Request a new reset link
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
