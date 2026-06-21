import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

const features = [
  {
    title: "Daily priorities",
    description: "Set your top 3 priorities each day. One clear focus changes everything.",
  },
  {
    title: "Habit tracking",
    description: "Build routines that stick. Track daily, weekly, or weekday habits with streaks and progress.",
  },
  {
    title: "Task execution",
    description: "One-time actions with a clear finish. Due dates, priorities, and project links.",
  },
  {
    title: "Project planning",
    description: "Turn bigger goals into visible progress. Break outcomes into actionable steps.",
  },
  {
    title: "Journal & reflection",
    description: "Close the loop each day. Capture what worked, what didn't, and what's next.",
  },
  {
    title: "Progress & XP",
    description: "See your momentum. XP, levels, streaks, and weekly insights keep you moving.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between px-6 py-4 md:px-10">
        <LifePulseLogo size="sm" />
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
      </nav>

      <section className="px-6 pt-16 pb-20 text-center md:px-10 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-5 text-4xl font-bold tracking-tight text-[var(--text)] md:text-5xl">
            Your personal operating system
          </h1>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-[var(--text-secondary)]">
            Habits, tasks, projects, journaling, and progress — all connected in one focused system.
            Plan your day, track what matters, reflect on your momentum.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-strong)]"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] px-6 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-white/[0.03]"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] px-6 py-16 md:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-[var(--surface)] p-5">
                <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] px-6 py-16 text-center md:px-10">
        <h2 className="mb-4 text-2xl font-bold text-[var(--text)]">Ready to take control?</h2>
        <p className="mb-8 text-base text-[var(--text-secondary)]">
          One dashboard. All the tools you need to build momentum.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-8 py-3 text-base font-medium text-white transition-all hover:bg-[var(--accent-strong)]"
        >
          Get started free
        </Link>
      </section>
    </div>
  );
}
