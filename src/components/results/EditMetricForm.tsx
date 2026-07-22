"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/hooks/use-toast";
import { validateValueForKind } from "@/lib/results/calculations";
import { DESCRIPTION_MAX, NAME_MAX, UNIT_MAX } from "@/lib/results/contract";
import { getCadenceOptions, getDomainOptions, getTargetDirectionOptions, getValueKindOptions } from "@/lib/results/format";
import type { MetricDefinitionInput, MetricDefinitionRow, ResultCadence, ResultDomain, ResultTargetDirection, ResultValueKind } from "@/lib/results/types";

interface EditMetricFormProps {
  metric: MetricDefinitionRow;
  onSuccess: (metricId: string) => void;
  onCancel: () => void;
}

export function EditMetricForm({ metric, onSuccess, onCancel }: EditMetricFormProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const mountedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    domain: metric.domain,
    name: metric.name,
    description: metric.description ?? "",
    value_kind: metric.value_kind,
    unit: metric.unit,
    baseline_value: metric.baseline_value ?? "",
    target_value: metric.target_value ?? "",
    target_direction: metric.target_direction,
    cadence: metric.cadence,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function validateField(name: string, value: string): string | null {
    switch (name) {
      case "name":
        if (!value.trim()) return "Name is required";
        if (value.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer`;
        break;
      case "unit":
        if (!value.trim()) return "Unit is required";
        if (value.length > UNIT_MAX) return `Unit must be ${UNIT_MAX} characters or fewer`;
        break;
      case "description":
        if (value.length > DESCRIPTION_MAX) return `Description must be ${DESCRIPTION_MAX} characters or fewer`;
        break;
      case "baseline_value":
      case "target_value":
        if (value.trim() !== "") {
          const validation = validateValueForKind(value, formData.value_kind as ResultValueKind);
          if (!validation.valid) return validation.error ?? "Enter a valid value";
        }
        break;
    }
    return null;
  }

  function handleChange(name: string, value: string) {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) ?? "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const nextErrors: Record<string, string> = {};
    Object.entries(formData).forEach(([key, value]) => {
      const error = validateField(key, String(value));
      if (error) nextErrors[key] = error;
    });

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      const firstInvalidField = Object.keys(nextErrors).find((key) => nextErrors[key]);
      if (firstInvalidField) {
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#edit-${firstInvalidField}`)?.focus());
      }
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

      const payload: MetricDefinitionInput = {
        domain: formData.domain as ResultDomain,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        value_kind: formData.value_kind as ResultValueKind,
        unit: formData.unit.trim(),
        baseline_value: String(formData.baseline_value ?? "").trim() || null,
        target_value: String(formData.target_value ?? "").trim() || null,
        target_direction: formData.target_direction as ResultTargetDirection,
        cadence: formData.cadence as ResultCadence,
      };

      const { data, error } = await supabase
        .from("metric_definitions")
        .update(payload)
        .eq("id", metric.id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        if (!mountedRef.current) return;
        toast({ type: "error", title: error.code === "23505" ? "A metric with this name already exists in this domain" : "Failed to update metric" });
        return;
      }

      if (!data) {
        if (!mountedRef.current) return;
        toast({ type: "error", title: "This result metric could not be found." });
        return;
      }

      if (!mountedRef.current) return;
      toast({ type: "success", title: "Metric updated" });
      onSuccess(metric.id);
    } catch {
      if (!mountedRef.current) return;
      toast({ type: "error", title: "An unexpected error occurred" });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  const changesValueShape = formData.value_kind !== metric.value_kind || formData.unit !== metric.unit;

  return (
    <Card className="mb-6 p-4 sm:p-5 animate-slide-up">
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Edit metric</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        </div>

        {changesValueShape && <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--text-muted)]">Existing recorded values will remain unchanged.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Select id="edit-domain" label="Domain" value={formData.domain} onChange={(e) => handleChange("domain", e.target.value)} error={errors.domain}>
            {getDomainOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </Select>
          <Select id="edit-value_kind" label="Value Kind" value={formData.value_kind} onChange={(e) => handleChange("value_kind", e.target.value)} error={errors.value_kind}>
            {getValueKindOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </Select>
          <Input id="edit-name" label="Name" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} error={errors.name} maxLength={NAME_MAX} />
          <Input id="edit-unit" label="Unit" value={formData.unit} onChange={(e) => handleChange("unit", e.target.value)} error={errors.unit} maxLength={UNIT_MAX} />
          <div className="sm:col-span-2">
            <TextArea id="edit-description" label="Description (optional)" value={formData.description} onChange={(e) => handleChange("description", e.target.value)} error={errors.description} maxLength={DESCRIPTION_MAX} rows={2} />
          </div>
          <Input id="edit-baseline_value" label="Baseline Value (optional)" value={formData.baseline_value} onChange={(e) => handleChange("baseline_value", e.target.value)} error={errors.baseline_value} type="text" />
          <Input id="edit-target_value" label="Target Value (optional)" value={formData.target_value} onChange={(e) => handleChange("target_value", e.target.value)} error={errors.target_value} type="text" />
          <Select id="edit-target_direction" label="Target Direction" value={formData.target_direction} onChange={(e) => handleChange("target_direction", e.target.value)} error={errors.target_direction}>
            {getTargetDirectionOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </Select>
          <Select id="edit-cadence" label="Cadence" value={formData.cadence} onChange={(e) => handleChange("cadence", e.target.value)} error={errors.cadence}>
            {getCadenceOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </Select>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </div>
      </form>
    </Card>
  );
}
