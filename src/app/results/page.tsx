"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { CreateMetricForm } from "@/components/results/CreateMetricForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import type { MetricDefinitionRow, MetricEntryRow, ResultDomain } from "@/lib/results/types";
import { formatCadenceLabel, formatDateShort, formatDomainLabel, formatValue } from "@/lib/results/format";
import { getLatestEntry } from "@/lib/results/calculations";

const ENTRY_CONTEXT_LIMIT = 1000;

const DOMAIN_FILTERS: Array<{ value: ResultDomain | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "body", label: "Body" },
  { value: "mind", label: "Mind" },
  { value: "finance", label: "Finance" },
  { value: "business", label: "Business" },
  { value: "learning", label: "Learning" },
  { value: "skills", label: "Skills" },
  { value: "passions", label: "Passions" },
  { value: "goals", label: "Goals" },
  { value: "custom", label: "Custom" },
];

type MetricStatusFilter = "active" | "archived";

function ResultsContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [supabase] = useState(() => createClient());
  const requestSeq = useRef(0);
  const statusFilterRef = useRef<MetricStatusFilter>("active");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MetricStatusFilter>("active");
  const [activeDomain, setActiveDomain] = useState<ResultDomain | "all">("all");
  const [metrics, setMetrics] = useState<MetricDefinitionRow[]>([]);
  const [entries, setEntries] = useState<MetricEntryRow[]>([]);

  const loadResults = useCallback(async (requestedStatus: MetricStatusFilter = statusFilter) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setLoadError(null);
    setMetrics([]);
    setEntries([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (seq !== requestSeq.current) return;
      if (!user) {
        setMetrics([]);
        setEntries([]);
        setActiveDomain("all");
        setStatusFilter("active");
        setShowCreateForm(false);
        setLoadError(null);
        router.replace("/login");
        return;
      }

      const metricsRes = await supabase
        .from("metric_definitions")
        .select("id, user_id, domain, name, description, value_kind, unit, baseline_value, target_value, target_direction, cadence, archived, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("archived", requestedStatus === "archived")
        .order("created_at", { ascending: false });

      if (seq !== requestSeq.current) return;
      if (metricsRes.error) throw metricsRes.error;

      const loadedMetrics = (metricsRes.data ?? []) as MetricDefinitionRow[];
      setMetrics(loadedMetrics);

      if (loadedMetrics.length === 0) {
        setEntries([]);
        return;
      }

      const metricIds = loadedMetrics.map((metric) => metric.id);
      const entriesRes = await supabase
        .from("metric_entries")
        .select("id, user_id, metric_definition_id, value, recorded_at, notes, created_at")
        .eq("user_id", user.id)
        .in("metric_definition_id", metricIds)
        .order("recorded_at", { ascending: false })
        .limit(ENTRY_CONTEXT_LIMIT);

      if (seq !== requestSeq.current) return;
      if (entriesRes.error) throw entriesRes.error;
      setEntries((entriesRes.data ?? []) as MetricEntryRow[]);
    } catch {
      if (seq !== requestSeq.current) return;
      setLoadError("Results could not be loaded right now.");
      toast({ type: "error", title: "Failed to load results." });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [router, statusFilter, supabase, toast]);

  useEffect(() => {
    statusFilterRef.current = statusFilter;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadResults();
  }, [loadResults, statusFilter]);

  const entriesByMetric = useMemo(() => {
    const grouped: Record<string, MetricEntryRow[]> = {};
    entries.forEach((entry) => {
      grouped[entry.metric_definition_id] = grouped[entry.metric_definition_id] ?? [];
      grouped[entry.metric_definition_id].push(entry);
    });
    return grouped;
  }, [entries]);

  const visibleMetrics = useMemo(() => {
    if (activeDomain === "all") return metrics;
    return metrics.filter((metric) => metric.domain === activeDomain);
  }, [activeDomain, metrics]);

  return (
    <div className="animate-fade-in overflow-x-hidden px-4 py-5 md:p-6">
      <div className="mx-auto max-w-5xl min-w-0">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-[var(--text)]">Results</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              Track measurable outcomes over time. Actions show what you did; results show what changed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <span>Manually recorded</span>
              <span>Private to your account</span>
              <span>No automatic conversion or interpretation</span>
            </div>
          </div>
          {statusFilter === "active" && (
            <Button onClick={() => setShowCreateForm((current) => !current)}>
              {showCreateForm ? "Close" : "Create Metric"}
            </Button>
          )}
        </div>

        {showCreateForm && statusFilter === "active" && (
          <CreateMetricForm
            onCancel={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              if (statusFilterRef.current === "active") {
                void loadResults("active");
              }
            }}
          />
        )}

        <div className="mb-3 flex gap-1 rounded-xl bg-[var(--surface-soft)] p-1">
          {([
            ["active", "Active"],
            ["archived", "Archived"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { statusFilterRef.current = value; setStatusFilter(value); setShowCreateForm(false); }}
              className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                statusFilter === value ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-soft)] p-1 [-webkit-overflow-scrolling:touch]">
          {DOMAIN_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveDomain(filter.value)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                activeDomain === filter.value
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading && <ResultsLoadingState />}

        {!loading && loadError && (
          <Card className="p-5 text-sm text-[var(--text-muted)]">
            {loadError} <button type="button" onClick={() => void loadResults()} className="text-[var(--accent)] underline">Try again</button>
          </Card>
        )}

        {!loading && !loadError && metrics.length === 0 && (
          <Card className="p-6 text-center">
            <h2 className="text-base font-semibold text-[var(--text)]">{statusFilter === "archived" ? "No archived metrics." : "No results metrics yet"}</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {statusFilter === "archived" ? "Archived metrics will appear here when available." : "Create a manual metric to start tracking outcomes over time."}
            </p>
          </Card>
        )}

        {!loading && !loadError && metrics.length > 0 && visibleMetrics.length === 0 && (
          <Card className="p-5 text-sm text-[var(--text-muted)]">
            No {statusFilter === "archived" ? "archived" : "active"} metrics match this domain filter.
          </Card>
        )}

        {!loading && !loadError && visibleMetrics.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleMetrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} entries={entriesByMetric[metric.id] ?? []} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ metric, entries }: { metric: MetricDefinitionRow; entries: MetricEntryRow[] }) {
  const latest = getLatestEntry(entries);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold text-[var(--text)]">{metric.name}</h2>
          <p className="mt-1 break-words text-xs text-[var(--text-muted)]">
            {formatDomainLabel(metric.domain)} · {metric.unit} · {formatCadenceLabel(metric.cadence)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {metric.archived ? "Archived" : "Manual"}
        </span>
      </div>

      {metric.description && <p className="mt-3 text-sm text-[var(--text-secondary)]">{metric.description}</p>}

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        {latest ? (
          <>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">Latest recorded value</p>
            <p className="mt-1 break-words text-xl font-semibold text-[var(--text)]">
              {formatValue(latest.value, metric.unit, metric.value_kind)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Recorded {formatDateShort(latest.recorded_at)}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--text)]">No results recorded yet</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Based on manually recorded results.</p>
          </>
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
        {metric.target_value !== null && (
          <p>Target: {formatValue(metric.target_value, metric.unit, metric.value_kind)}</p>
        )}
        <p>{entries.length < 2 ? "More entries are needed for a trend." : "Based on manually recorded results."}</p>
        {metric.value_kind === "currency" && <p>No currency conversion is applied.</p>}
      </div>
      <Link href={`/results/${metric.id}`} aria-label={`View details for ${metric.name}`} className="mt-4 inline-flex min-h-10 items-center rounded-lg text-sm font-medium text-[var(--accent)] hover:underline">
        View details
      </Link>
    </Card>
  );
}

function ResultsLoadingState() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-48 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      ))}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <DashboardNav>
      <ResultsContent />
    </DashboardNav>
  );
}
