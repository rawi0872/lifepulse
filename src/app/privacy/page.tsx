import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

// TODO: Replace support@example.com with real support email before production launch.
const SUPPORT_EMAIL = "support@example.com";

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Last updated: June 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--text-secondary)]">

          {/* Overview */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Overview</h2>
            <p>
              Life Pulse is a personal productivity and life tracking app. We store the information you add so your
              dashboard, progress, journal, and finance tracker can work. This policy explains what data we collect,
              how we use it, and your choices.
            </p>
          </section>

          {/* Information you provide */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Information you provide</h2>
            <p>When you use Life Pulse, you may provide the following types of information:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
              <li>Account information — email address and optional profile fields</li>
              <li>Life areas / realms you choose to track</li>
              <li>Tasks you create</li>
              <li>Habits and habit logs</li>
              <li>Projects and their status</li>
              <li>Journal entries — your personal reflections</li>
              <li>Finance data — accounts, categories, transactions, and budgets you enter manually</li>
              <li>App settings and preferences</li>
            </ul>
          </section>

          {/* How data is used */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">How your data is used</h2>
            <p>Your data is used to power the tools you rely on inside Life Pulse:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
              <li>Display your dashboard and daily view</li>
              <li>Calculate XP, levels, streaks, and progress insights</li>
              <li>Generate your Life Balance Map</li>
              <li>Track habits, tasks, and projects</li>
              <li>Show finance summaries and charts</li>
              <li>Save and organize journal entries for your personal reflection</li>
              <li>Improve your personal experience within the app</li>
            </ul>
          </section>

          {/* Finance data */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Finance data</h2>
            <p>
              Finance tracking in Life Pulse is entirely manual. You enter your own income, expenses, account balances,
              and budgets. Life Pulse does not connect to banks, does not request bank passwords, and does not pull
              financial data from any external institution.
            </p>
            <p className="mt-2">
              Life Pulse does not provide financial advice. All finance features are tracking tools only. Accuracy of
              finance data depends on what you enter.
            </p>
          </section>

          {/* Journal and personal data */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Journal and personal content</h2>
            <p>
              Journal entries are private content you write for yourself. They are stored securely and associated only
              with your account. You should avoid storing sensitive information you would not want saved. Journal
              entries are used only to display and organize your own reflection experience.
            </p>
          </section>

          {/* Account data and access */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Account data and access</h2>
            <p>
              Your data is tied to your account. You are responsible for keeping your login credentials secure. Data
              is separated by user account through authentication and access controls provided by our infrastructure
              providers.
            </p>
          </section>

          {/* Data sharing */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Data sharing</h2>
            <p>
              We do not sell your personal data. We do not share your personal data with advertisers or third parties
              for marketing purposes. Data may be processed by infrastructure providers necessary to operate the
              service, including hosting, database, authentication, and email providers.
            </p>
          </section>

          {/* Data deletion */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Data deletion</h2>
            <p>
              You can request deletion of your account and associated data at any time. During beta, account deletion
              requests can be sent to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent)] hover:text-[var(--accent-strong)] underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
              . We will process deletion requests promptly.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Changes to this policy</h2>
            <p>
              We may update this Privacy Policy as Life Pulse evolves. Changes will be posted on this page with an
              updated date. Continued use after changes means you accept the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--text)]">Contact</h2>
            <p>
              If you have questions about this policy or your data, reach out to{" "}
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
