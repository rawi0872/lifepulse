export const PRODUCT_LEARNING_EVENTS = [
  "onboarding_started",
  "onboarding_completed",
  "today_opened",
  "nextron_ask_succeeded",
  "nextron_ask_failed",
  "task_completed",
  "habit_completed",
  "goal_created",
  "project_created",
  "weekly_review_completed",
  "journal_entry_created",
  "feedback_submitted",
] as const;

export type ProductLearningEvent = (typeof PRODUCT_LEARNING_EVENTS)[number];

export type ProductLearningViewport = "mobile" | "tablet" | "desktop" | "unknown";
export type ProductLearningFailureReason = "timeout" | "auth_required" | "invalid_request" | "api_error" | "network_error" | "render_error" | "unknown";

export type ProductLearningMetadata = {
  reason?: ProductLearningFailureReason;
  viewport?: ProductLearningViewport;
};

export const EVENT_SURFACE: Record<ProductLearningEvent, string> = {
  onboarding_started: "onboarding",
  onboarding_completed: "onboarding",
  today_opened: "today",
  nextron_ask_succeeded: "nextron",
  nextron_ask_failed: "nextron",
  task_completed: "tasks",
  habit_completed: "habits",
  goal_created: "goals",
  project_created: "projects",
  weekly_review_completed: "weekly_review",
  journal_entry_created: "journal",
  feedback_submitted: "feedback",
};

export const EVENT_STATUS: Partial<Record<ProductLearningEvent, "success" | "failed">> = {
  nextron_ask_succeeded: "success",
  nextron_ask_failed: "failed",
};

const EVENT_SET = new Set<string>(PRODUCT_LEARNING_EVENTS);
const FAILURE_REASONS = new Set<string>(["timeout", "auth_required", "invalid_request", "api_error", "network_error", "render_error", "unknown"]);
const VIEWPORTS = new Set<string>(["mobile", "tablet", "desktop", "unknown"]);

export function isProductLearningEvent(value: unknown): value is ProductLearningEvent {
  return typeof value === "string" && EVENT_SET.has(value);
}

export function normalizeViewport(value: unknown): ProductLearningViewport | null {
  return typeof value === "string" && VIEWPORTS.has(value) ? value as ProductLearningViewport : null;
}

export function classifyViewport(width: number | null | undefined): ProductLearningViewport {
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return "unknown";
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function normalizeFailureReason(value: unknown): ProductLearningFailureReason | null {
  return typeof value === "string" && FAILURE_REASONS.has(value) ? value as ProductLearningFailureReason : null;
}

export function sanitizeProductLearningMetadata(event: ProductLearningEvent, metadata: unknown): ProductLearningMetadata | null {
  if (metadata === undefined || metadata === null) return {};
  if (typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const keys = Object.keys(metadata);
  if (keys.some((key) => key !== "reason" && key !== "viewport")) return null;
  const record = metadata as Record<string, unknown>;
  const next: ProductLearningMetadata = {};
  if ("viewport" in record) {
    const viewport = normalizeViewport(record.viewport);
    if (!viewport) return null;
    next.viewport = viewport;
  }
  if ("reason" in record) {
    if (event !== "nextron_ask_failed") return null;
    const reason = normalizeFailureReason(record.reason);
    if (!reason) return null;
    next.reason = reason;
  }
  return next;
}
