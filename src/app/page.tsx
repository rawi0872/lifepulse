import Link from "next/link";
import { LifePulseLogo } from "@/components/LifePulseLogo";

// ─── Small inline icons ────────────────────────────────────────────────────

function IconToday() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5" opacity="0.3" />
      <path d="M6.5 10.5l2 2 4-4" strokeWidth="1.8" />
    </svg>
  );
}

function IconHabits() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2" opacity="0.3" />
      <circle cx="10" cy="10" r="4" />
      <path d="M12 8l-3 3-1-1" />
    </svg>
  );
}

function IconProjects() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" opacity="0.25" />
      <path d="M2.5 8h15" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

function IconFinance() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6" width="15" height="10" rx="1.5" opacity="0.25" />
      <path d="M2.5 6l7.5 4 7.5-4" />
      <circle cx="10" cy="11" r="1.5" />
    </svg>
  );
}

function IconJournal() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3.5h8a2 2 0 012 2v11a2 2 0 01-2 2H4z" opacity="0.25" />
      <path d="M4 3.5H3a1.5 1.5 0 000 3h1" />
      <path d="M7 8.5h4M7 11.5h4M7 14.5h2" />
    </svg>
  );
}

function IconInsights() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="10,2 17,6 17,14 10,18 3,14 3,6" opacity="0.25" />
      <polygon points="10,5 14,7.5 14,12.5 10,15 6,12.5 6,7.5" opacity="0.4" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

// ─── Feature definitions ───────────────────────────────────────────────────

const features = [
  {
    icon: <IconToday />,
    title: "Today",
    desc: "Choose one priority, capture loose work, and see the tasks, habits, and signals that matter today.",
  },
  {
    icon: <IconHabits />,
    title: "Habits",
    desc: "Track repeat actions without pressure. Completed habits become part of your private momentum and weekly picture.",
  },
  {
    icon: <IconProjects />,
    title: "Projects",
    desc: "Turn larger outcomes into visible next steps when you are ready to go beyond the daily loop.",
  },
  {
    icon: <IconFinance />,
    title: "Finance",
    desc: "Log money manually when it matters. No bank connections, no advice, just the numbers you choose to enter.",
  },
  {
    icon: <IconJournal />,
    title: "Journal",
    desc: "Close the day with private reflection. Your notes become history for Weekly Review, not public content.",
  },
  {
    icon: <IconInsights />,
    title: "Insights",
    desc: "See patterns from logged actions: XP, consistency, life areas, and weekly signals based on what you entered.",
  },
];

const replacementItems = [
  "todo lists",
  "habit trackers",
  "notes and journals",
  "body and mind logs",
  "weekly review docs",
  "Notion-style dashboards",
];

// ─── Daily loop steps ──────────────────────────────────────────────────────

const steps = [
  {
    num: "01",
    title: "Plan today",
    desc: "Choose one priority and capture anything else before it becomes mental noise.",
  },
  {
    num: "02",
    title: "Act visibly",
    desc: "Complete tasks and habits so the day has a few clear actions, not just intention.",
  },
  {
    num: "03",
    title: "Log signals",
    desc: "Add body, mind, finance, or life context manually when it helps you remember the day.",
  },
  {
    num: "04",
    title: "Reflect and review",
    desc: "Write what changed, then use Weekly Review to see what helped, drifted, and needs adjustment.",
  },
];

