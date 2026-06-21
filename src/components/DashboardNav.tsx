"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifePulseLogo } from "@/components/LifePulseLogo";

const navGroups = [
  {
    label: null,
    items: [
      {
        label: "Today",
        href: "/today",
        icon: (
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Build",
    items: [
      {
        label: "Habits",
        href: "/habits",
        icon: (
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        label: "Projects",
        href: "/projects",
        icon: (
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
      },
      {
        label: "Tasks",
        href: "/tasks",
        icon: (
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        label: "Finance",
        href: "/finance",
        icon: (
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Reflect",
    items: [
      {
        label: "Journal",
        href: "/journal",
        icon: (
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Review",
    items: [
      {
        label: "Insights",
        href: "/insights",
        icon: (
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
];

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] md:flex">
        <Link href="/today" className="mx-4 mt-5 mb-7 flex items-center gap-2.5 group">
          <div className="relative transition-all duration-200 group-hover:opacity-80">
            <LifePulseLogo variant="mark" size="sm" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-[var(--text)]">
              Life Pulse
            </span>
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Personal OS
            </span>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-5 px-2 pb-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label ?? "primary"}>
              {group.label && (
                <p className="mb-1 px-2.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                        active
                          ? "text-[var(--text)] bg-[var(--accent-ghost)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className={`transition-colors duration-200 ${
                        active
                          ? "text-[var(--accent)]"
                          : "text-[var(--text-muted)]"
                      }`}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] px-2 py-3">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-200 ${
              pathname === "/settings"
                ? "text-[var(--text)] bg-[var(--accent-ghost)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.03]"
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/[0.06] text-[var(--text-muted)]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-[var(--text)]">Settings</span>
              <span className="text-[10px] text-[var(--text-muted)]">Preferences &amp; profile</span>
            </div>
          </Link>
        </div>
      </aside>

      <main className="min-h-screen md:ml-56 pb-20 md:pb-0">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-1 md:hidden">
        <div className="flex items-center justify-around">
          {navGroups.flatMap((g) => g.items).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[10px] font-medium transition-all duration-200 ${
                  active
                    ? "text-[var(--accent)] bg-[var(--accent-ghost)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <span className={`transition-colors duration-200 ${
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                }`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
