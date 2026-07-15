"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LifePulseLogo } from "@/components/LifePulseLogo";
import Link from "next/link";

function friendlyAuthError(error: { message: string; status?: number }): string {
  const msg = error.message?.toLowerCase() ?? "";

  if (msg.includes("user already registered")) {
    return "This email is already registered. Try signing in instead.";
  }
  if (msg.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (msg.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("weak password")) {
    return "Password is too weak. Choose a stronger password.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("connect")) {
    return "Unable to connect. Check your internet connection and try again.";
  }
  if (msg.includes("profile") || msg.includes("database")) {
    return "Account created but profile setup failed. Please contact support.";
  }

  return "Failed to create account. Please try again.";
}

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function validate(): string | null {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!email.trim()) return "Email is required.";
    if (!email.includes("@") || !email.includes(".")) return "Enter a valid email address.";
    if (!password || password.length < 6) return "Password must be at least 6 characters.";
    if (!birthDate) return "Birth date is required.";
    const bd = new Date(birthDate);
    if (isNaN(bd.getTime())) return "Enter a valid birth date.";
    if (bd > new Date()) return "Birth date cannot be in the future.";
    const age = new Date().getFullYear() - bd.getFullYear();
    if (age > 120) return "Please enter a valid birth date.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            birth_date: birthDate,
            display_name: displayName,
          },
        },
      });

      if (signUpError) {
        console.error("Signup error:", signUpError.message);
        setError(friendlyAuthError(signUpError));
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push("/onboarding");
        router.refresh();
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch (err) {
      console.error("Signup exception:", err);
      setError("Unable to connect. Check your internet connection and try again.");
      setLoading(false);
    }
  }

  function handleReset() {
    setSuccess(false);
    setError(null);
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent-soft)]">
              <svg className="h-8 w-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-[var(--text)]">Check your email</h1>
            <p className="mb-2 text-sm leading-relaxed text-[var(--text-muted)]">
              Account created. Check your email to confirm your account, then sign in.
            </p>
            <p className="mb-8 text-xs text-[var(--text-muted)]">
              Email confirmation keeps private beta access tied to your invited address.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent)]"
            >
              Go to sign in
            </Link>
            <Button variant="secondary" className="w-full" onClick={handleReset}>
              Use another email
            </Button>
          </div>
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
          <h1 className="text-2xl font-bold text-[var(--text)]">Get started</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create your Life Pulse account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="text-sm font-medium text-[var(--text-muted)]">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
                required
                maxLength={100}
                autoComplete="given-name"
                className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="text-sm font-medium text-[var(--text-muted)]">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
                required
                maxLength={100}
                autoComplete="family-name"
                className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="birthDate" className="text-sm font-medium text-[var(--text-muted)]">
              Birth date
            </label>
            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={loading}
              required
              className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none [color-scheme:dark]"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
              Used to personalize your Life Pulse setup. It is not shown publicly and can be refined later in Settings.
            </p>
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-medium text-[var(--text-muted)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoComplete="email"
              className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-[var(--text-muted)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating your workspace..." : "Create account"}
          </Button>
          {loading && (
            <p className="text-center text-xs text-[var(--text-muted)]">
              Preparing setup.
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--accent)] hover:text-[var(--accent)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
