// Life Pulse Results — Formatting utilities (Phase 1)
// No UI, no hooks, no Supabase, no I/O

import type { ResultDomain, ResultValueKind, ResultCadence, ResultTargetDirection } from "@/lib/results/types";
import { parseNumeric } from "@/lib/results/calculations";

export function formatValue(value: string | number | null, unit: string, valueKind: ResultValueKind): string {
  const num = parseNumeric(value);
  if (num === null) return "—";

  switch (valueKind) {
    case "count":
      return `${Math.trunc(num)} ${unit}`;
    case "percentage":
      return `${num.toFixed(2)}%`;
    case "duration":
      return formatDurationMinutes(num, unit);
    case "currency":
      return formatCurrency(num, unit);
    case "rating":
      return `${num.toFixed(1)} ${unit}`;
    case "number":
    default:
      return `${num.toFixed(num % 1 === 0 ? 0 : 2)} ${unit}`;
  }
}

function formatDurationMinutes(value: number, unit: string): string {
  const minutes = Math.round(value);
  if (minutes < 60) return `${minutes} ${unit}`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatCurrency(value: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

export function formatDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const timestamp = new Date(dateString).getTime();
    if (!Number.isFinite(timestamp)) return dateString || "Date unavailable";
    const diff = Date.now() - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return dateString;
  }
}

export function formatDomainLabel(domain: ResultDomain): string {
  const labels: Record<ResultDomain, string> = {
    body: "Body",
    mind: "Mind",
    finance: "Finance",
    business: "Business",
    learning: "Learning",
    skills: "Skills",
    passions: "Passions",
    goals: "Goals",
    custom: "Custom",
  };
  return labels[domain] ?? domain;
}

export function formatValueKindLabel(kind: ResultValueKind): string {
  const labels: Record<ResultValueKind, string> = {
    number: "Number",
    count: "Count",
    percentage: "Percentage (0–100)",
    duration: "Duration (minutes)",
    currency: "Currency",
    rating: "Rating (1–10)",
  };
  return labels[kind] ?? kind;
}

export function formatTargetDirectionLabel(direction: ResultTargetDirection): string {
  const labels: Record<ResultTargetDirection, string> = {
    increase: "Increase",
    decrease: "Decrease",
    maintain: "Maintain",
    none: "None",
  };
  return labels[direction] ?? direction;
}

export function formatCadenceLabel(cadence: ResultCadence): string {
  const labels: Record<ResultCadence, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
    custom: "Custom",
    none: "None",
  };
  return labels[cadence] ?? cadence;
}

export function getDomainOptions(): { value: ResultDomain; label: string }[] {
  const domains: ResultDomain[] = ["body", "mind", "finance", "business", "learning", "skills", "passions", "goals", "custom"];
  return domains.map((d) => ({ value: d, label: formatDomainLabel(d) }));
}

export function getValueKindOptions(): { value: ResultValueKind; label: string }[] {
  const kinds: ResultValueKind[] = ["number", "count", "percentage", "duration", "currency", "rating"];
  return kinds.map((k) => ({ value: k, label: formatValueKindLabel(k) }));
}

export function getTargetDirectionOptions(): { value: ResultTargetDirection; label: string }[] {
  const dirs: ResultTargetDirection[] = ["increase", "decrease", "maintain", "none"];
  return dirs.map((d) => ({ value: d, label: formatTargetDirectionLabel(d) }));
}

export function getCadenceOptions(): { value: ResultCadence; label: string }[] {
  const cads: ResultCadence[] = ["daily", "weekly", "monthly", "quarterly", "yearly", "custom", "none"];
  return cads.map((c) => ({ value: c, label: formatCadenceLabel(c) }));
}
