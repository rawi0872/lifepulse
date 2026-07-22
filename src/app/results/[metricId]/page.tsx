"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { EditMetricForm } from "@/components/results/EditMetricForm";
import { MetricEntryForm } from "@/components/results/MetricEntryForm";
import { MetricHistory } from "@/components/results/MetricHistory";
import { MetricSparkline } from "@/components/results/MetricSparkline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import type { MetricDefinitionRow, MetricEntryRow } from "@/lib/results/types";
import { formatCadenceLabel, formatDateShort, formatDomainLabel, formatTargetDirectionLabel, formatValue, formatValueKindLabel } from "@/lib/results/format";
import { formatChangeLabel, getAbsoluteChange, getLatestEntry, getPreviousEntry } from "@/lib/results/calculations";

const ENTRY_DETAIL_LIMIT = 200;

function ResultsMetricDetailContent() {
  const params = useParams<{ metricId?: string }>();
  const metricId = typeof params.metricId === "string" ? params.metricId : "";
  const router = useRouter();
  const { toast } = useToast();
  const [supabase] = useState(() => createClient());
  const requestSeq = useRef(0);
  const activeMetricIdRef = useRef(metricId);
  const mountedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricDefinitionRow | null>(null);
  const [entries, setEntries] = useState<MetricEntryRow[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [updatingArchive, setUpdatingArchive] = useState(false);

  const clearLoadedState = useCallback(() => {
    setMetric(null);
    setEntries([]);
    setLoadError(null);
    setShowEditForm(false);
    setConfirmingArchive(false);
  }, []);

  const loadMetric = useCallback(async () => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    clearLoadedState();
    setLoading(true);

    if (!metricId) {
      setLoadError("This result metric could not be found.");
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (seq !== requestSeq.current) return;
      if (!user) {
        clearLoadedState();
        router.replace("/login");
        return;
      }

      const metricRes = await supabase
        .from("metric_definitions")
        .select("id, user_id, domain, name, description, value_kind, unit, baseline_value, target_value, target_direction, cadence, archived, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("id", metricId)
        .maybeSingle();

      if (seq !== requestSeq.current) return;
      if (metricRes.error) throw metricRes.error;
      if (!metricRes.data) {
        setLoadError("This result metric could not be found.");
        setMetric(null);
        setEntries([]);
        return;
      }

      const entriesRes = await supabase
        .from("metric_entries")
        .select("id, user_id, metric_definition_id, value, recorded_at, notes, created_at")
        .eq("user_id", user.id)
        .eq("metric_definition_id", metricId)
        .order("recorded_at", { ascending: false })
        .limit(ENTRY_DETAIL_LIMIT);

      if (seq !== requestSeq.current) return;
      if (entriesRes.error) throw entriesRes.error;

      setMetric(metricRes.data as MetricDefinitionRow);
      setEntries((entriesRes.data ?? []) as MetricEntryRow[]);
      setLoadError(null);
    } catch {
      if (seq !== requestSeq.current) return;
      setMetric(null);
      setEntries([]);
      setLoadError("Results could not be loaded right now.");
      toast({ type: "error", title: "Failed to load result details." });
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [clearLoadedState, metricId, router, supabase, toast]);

  useEffect(() => {
    mountedRef.current = true;
    activeMetricIdRef.current = metricId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMetric();
    return () => {
      mountedRef.current = false;
      activeMetricIdRef.current = "";
      requestSeq.current += 1;
    };
  }, [loadMetric, metricId]);

  const latest = useMemo(() => getLatestEntry(entries), [entries]);
  const previous = useMemo(() => getPreviousEntry(entries), [entries]);
  const absoluteChange = useMemo(() => getAbsoluteChange(latest, previous), [latest, previous]);
  const handleEntrySuccess = useCallback((completedMetricId: string) => {
    if (completedMetricId === activeMetricIdRef.current) {
      void loadMetric();
    }
  }, [loadMetric]);
  const handleMetricUpdated = useCallback((updatedMetricId: string) => {
    if (updatedMetricId === activeMetricIdRef.current) {
      setShowEditForm(false);
      void loadMetric();
    }
  }, [loadMetric]);

  const updateArchiveState = useCallback(async (targetMetricId: string, archived: boolean) => {
    if (updatingArchive) return;
    setUpdatingArchive(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        clearLoadedState();
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("metric_definitions")
        .update({ archived })
        .eq("id", targetMetricId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        if (!mountedRef.current) return;
        toast({ type: "error", title: archived ? "Failed to archive metric" : "Failed to restore metric" });
        return;
      }

      if (!data) {
        if (!mountedRef.current) return;
        toast({ type: "error", title: "This result metric could not be found." });
        void loadMetric();
        return;
      }

      if (!mountedRef.current || targetMetricId !== activeMetricIdRef.current) return;
      toast({ type: "success", title: archived ? "Metric archived" : "Metric restored" });
      setConfirmingArchive(false);
      void loadMetric();
    } catch {
      if (!mountedRef.current) return;
      toast({ type: "error", title: "An unexpected error occurred" });
    } finally {
      if (mountedRef.current) setUpdatingArchive(false);
    }
  }, [clearLoadedState, loadMetric, router, supabase, toast, updatingArchive]);

  return (
    <div className="animate-fade-in overflow-x-hidden px-4 py-5 md:p-6">
      <div className="mx-auto max-w-5xl min-w-0">
        <Link href="/results" className="mb-4 inline-flex min-h-10 items-center text-sm font-medium text-[var(--accent)] hover:underline">
          Back to Results
        </Link>

        {loading && <DetailLoadingState />}

        {!loading && loadError && (
          <Card className="p-5 text-sm text-[var(--text-muted)]">{loadError}</Card>
        )}

        {!loading && !loadError && metric && (
          <>
            <div className="mb-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="break-words text-2xl font-bold text-[var(--text)]">{metric.name}</h1>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {formatDomainLabel(metric.domain)} · {formatValueKindLabel(metric.value_kind)} · {metric.unit} · {formatCadenceLabel(metric.cadence)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {metric.archived && <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">Archived metric</span>}
                  <Button type="button" variant="secondary" size="sm" onClick={() => { setShowEditForm((current) => !current); setConfirmingArchive(false); }} disabled={updatingArchive}>
                    {showEditForm ? "Close edit" : "Edit metric"}
                  </Button>
                </div>
              </div>
              {metric.description && <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)]">{metric.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <span>Manually recorded</span>
                <span>Private to your account</span>
                <span>No automatic conversion or interpretation</span>
              </div>
            </div>

            {showEditForm && <EditMetricForm metric={metric} onSuccess={handleMetricUpdated} onCancel={() => setShowEditForm(false)} />}

            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Latest recorded value" value={latest ? formatValue(latest.value, metric.unit, metric.value_kind) : "No results recorded yet"} detail={latest ? `Recorded ${formatDateShort(latest.recorded_at)}` : "Based on manually recorded results"} />
              <SummaryCard label="Previous recorded value" value={previous ? formatValue(previous.value, metric.unit, metric.value_kind) : "More entries are needed for comparison"} detail={previous ? `Recorded ${formatDateShort(previous.recorded_at)}` : ""} />
              <SummaryCard label="Factual difference" value={formatChangeLabel(absoluteChange)} detail="Latest minus previous" />
              <SummaryCard label="Loaded history" value={`${entries.length}`} detail={`Showing the latest ${ENTRY_DETAIL_LIMIT} entries`} />
            </div>

            <Card className="mb-6 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-[var(--text)]">Metric context</h2>
              <div className="mt-3 grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
                <p>Baseline: {metric.baseline_value !== null ? formatValue(metric.baseline_value, metric.unit, metric.value_kind) : "Not set"}</p>
                <p>Target: {metric.target_value !== null ? formatValue(metric.target_value, metric.unit, metric.value_kind) : "Not set"}</p>
                <p>Target direction: {formatTargetDirectionLabel(metric.target_direction)}</p>
                {metric.value_kind === "currency" && <p>No currency conversion is applied.</p>}
              </div>
            </Card>

            <Card className="mb-6 p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Loaded entries sparkline</h2>
              <MetricSparkline entries={entries} />
              <p className="mt-2 text-xs text-[var(--text-muted)]">Based on loaded entries only.</p>
            </Card>

            {metric.archived ? (
              <Card className="mb-6 p-4 sm:p-5">
                <p className="text-sm text-[var(--text-muted)]">New results cannot be recorded for an archived metric.</p>
                <div className="mt-4 flex justify-end">
                  <Button type="button" variant="secondary" onClick={() => updateArchiveState(metric.id, false)} disabled={updatingArchive || showEditForm}>
                    {updatingArchive ? "Restoring..." : "Restore metric"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">Move back to active results.</p>
              </Card>
            ) : (
              <>
                <MetricEntryForm metric={metric} onSuccess={handleEntrySuccess} />
                <Card className="mb-6 p-4 sm:p-5">
                  <h2 className="text-sm font-semibold text-[var(--text)]">Archive metric</h2>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">Archived metrics remain visible in archived results. Existing history is preserved, but new results cannot be recorded.</p>
                  {confirmingArchive ? (
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => setConfirmingArchive(false)} disabled={updatingArchive}>Cancel</Button>
                      <Button type="button" variant="secondary" onClick={() => updateArchiveState(metric.id, true)} disabled={updatingArchive}>{updatingArchive ? "Archiving..." : "Archive metric"}</Button>
                    </div>
                  ) : (
                    <div className="mt-4 flex justify-end">
                      <Button type="button" variant="secondary" onClick={() => { setConfirmingArchive(true); setShowEditForm(false); }} disabled={showEditForm}>Archive metric</Button>
                    </div>
                  )}
                </Card>
              </>
            )}

            <MetricHistory entries={entries} metric={metric} limit={ENTRY_DETAIL_LIMIT} />
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-[var(--text)]">{value}</p>
      {detail && <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>}
    </Card>
  );
}

function DetailLoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />)}
      </div>
      <div className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
    </div>
  );
}

export default function ResultsMetricDetailPage() {
  return (
    <DashboardNav>
      <ResultsMetricDetailContent />
    </DashboardNav>
  );
}
