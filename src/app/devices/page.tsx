"use client";

import Link from "next/link";
import { DashboardNav } from "@/components/DashboardNav";
import { SectionHeader } from "@/components/ui/section-header";
import { PulseCard } from "@/components/ui/pulse-card";

function DevicesContent() {
  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-[var(--text)]">Device Pulse</h1>
              <p className="text-[10px] text-[var(--text-muted)]">Connect your wearables and health data</p>
            </div>
          </div>
        </div>

        {/* Coming soon notice */}
        <PulseCard title="Coming Soon" accent="accent" description="Device sync is not available yet">
          <div className="px-4 py-4">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Device Pulse will connect your wearable devices and health platforms to bring passive sensor data into Body Pulse and Mind Pulse.
              Manual tracking via Body and Mind forms already works today.
            </p>
          </div>
        </PulseCard>

        {/* Manual-first foundation */}
        <div className="mt-4">
          <PulseCard title="Manual-First Foundation" accent="accent" description="Body and Mind entry forms are ready">
            <div className="px-4 py-4">
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                You can already log sleep, energy, steps, workouts, weight, heart rate, and recovery manually on the Body Pulse page,
                and mood, stress, focus, clarity, and motivation on the Mind Pulse page. Device sync will augment — not replace — manual entry.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/body"
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[10px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  Log Body Pulse &rarr;
                </Link>
                <Link
                  href="/mind"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[10px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Log Mind Pulse &rarr;
                </Link>
              </div>
            </div>
          </PulseCard>
        </div>

        {/* Future providers */}
        <div className="mt-6">
          <SectionHeader label="Future Providers" accent="accent" />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { name: "Apple Health", desc: "Sleep, steps, HR, workouts, recovery" },
              { name: "Android Health Connect", desc: "Sleep, steps, HR, workouts, recovery" },
              { name: "Oura / Smart Rings", desc: "Sleep, HRV, readiness, activity" },
              { name: "Smartwatches", desc: "Heart rate, steps, workouts, stress" },
              { name: "Generic Wearable Import", desc: "CSV or manual device upload" },
            ].map((p) => (
              <div
                key={p.name}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition-all hover:border-[var(--border-strong)]"
              >
                <p className="text-xs font-medium text-[var(--text)]">{p.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Planned data types */}
        <div className="mt-6">
          <SectionHeader label="Planned Data Types" accent="accent" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              { label: "Sleep", icon: "moon" },
              { label: "Steps", icon: "walk" },
              { label: "Heart Rate", icon: "heart" },
              { label: "Workouts", icon: "run" },
              { label: "Recovery / HRV", icon: "refresh" },
              { label: "Stress / Focus", icon: "brain" },
            ].map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] text-[var(--text-muted)]"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Privacy & Safety */}
        <div className="mt-6">
          <PulseCard title="Privacy & Safety" accent="warning" description="Your health data stays yours">
            <div className="px-4 py-4">
              <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  User-controlled connections — no automatic sync
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  No background wearable access yet
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  No device is connected yet
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Health data sync will require explicit permission
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Sensitive health data will be stored securely with server-side token management
                </li>
              </ul>
            </div>
          </PulseCard>
        </div>

        {/* Status notice */}
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-muted)]">
          No devices connected. No health data sync active. Check back as the architecture evolves.
        </div>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  return (
    <DashboardNav>
      <DevicesContent />
    </DashboardNav>
  );
}
