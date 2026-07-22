"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/TextArea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { MetricDefinitionRow } from "@/lib/results/types";
import { validateValueForKind, parseNumeric } from "@/lib/results/calculations";
import { NOTES_MAX } from "@/lib/results/contract";

interface MetricEntryFormProps {
  metric: MetricDefinitionRow;
  onSuccess: (metricId: string) => void;
}

function getLocalDateTimeValue(): string {
  const now = new Date();
  if (!Number.isFinite(now.getTime())) return "";
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function MetricEntryForm({ metric, onSuccess }: MetricEntryFormProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState("");
  const [recordedAt, setRecordedAt] = useState(getLocalDateTimeValue);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateForm(): Record<string, string> {
    const nextErrors: Record<string, string> = {};
    const validation = validateValueForKind(value, metric.value_kind);
    if (!validation.valid) nextErrors.value = validation.error ?? "Enter a valid value";

    const timestamp = new Date(recordedAt).getTime();
    if (!recordedAt || !Number.isFinite(timestamp)) nextErrors.recorded_at = "Enter a valid date and time";
    if (notes.length > NOTES_MAX) nextErrors.notes = `Notes must be ${NOTES_MAX} characters or fewer`;
    return nextErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const nextErrors = validateForm();
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    const normalizedValue = parseNumeric(value);
    if (normalizedValue === null) {
      setErrors({ value: "Enter a valid value" });
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ type: "error", title: "Please sign in to continue." });
        return;
      }

      const { error } = await supabase.from("metric_entries").insert({
        metric_definition_id: metric.id,
        user_id: user.id,
        value: normalizedValue,
        recorded_at: new Date(recordedAt).toISOString(),
        notes: notes.trim() || null,
      });

      if (error) {
        toast({ type: "error", title: error.code === "P0001" ? "New results cannot be recorded for an archived metric" : "Failed to save result" });
        return;
      }

      toast({ type: "success", title: "Result recorded" });
      setValue("");
      setRecordedAt(getLocalDateTimeValue());
      setNotes("");
      onSuccess(metric.id);
    } catch {
      toast({ type: "error", title: "An unexpected error occurred" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6 p-4 sm:p-5 animate-slide-up">
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Record Result</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Manually recorded. Private to your account. No automatic conversion or interpretation.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="value"
            label={`Value (${metric.unit})`}
            value={value}
            onChange={(e) => { setValue(e.target.value); setErrors((prev) => ({ ...prev, value: "" })); }}
            onBlur={() => setErrors((prev) => ({ ...prev, value: validateValueForKind(value, metric.value_kind).error ?? "" }))}
            error={errors.value}
            placeholder="Enter a value"
            type="text"
            disabled={saving}
            required
          />

          <div>
            <label htmlFor="recorded_at" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Date and time</label>
            <input
              id="recorded_at"
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => { setRecordedAt(e.target.value); setErrors((prev) => ({ ...prev, recorded_at: "" })); }}
              aria-invalid={errors.recorded_at ? true : undefined}
              aria-describedby={errors.recorded_at ? "recorded_at-error" : undefined}
              disabled={saving}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none disabled:opacity-40"
            />
            {errors.recorded_at && <p id="recorded_at-error" className="mt-1 text-xs text-[var(--danger)]">{errors.recorded_at}</p>}
          </div>

          <div className="sm:col-span-2">
            <TextArea
              id="notes"
              label="Notes (optional)"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setErrors((prev) => ({ ...prev, notes: "" })); }}
              error={errors.notes}
              placeholder="Context, conditions, or observations"
              maxLength={NOTES_MAX}
              rows={2}
              disabled={saving}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Record Result"}</Button>
        </div>
      </form>
    </Card>
  );
}
