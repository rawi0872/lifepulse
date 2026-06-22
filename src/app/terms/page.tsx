import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

// TODO: Replace support@example.com with real support email before production launch.
const SUPPORT_EMAIL = "support@example.com";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/">
            <LifePulseLogo size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--accent-strong)]"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-3xl px-5 py-16 md:py-24">
        <h1 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Last updated: June 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--text-secondary)]">

          {/* Acceptance */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Acceptance</h2>
            <p>
              By using Life Pulse, you agree to these Terms of Service. If you do not agree, please do not use the
              service.
            </p>
          </section>

          {/* What Life Pulse is */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">What Life Pulse is</h2>
            <p>
              Life Pulse is a personal productivity, reflection, habit, project, and manual finance tracking tool.
              It is designed to help you organize your daily actions and review your progress across areas you choose.
            </p>
          </section>

          {/* Not professional advice */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Not professional advice</h2>
            <p>
              Life Pulse does not provide financial advice, medical advice, or legal advice. All tools and features
              are for personal tracking and organizational purposes only. You are solely responsible for your own
              decisions and actions.
            </p>
          </section>

          {/* Finance disclaimer */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Finance disclaimer</h2>
            <p>
              Finance features are manual tracking tools only. Life Pulse does not connect to banks, does not provide
              investment recommendations, and does not guarantee the accuracy of manually entered data. You should not
              rely on Life Pulse as your primary financial record or for tax purposes without verifying entries
              yourself.
            </p>
          </section>

          {/* User responsibility */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Your responsibility</h2>
            <p>You are responsible for:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
              <li>Entering accurate data</li>
              <li>Keeping your account credentials secure</li>
              <li>Using the app lawfully and in accordance with these terms</li>
              <li>Not entering data you do not want stored</li>
            </ul>
          </section>

          {/* Acceptable use */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Acceptable use</h2>
            <p>You may not:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
              <li>Abuse or disrupt the service</li>
              <li>Attempt to access another user&apos;s data</li>
              <li>Attack, overload, or compromise the infrastructure</li>
              <li>Use the app for any illegal activity</li>
            </ul>
          </section>

          {/* Availability */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Availability</h2>
            <p>
              Life Pulse is provided as a beta service. Features may change, break, or become unavailable without
              notice. We do not guarantee perfect uptime or uninterrupted access during development.
            </p>
          </section>

          {/* Account termination */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Account termination</h2>
            <p>
              You may stop using Life Pulse at any time. You can request deletion of your account and data by
              contacting{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent)] hover:text-[var(--accent-strong)] underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
              . We may restrict or suspend accounts that violate these terms.
            </p>
          </section>

          {/* Limitation of liability */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Limitation of liability</h2>
            <p>
              Life Pulse is provided &ldquo;as is&rdquo; during beta. To the fullest extent permitted by law, we are
              not liable for any damages or losses arising from your use of the service. You use the service at your
              own risk.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Contact</h2>
            <p>
              For questions about these terms, reach out to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent)] hover:text-[var(--accent-strong)] underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-[var(--border)] px-5 py-6 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <Link href="/">
            <LifePulseLogo variant="compact" size="sm" showWordmark={true} />
          </Link>
          <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
            <Link href="/privacy" className="hover:text-[var(--text-secondary)] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--text-secondary)] transition-colors">
              Terms
            </Link>
            <span>&copy; {new Date().getFullYear()} Life Pulse</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