const compoundingSteps = [
  {
    label: "One day",
    text: "You know the next priority and one visible action.",
  },
  {
    label: "A few days",
    text: "Repeated themes start showing up in tasks, habits, and reflections.",
  },
  {
    label: "One week",
    text: "Weekly Review turns logged actions and notes into a clearer picture.",
  },
  {
    label: "Over time",
    text: "You can see what helps, what drifts, and what to adjust next.",
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
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
              Start beta
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pt-16 pb-20 text-center md:px-8 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex justify-center">
            <LifePulseLogo size="lg" />
          </div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Private beta · daily operating system
          </p>
          <h1 className="mb-5 text-4xl font-bold tracking-tight text-[var(--text)] md:text-6xl">
            Your private operating system
            <br />
            <span className="text-[var(--text-secondary)]">for daily progress.</span>
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
            Stop scattering your life across tasks, notes, habits, and trackers. Life Pulse helps you plan one priority, complete visible actions, reflect on what changed, and review the week from what you actually logged.
          </p>
          <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
            {["Plan", "Act", "Reflect", "Review"].map((item) => (
              <div key={item} className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-center text-xs font-medium text-[var(--text-secondary)]">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-strong)] sm:w-auto"
            >
              Start your private beta
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--border-strong)] px-6 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-white/[0.03] sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Hero product preview card */}
        <div className="mx-auto mt-16 max-w-2xl">
          <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-xl shadow-black/30 md:p-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
                <LifePulseLogo variant="mark" size="sm" />
                <span>Daily loop</span>
              </div>
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-[var(--success)]/50" />
                <div className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
                <div className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-left">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Plan</p>
                <p className="mt-1 text-xs text-[var(--text)]">One priority</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-left">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Act</p>
                <p className="mt-1 text-xs text-[var(--text)]">Visible actions</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-left">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Review</p>
                <p className="mt-1 text-xs text-[var(--text)]">Weekly picture</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scattered tools ── */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                Less scattered self-improvement
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] md:text-3xl">
                One private loop instead of six disconnected places.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">
                Life Pulse is designed to bring the daily loop into one place. Start with the core rhythm, then expand into body, mind, finance, projects, knowledge, and passions when they are useful.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {replacementItems.map((item) => (
                <div key={item} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Instead of scattered {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Product preview ── */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-[var(--text)] md:text-3xl">
            Built around the daily loop
          </h2>
          <p className="mx-auto mt-3 mb-12 max-w-xl text-center text-base text-[var(--text-secondary)]">
            A focused set of tools that work together: plan today, act, log what matters, reflect, and review the week.
          </p>
          <div className="grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-[var(--surface)] p-6 transition-colors hover:bg-[var(--surface-raised)]">
                <div className="mb-3 text-[var(--accent)]">{f.icon}</div>
                <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Daily loop ── */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-[var(--text)] md:text-3xl">
            Plan, act, reflect, review
          </h2>
          <p className="mx-auto mt-3 mb-14 max-w-xl text-center text-base text-[var(--text-secondary)]">
            The value is not another dashboard. It is a repeatable daily loop that creates a clearer weekly picture.
          </p>
          <div className="grid gap-6 md:grid-cols-4 md:gap-8">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-xs font-bold text-[var(--text-muted)]">
                  {s.num}
                </div>
                <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">{s.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Weekly payoff ── */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Why daily use compounds
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] md:text-3xl">
              A few logged days become a useful review.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
              Life Pulse does not promise automatic transformation. It gives you a private place to collect enough honest signals to see what helped, what drifted, and what to adjust.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {compoundingSteps.map((item) => (
              <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{item.label}</p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Life Balance Map ── */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-10 md:flex-row md:gap-14">
            {/* Preview card */}
            <div className="w-full max-w-sm shrink-0">
              <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-xl shadow-black/20 md:p-6">
                <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center md:h-48 md:w-48">
                  <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
                    <defs>
                      <radialGradient id="hp-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
                      </radialGradient>
                    </defs>
                    {/* Enclosure */}
                    <path d="M200 72l117 68v136l-117 68-117-68V140z" fill="var(--surface-soft)" fillOpacity="0.3" stroke="currentColor" strokeWidth="0.6" opacity="0.08" />
                    {/* Grid rings */}
                    <path d="M200 110l93 54v108l-93 54-93-54V164z" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.06" />
                    <path d="M200 134l76 44v88l-76 44-76-44V178z" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.05" />
                    {/* Axis lines */}
                    <line x1="200" y1="72" x2="200" y2="328" stroke="currentColor" strokeWidth="0.4" opacity="0.06" />
                    <line x1="200" y1="72" x2="317" y2="140" stroke="currentColor" strokeWidth="0.4" opacity="0.04" />
                    <line x1="317" y1="140" x2="83" y2="140" stroke="currentColor" strokeWidth="0.4" opacity="0.04" />
                    <line x1="200" y1="72" x2="83" y2="140" stroke="currentColor" strokeWidth="0.4" opacity="0.04" />
                    <line x1="83" y1="140" x2="317" y2="140" stroke="currentColor" strokeWidth="0.4" opacity="0.04" />
                    {/* Labels */}
                    <text x="200" y="62" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="600" opacity="0.35">Mind</text>
                    <text x="200" y="345" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="600" opacity="0.35">Body</text>
                    <text x="332" y="140" textAnchor="start" fill="currentColor" fontSize="9" fontWeight="600" opacity="0.35">Career</text>
                    <text x="68" y="140" textAnchor="end" fill="currentColor" fontSize="9" fontWeight="600" opacity="0.35">Faith</text>
                    <text x="302" y="210" textAnchor="start" fill="currentColor" fontSize="9" fontWeight="600" opacity="0.35">Finance</text>
                    <text x="98" y="210" textAnchor="end" fill="currentColor" fontSize="9" fontWeight="600" opacity="0.35">Relationships</text>
                    {/* Data polygon (sample shape) */}
                    <path d="M200 130l72 42v72l-72 42-72-42V172z" fill="url(#hp-grad)" opacity="0.3" />
                    <path d="M200 130l72 42v72l-72 42-72-42V172z" fill="none" stroke="var(--accent)" strokeWidth="1.2" opacity="0.4" />
                    {/* Center */}
                    <circle cx="200" cy="200" r="2" fill="currentColor" opacity="0.15" />
                  </svg>
                </div>
                <div className="space-y-2 text-center text-xs text-[var(--text-muted)]">
                  <p>Mind · Body · Career · Relationships · Finance · Faith</p>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
                See the shape of your life.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">
                Life Pulse turns completed actions and manual logs across life areas into a visual balance map.
                See where attention is going and where your weekly picture is still thin.
              </p>
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No life score — just a private view based on what you enter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy / trust ── */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-xl font-bold text-[var(--text)] md:text-2xl">
            Private by default, manual by design
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Life Pulse is based on what you choose to enter. No public profiles, no social pressure, no fake AI judgment, and no medical or financial advice.
          </p>
          <div className="mx-auto mt-8 grid max-w-lg gap-3 text-left md:grid-cols-2 md:gap-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text)]">Manual logs</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Tasks, habits, body, mind, finance, and reflection are based on what you enter.</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text)]">Your data stays yours</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Tied to your account. Separated by design. Not a public profile.</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text)]">No fake AI judgment</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">No AI summaries, no life score, no public ranking, no social pressure.</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text)]">Careful boundaries</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">A tracking and review tool, not medical, mental health, or financial advice.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Life Pulse is different ── */}
      <section className="border-t border-[var(--border)] px-5 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-xl font-bold text-[var(--text)] md:text-2xl">
            Not another generic tracker
          </h2>
          <p className="mx-auto mt-3 mb-10 max-w-lg text-sm text-[var(--text-secondary)]">
            Most tools capture one piece. Life Pulse connects the daily pieces into a private weekly review.
          </p>
          <div className="mx-auto grid max-w-2xl gap-3 text-left md:grid-cols-3 md:gap-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text)]">Less scattered</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Tasks, habits, reflection, and manual signals live in one daily rhythm.</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text)]">Weekly clarity</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Daily logs become a review of what moved, what stayed quiet, and what to adjust.</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text)]">Private momentum</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">XP and patterns are private indicators from completed tasks and habits, not a judgment.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t border-[var(--border)] px-5 py-24 text-center md:px-8 md:py-32">
        <h2 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
          Start with one priority today.
        </h2>
        <p className="mx-auto mt-3 mb-8 max-w-md text-base text-[var(--text-secondary)]">
          Set up your life areas in under a minute and begin building your daily rhythm.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-8 py-3 text-base font-medium text-white transition-all hover:bg-[var(--accent-strong)]"
        >
          Create your Life Pulse
        </Link>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Private beta &middot; your feedback shapes what comes next
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] px-5 py-6 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <LifePulseLogo variant="compact" size="sm" showWordmark={true} />
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
