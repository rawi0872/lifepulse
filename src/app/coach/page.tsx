"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { buildDeterministicNextronResponse, type NextronCoachResponse } from "@/lib/nextron/coach";
import { getDefaultNextronPermissions, NEXTRON_CONTEXT_PERMISSIONS, NEXTRON_UNAVAILABLE_CONTEXT, type NextronContextDomain, type NextronPermissionState } from "@/lib/nextron/context";
import { buildNextronEvidencePacket, type NextronEvidencePacket } from "@/lib/nextron/evidence";
import { runNextronProviderOrFallback } from "@/lib/nextron/provider";

export default function CoachPage() {
  return (
    <DashboardNav>
      <NextronContent />
    </DashboardNav>
  );
}

function NextronContent() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [permissions, setPermissions] = useState<NextronPermissionState>(() => getDefaultNextronPermissions());
  const [packet, setPacket] = useState<NextronEvidencePacket | null>(null);
  const [response, setResponse] = useState<NextronCoachResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPacket(null);
      setResponse(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          router.replace("/login");
          return;
        }

        const nextPacket = await buildNextronEvidencePacket(supabase, user.id, permissions);
        if (cancelled) return;
        const nextResponse = await runNextronProviderOrFallback(
          { evidence: nextPacket },
          () => buildDeterministicNextronResponse(nextPacket),
        );
        if (cancelled) return;
        setPacket(nextPacket);
        setResponse(nextResponse);
      } catch {
        if (!cancelled) setError("NEXTRON could not load the permitted context right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [permissions, router, supabase]);

  function setPermission(domain: NextronContextDomain, allowed: boolean) {
    setPermissions((current) => ({ ...current, [domain]: allowed ? "allowed" : "denied" }));
  }

  return (
    <div className="mx-auto max-w-3xl overflow-x-hidden px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
      <header className="mb-6 min-w-0">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">Life Pulse AI Coach</p>
        <h1 className="break-words text-3xl font-bold tracking-tight text-[var(--text)]">NEXTRON</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          NEXTRON uses permitted Life Pulse evidence, separates facts from interpretation, and recommends one practical next action. This is an early private-beta foundation: no external AI, no autonomous actions, and no medical, mental-health, legal, or financial professional replacement.
        </p>
      </header>

      <section aria-labelledby="nextron-response" className="mb-6">
        <Card className="border-[var(--accent)]/25 bg-[var(--surface-soft)]/80 p-4 sm:p-5">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="nextron-response" className="text-base font-semibold text-[var(--text)]">Current coaching response</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">One deterministic response from permitted evidence.</p>
            </div>
            {response && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {response.priority}
              </span>
            )}
          </div>

          {loading && <p className="text-sm text-[var(--text-muted)]">Loading permitted context...</p>}
          {!loading && error && <p className="text-sm text-[var(--warning)]">{error}</p>}
          {!loading && !error && response && <ResponseView response={response} />}
        </Card>
      </section>

      <section aria-labelledby="nextron-facts" className="mb-6">
        <h2 id="nextron-facts" className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Facts used</h2>
        <Card variant="subtle" className="p-4">
          {response ? (
            <ul className="space-y-2">
              {response.facts.map((item, index) => (
                <li key={`${item.category}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{item.category}</p>
                  <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{item.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Facts will appear after permitted context loads.</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="nextron-context" className="mb-6">
        <h2 id="nextron-context" className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Context permissions</h2>
        <Card className="p-4 sm:p-5">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
            These permissions are local UI state for this private-beta phase and are not persisted. Text-heavy reflection areas are off by default.
          </p>
          <div className="space-y-3">
            {NEXTRON_CONTEXT_PERMISSIONS.map((permission) => {
              const checked = permissions[permission.domain] === "allowed";
              return (
                <label key={permission.domain} className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setPermission(permission.domain, event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text)]">
                      {permission.label}
                      {permission.textHeavy && <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--warning)]">text</span>}
                    </span>
                    <span className="mt-1 block break-words text-xs leading-relaxed text-[var(--text-muted)]">{permission.description}</span>
                    <span className="mt-1 block text-[10px] text-[var(--text-muted)]">Current status: {checked ? "allowed" : "not loaded"}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      </section>

      <section aria-labelledby="nextron-access" className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card variant="subtle" className="p-4">
          <h2 id="nextron-access" className="text-sm font-semibold text-[var(--text)]">What NEXTRON can currently access</h2>
          <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
            {packet ? Object.entries(packet.permissionSummary).filter(([, status]) => status === "available").map(([domain]) => (
              <li key={domain} className="break-words">{domain}</li>
            )) : <li>Permitted context is loading.</li>}
          </ul>
        </Card>
        <Card variant="subtle" className="p-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">What NEXTRON cannot currently access</h2>
          <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
            {NEXTRON_UNAVAILABLE_CONTEXT.map((item) => <li key={item} className="break-words">{item}</li>)}
            {packet && Object.entries(packet.permissionSummary).filter(([, status]) => status === "permission_denied").map(([domain]) => (
              <li key={domain} className="break-words">{domain} is not loaded by current permission.</li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="nextron-boundary" className="mb-6">
        <Card variant="subtle" className="p-4">
          <h2 id="nextron-boundary" className="text-sm font-semibold text-[var(--text)]">Future AI boundary</h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
            A provider interface now exists for a future structured AI response, but this phase makes no API request, requires no key, sends no data externally, and falls back to deterministic coaching if a provider is not configured.
          </p>
        </Card>
      </section>

      <p className="text-center text-[10px] leading-relaxed text-[var(--text-muted)]">
        NEXTRON does not diagnose, provide therapy, give legal or financial advice, infer hidden traits, claim certainty, or mutate Life Pulse data. Suggested actions are optional and user-controlled.
      </p>
    </div>
  );
}

function ResponseView({ response }: { response: NextronCoachResponse }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Interpretation</p>
        <p className="mt-1 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{response.interpretation}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Suggested next action</p>
        <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{response.nextAction.rationale}</p>
        <Link href={response.nextAction.href} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          {response.nextAction.label}
        </Link>
      </div>
    </div>
  );
}
