import type { NextronCoachResponse } from "@/lib/nextron/coach";
import type { NextronEvidencePacket } from "@/lib/nextron/evidence";

const ALLOWED_NEXTRON_ACTION_ROUTES = new Set([
  "/today",
  "/today#evening-reflection",
  "/tasks",
  "/habits",
  "/results",
  "/journal",
  "/weekly-review",
  "/goals",
  "/projects",
]);

export interface NextronProviderRequest {
  evidence: NextronEvidencePacket;
  userPrompt?: string;
}

export interface NextronProvider {
  name: string;
  generateResponse(request: NextronProviderRequest): Promise<NextronCoachResponse>;
}

export function isValidNextronProviderResponse(value: unknown): value is NextronCoachResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NextronCoachResponse>;
  if (!Array.isArray(candidate.facts) || candidate.facts.length === 0) return false;
  if (!Array.isArray(candidate.supportingEvidence) || candidate.supportingEvidence.length === 0) return false;
  if (typeof candidate.interpretation !== "string" || candidate.interpretation.trim().length === 0) return false;
  if (typeof candidate.nextAction?.label !== "string" || candidate.nextAction.label.trim().length === 0) return false;
  if (typeof candidate.nextAction.href !== "string" || !ALLOWED_NEXTRON_ACTION_ROUTES.has(candidate.nextAction.href)) return false;
  if (typeof candidate.nextAction.rationale !== "string" || candidate.nextAction.rationale.trim().length === 0) return false;
  if (typeof candidate.ruleId !== "string" || candidate.ruleId.trim().length === 0) return false;

  return candidate.facts.every((item) => (
    typeof item.category === "string"
    && typeof item.text === "string"
    && item.text.trim().length > 0
    && candidate.supportingEvidence?.includes(item.text)
  ));
}

export async function runNextronProviderOrFallback(
  request: NextronProviderRequest,
  fallback: () => NextronCoachResponse,
  provider?: NextronProvider,
): Promise<NextronCoachResponse> {
  if (!provider) return fallback();

  try {
    const response = await provider.generateResponse(request);
    return isValidNextronProviderResponse(response) ? response : fallback();
  } catch {
    return fallback();
  }
}
