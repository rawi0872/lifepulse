"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getValueKindOptions, getTargetDirectionOptions, getCadenceOptions, getDomainOptions } from "@/lib/results/format";
import type { MetricDefinitionInput, MetricDefinitionRow, ResultDomain, ResultValueKind, ResultTargetDirection, ResultCadence } from "@/lib/results/types";
import { validateValueForKind } from "@/lib/results/calculations";
import { NAME_MAX, UNIT_MAX, DESCRIPTION_MAX } from "@/lib/results/contract";

interface CreateMetricFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editingMetric?: MetricDefinitionRow | null;
  hasEntries?: boolean;
}

const MAX_LENGTHS = {
  name: NAME_MAX,
  unit: UNIT_MAX,
  description: DESCRIPTION_MAX,
};

export function CreateMetricForm({ onSuccess, onCancel, editingMetric, hasEntries = false }: CreateMetricFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<Partial<MetricDefinitionInput>>({
    domain: editingMetric?.domain ?? "custom",
    name: editingMetric?.name ?? "",
    description: editingMetric?.description ?? "",
    value_kind: editingMetric?.value_kind ?? "number",
    unit: editingMetric?.unit ?? "",
    baseline_value: editingMetric?.baseline_value ?? "",
    target_value: editingMetric?.target_value ?? "",
    target_direction: editingMetric?.target_direction ?? "none",
    cadence: editingMetric?.cadence ?? "none",
  });

  function validateField(name: string, value: string): string | null {
    switch (name) {
      case "name":
        if (!value.trim()) return "Name is required";
        if (value.length > MAX_LENGTHS.name) return `Name must be ${MAX_LENGTHS.name} characters or fewer`;
        break;
      case "unit":
        if (!value.trim()) return "Unit is required";
        if (value.length > MAX_LENGTHS.unit) return `Unit must be ${MAX_LENGTHS.unit} characters or fewer`;
        break;
      case "description":
        if (value.length > MAX_LENGTHS.description) return `Description must be ${MAX_LENGTHS.description} characters or fewer`;
        break;
      case "baseline_value":
      case "target_value":
        if (value.trim() !== "") {
          const kind = formData.value_kind as ResultValueKind;
          const validation = validateValueForKind(value, kind);
          if (!validation.valid) {
            const error = validation.error ?? "Enter a valid value";
            return error;
          }
        }
        break;
    }
    return null;
  }

  function handleChange(name: string, value: string) {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error ?? "" }));
  }

  function handleBlur(name: string, value: string) {
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error ?? "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    (Object.keys(formData) as Array<keyof MetricDefinitionInput>).forEach((key) => {
      const error = validateField(key, formData[key] as string);
      if (error) newErrors[key] = error;
    });

    if (Object.values(newErrors).some((e) => e)) {
      setErrors(newErrors);
      const firstInvalidField = Object.keys(newErrors).find((key) => newErrors[key]);
      if (firstInvalidField) {
        requestAnimationFrame(() => {
          formRef.current?.querySelector<HTMLElement>(`#${firstInvalidField}`)?.focus();
        });
      }
      return;
    }

    setSaving(true);
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ type: "error", title: "Please sign in to continue." });
        setSaving(false);
        return;
      }

      const payload: MetricDefinitionInput = {
        domain: formData.domain as ResultDomain,
        name: (formData.name ?? "").trim(),
        description: formData.description?.trim() || null,
        value_kind: formData.value_kind as ResultValueKind,
        unit: (formData.unit ?? "").trim(),
        baseline_value: String(formData.baseline_value ?? "").trim() || null,
        target_value: String(formData.target_value ?? "").trim() || null,
        target_direction: formData.target_direction as ResultTargetDirection,
        cadence: formData.cadence as ResultCadence,
      };

      // If editing, prevent changing value_kind or unit if entries exist
      if (editingMetric && hasEntries) {
        if (payload.value_kind !== editingMetric.value_kind) {
          toast({ type: "error", title: "Cannot change value kind while entries exist" });
          setSaving(false);
          return;
        }
        if (payload.unit !== editingMetric.unit) {
          toast({ type: "error", title: "Cannot change unit while entries exist" });
          setSaving(false);
          return;
        }
      }

      let error;
      if (editingMetric) {
        const { error: updateError } = await supabase
          .from("metric_definitions")
          .update(payload)
          .eq("id", editingMetric.id)
          .eq("user_id", user.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("metric_definitions")
          .insert({ ...payload, user_id: user.id });
        error = insertError;
      }

      if (error) {
        if (error.code === "23505") {
          toast({ type: "error", title: "A metric with this name already exists in this domain" });
        } else {
          toast({ type: "error", title: editingMetric ? "Failed to update metric" : "Failed to create metric" });
        }
        setSaving(false);
        return;
      }

      toast({ type: "success", title: editingMetric ? "Metric updated" : "Metric created" });
      onSuccess();
    } catch {
      toast({ type: "error", title: "An unexpected error occurred" });
    } finally {
      setSaving(false);
    }
  }

  const domainOptions = getDomainOptions();
  const valueKindOptions = getValueKindOptions();
  const targetDirectionOptions = getTargetDirectionOptions();
  const cadenceOptions = getCadenceOptions();

  return (
    <Card className="mb-6 p-4 sm:p-5 animate-slide-up">
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {editingMetric ? "Edit Metric" : "Create Metric"}
          </h3>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="domain"
            label="Domain"
            value={formData.domain}
            onChange={(e) => handleChange("domain", e.target.value)}
            onBlur={(e) => handleBlur("domain", e.target.value)}
            error={errors.domain}
          >
            {domainOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            id="value_kind"
            label="Value Kind"
            value={formData.value_kind}
            onChange={(e) => handleChange("value_kind", e.target.value)}
            onBlur={(e) => handleBlur("value_kind", e.target.value)}
            error={errors.value_kind}
            disabled={Boolean(editingMetric && hasEntries)}
          >
            {valueKindOptions.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={Boolean(editingMetric && hasEntries)}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Input
            id="name"
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onBlur={(e) => handleBlur("name", e.target.value)}
            error={errors.name}
            placeholder="e.g., Bench Press 1RM"
            maxLength={MAX_LENGTHS.name}
            disabled={Boolean(editingMetric && hasEntries)}
          />

          <Input
            id="unit"
            label="Unit"
            value={formData.unit}
            onChange={(e) => handleChange("unit", e.target.value)}
            onBlur={(e) => handleBlur("unit", e.target.value)}
            error={errors.unit}
            placeholder="e.g., kg"
            maxLength={MAX_LENGTHS.unit}
            disabled={Boolean(editingMetric && hasEntries)}
          />

          <div className="sm:col-span-2">
            <TextArea
              id="description"
              label="Description (optional)"
              value={formData.description ?? ""}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={(e) => handleBlur("description", e.target.value)}
              error={errors.description}
              placeholder="What does this metric measure?"
              maxLength={MAX_LENGTHS.description}
              rows={2}
            />
          </div>

          <Input
            id="baseline_value"
            label="Baseline Value (optional)"
            value={formData.baseline_value ?? ""}
            onChange={(e) => handleChange("baseline_value", e.target.value)}
            onBlur={(e) => handleBlur("baseline_value", e.target.value)}
            error={errors.baseline_value}
            placeholder="Starting value for comparison"
            type="text"
          />

          <Input
            id="target_value"
            label="Target Value (optional)"
            value={formData.target_value ?? ""}
            onChange={(e) => handleChange("target_value", e.target.value)}
            onBlur={(e) => handleBlur("target_value", e.target.value)}
            error={errors.target_value}
            placeholder="Target to work toward"
            type="text"
          />

          <Select
            id="target_direction"
            label="Target Direction"
            value={formData.target_direction}
            onChange={(e) => handleChange("target_direction", e.target.value)}
            onBlur={(e) => handleBlur("target_direction", e.target.value)}
            error={errors.target_direction}
          >
            {targetDirectionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            id="cadence"
            label="Cadence"
            value={formData.cadence}
            onChange={(e) => handleChange("cadence", e.target.value)}
            onBlur={(e) => handleBlur("cadence", e.target.value)}
            error={errors.cadence}
          >
            {cadenceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} variant={editingMetric ? "secondary" : "primary"}>
            {saving ? "Saving…" : editingMetric ? "Save Changes" : "Create Metric"}
          </Button>
        </div>

        <p className="mt-3 text-[10px] text-[var(--text-muted)]">
          Manually recorded only. Private to your account. No automatic conversion or interpretation.
        </p>
      </form>
    </Card>
  );
}
