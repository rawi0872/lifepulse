import Link from "next/link";
import { DashboardNav } from "@/components/DashboardNav";
import { REALM_NAMES } from "@lifepulse/domain";

// Realms hub (parity with mobile Realms): Body + Wealth cards.
// Desktop presentation differs; terminology and destinations match.
const REALMS = [
  {
    key: "body",
    name: REALM_NAMES.body,
    description: "Fitness, sleep, health",
    href: "/body",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      </svg>
    ),
    tileClass: "bg-[var(--realm-body-soft)] text-[var(--realm-body)] ring-[var(--realm-body-border)]",
  },
  {
    key: "wealth",
    name: REALM_NAMES.wealth,
    description: "Accounts, net worth, cash flow",
    href: "/wealth",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125C16.5 3.504 17.004 3 17.625 3h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    tileClass: "bg-[var(--realm-wealth-soft)] text-[var(--realm-wealth)] ring-[var(--realm-wealth-border)]",
  },
] as const;

export default function RealmsPage() {
  return (
    <DashboardNav>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Life areas</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">{REALM_NAMES.realms}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Choose a realm to focus your attention.</p>

        <div className="mt-6 flex flex-col gap-3">
          {REALMS.map((realm) => (
            <Link
              key={realm.key}
              href={realm.href}
              prefetch
              className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-colors hover:border-[var(--border-strong)]"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${realm.tileClass}`}>
                {realm.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-[var(--text)]">{realm.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{realm.description}</span>
              </span>
              <span className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
          <p className="text-sm font-semibold text-[var(--text-muted)]">More realms coming</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">Mind · Work · Relationships · Growth — not yet active</p>
        </div>
      </div>
    </DashboardNav>
  );
}
