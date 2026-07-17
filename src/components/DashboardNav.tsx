"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifePulseLogo } from "@/components/LifePulseLogo";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {children}
    </svg>
  );
}

const icons = {
  today: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></NavIcon>,
  tasks: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></NavIcon>,
  habits: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></NavIcon>,
  journal: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></NavIcon>,
  goals: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58" /></NavIcon>,
  projects: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></NavIcon>,
  body: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /></NavIcon>,
  mind: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128z" /></NavIcon>,
  finance: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182" /></NavIcon>,
  passions: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442-4.204 3.602 1.285 5.385-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54l1.285-5.385-4.204-3.602 5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></NavIcon>,
  knowledge: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></NavIcon>,
  review: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" /></NavIcon>,
  insights: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" /></NavIcon>,
  coach: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></NavIcon>,
  devices: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></NavIcon>,
  settings: <NavIcon><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></NavIcon>,
};

const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { label: "Today", href: "/today", icon: icons.today },
      { label: "Tasks", href: "/tasks", icon: icons.tasks },
      { label: "Habits", href: "/habits", icon: icons.habits },
      { label: "Journal", href: "/journal", icon: icons.journal },
    ],
  },
  {
    label: "Build later",
    items: [
      { label: "Goals", href: "/goals", icon: icons.goals },
      { label: "Projects", href: "/projects", icon: icons.projects },
    ],
  },
  {
    label: "Track later",
    items: [
      { label: "Body", href: "/body", icon: icons.body },
      { label: "Mind", href: "/mind", icon: icons.mind },
      { label: "Finance", href: "/finance", icon: icons.finance },
      { label: "Passions", href: "/passions", icon: icons.passions },
      { label: "Knowledge", href: "/knowledge", icon: icons.knowledge },
    ],
  },
  {
    label: "Review later",
    items: [
      { label: "Weekly Review", href: "/weekly-review", icon: icons.review },
      { label: "Insights", href: "/insights", icon: icons.insights },
      { label: "Coach", href: "/coach", icon: icons.coach },
    ],
  },
  {
    label: "Preview",
    items: [
      { label: "Devices", href: "/devices", icon: icons.devices, badge: "Preview" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: icons.settings },
    ],
  },
];

const mobilePrimaryItems = navGroups[0].items;

const mobileMoreGroups = navGroups;

const mobileMoreItems = navGroups.slice(1).flatMap((group) => group.items);

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-all duration-200 md:min-h-0 ${
        active
          ? "border-white/[0.08] bg-[var(--surface)] text-[var(--text)] shadow-sm shadow-black/10"
          : "border-transparent text-[var(--text-muted)] hover:border-white/[0.04] hover:bg-white/[0.025] hover:text-[var(--text-secondary)]"
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--accent-strong)]" />}
      <span className={`shrink-0 transition-colors duration-200 ${active ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}`}>
        {item.icon}
      </span>
      <span className="min-w-0 truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,247,251,0.018),rgba(244,247,251,0)),var(--bg-elevated)] md:flex">
        <Link href="/today" className="group mx-4 mt-5 mb-7 flex items-center gap-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-white/[0.02]">
          <div className="relative transition-all duration-200 group-hover:opacity-80">
            <LifePulseLogo variant="mark" size="sm" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-[var(--text)]">Life Pulse</span>
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">Personal OS</span>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2.5 pb-2">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? "opacity-80 transition-opacity hover:opacity-100" : undefined}>
              <p className="mb-1.5 px-2.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] opacity-80">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => <NavLink key={item.href} item={item} active={isActive(item.href)} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] px-2 pt-2 pb-3">
          <FeedbackButton />
        </div>
      </aside>

      <main className="min-h-screen pb-20 md:ml-56 md:pb-0">
        {children}
      </main>

      <nav className="fixed right-0 bottom-0 left-0 z-50 border-t border-white/[0.08] bg-[var(--bg-elevated)]/95 px-1.5 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="flex items-center justify-around py-1">
          {mobilePrimaryItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[10px] font-medium transition-all duration-200 ${
                  active ? "border-white/[0.08] bg-[var(--surface)] text-[var(--text)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <span className={active ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={`flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[10px] font-medium transition-all duration-200 ${
              moreOpen || mobileMoreItems.some((item) => isActive(item.href))
                ? "border-white/[0.08] bg-[var(--surface)] text-[var(--text)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[55] md:hidden">
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="fixed right-0 bottom-0 left-0 z-10 max-h-[75vh] overflow-y-auto rounded-t-3xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(244,247,251,0.03),rgba(244,247,251,0)),var(--bg-elevated)] p-4 pb-8 shadow-2xl shadow-black/40 animate-slide-up">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-[var(--text)]">More</h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Deeper tools are here when you need them.</p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                aria-label="Close more menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {mobileMoreGroups.map((group) => {
                if (group.items.length === 0) return null;
                return (
                  <section key={group.label}>
                    <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] opacity-80">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.items.map((item) => <NavLink key={item.href} item={item} active={isActive(item.href)} onClick={() => setMoreOpen(false)} />)}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">Private beta</p>
              <FeedbackButton variant="cta" label="Send feedback" description="Report a bug or confusing moment" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
