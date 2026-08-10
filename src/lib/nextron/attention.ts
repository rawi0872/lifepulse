import "server-only";

import type { NextronSignal, NextronSignalSeverity } from "@/lib/nextron/signals";

export interface NextronAttentionItem {
  id: string;
  domain: string;
  severity: NextronSignalSeverity;
  title: string;
  explanation: string;
  evidence: string[];
  route: NextronSignal["route"];
  bridgePrompt: string;
}

export interface NextronAttentionSummary {
  version: "nextron-attention-v1";
  status: "active" | "calm" | "partial";
  generatedAt: string;
  localDate: string;
  primary: NextronAttentionItem | null;
  secondary: NextronAttentionItem[];
  calmMessage: string;
  currentFocus: { title: string; detail: string; route: NextronSignal["route"]; bridgePrompt: string } | null;
  meta: {
    maxPrimary: 1;
    maxSecondary: 4;
    modelCalls: 0;
    provider: "deterministic";
    persisted: false;
    source: "signals";
  };
}

const SEVERITY_ORDER: Record<NextronSignalSeverity, number> = { important: 3, attention: 2, info: 1 };

function signalDomain(signal: NextronSignal): string {
  return signal.sourceTypes[0] ?? "Today";
}

function toAttentionItem(signal: NextronSignal): NextronAttentionItem {
  return {
    id: signal.id,
    domain: signalDomain(signal),
    severity: signal.severity,
    title: signal.title,
    explanation: signal.summary,
    evidence: signal.evidence.slice(0, 3),
    route: signal.route,
    bridgePrompt: signal.bridgePrompt,
  };
}

function byAttentionRank(a: NextronSignal, b: NextronSignal): number {
  return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    || a.title.localeCompare(b.title)
    || a.id.localeCompare(b.id);
}

function currentFocusFrom(signals: NextronSignal[]): NextronAttentionSummary["currentFocus"] {
  const actionable = signals.find((signal) => signal.severity !== "info") ?? signals[0] ?? null;
  return actionable
    ? { title: actionable.title, detail: actionable.summary, route: actionable.route, bridgePrompt: actionable.bridgePrompt }
    : null;
}

export function buildNextronAttentionSummary(args: { signals: NextronSignal[]; localDate: string; observedAt: string; partial?: boolean }): NextronAttentionSummary {
  const ranked = [...args.signals].sort(byAttentionRank);
  const importantOrAttention = ranked.filter((signal) => signal.severity !== "info");
  const display = importantOrAttention.length > 0 ? [...importantOrAttention, ...ranked.filter((signal) => signal.severity === "info")] : ranked;
  const primarySignal = display[0] ?? null;
  const secondarySignals = display.slice(1, 5);
  const calm = !primarySignal || primarySignal.severity === "info" && importantOrAttention.length === 0;

  return {
    version: "nextron-attention-v1",
    status: args.partial ? "partial" : calm ? "calm" : "active",
    generatedAt: args.observedAt,
    localDate: args.localDate,
    primary: calm ? null : toAttentionItem(primarySignal),
    secondary: calm ? display.slice(0, 4).map(toAttentionItem) : secondarySignals.map(toAttentionItem),
    calmMessage: calm
      ? "NEXTRON sees nothing that needs immediate attention right now."
      : "NEXTRON found current Life Pulse evidence that deserves attention.",
    currentFocus: currentFocusFrom(display),
    meta: {
      maxPrimary: 1,
      maxSecondary: 4,
      modelCalls: 0,
      provider: "deterministic",
      persisted: false,
      source: "signals",
    },
  };
}
