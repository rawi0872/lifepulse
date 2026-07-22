import type { IntendedUse } from "@/lib/intendedUse";

export type ModuleStatus = "available" | "preview" | "planned";

export type ModuleCategory = "core" | "personal" | "business" | "team" | "devices" | "ai";

export type ModuleKey =
  | "today"
  | "tasks"
  | "habits"
  | "journal"
  | "goals"
  | "projects"
  | "results"
  | "insights"
  | "settings"
  | "body"
  | "mind"
  | "finance"
  | "knowledge"
  | "passions"
  | "coach"
  | "weeklyReview"
  | "devices"
  | "business"
  | "clients"
  | "sales"
  | "meetings"
  | "businessFinance"
  | "documents"
  | "team"
  | "sharedProjects"
  | "members"
  | "decisions"
  | "smartocaster"
  | "wearables"
  | "morningBriefing";

export interface LifePulseModule {
  key: ModuleKey;
  label: string;
  category: ModuleCategory;
  status: ModuleStatus;
  description: string;
  href?: string;
}

export const MODULE_REGISTRY: readonly LifePulseModule[] = [
  {
    key: "today",
    label: "Today",
    category: "core",
    status: "available",
    href: "/today",
    description: "Daily command center for priorities, actions, and pulse checks.",
  },
  {
    key: "tasks",
    label: "Tasks",
    category: "core",
    status: "available",
    href: "/tasks",
    description: "Capture and complete actionable work.",
  },
  {
    key: "habits",
    label: "Habits",
    category: "core",
    status: "available",
    href: "/habits",
    description: "Track repeatable routines and consistency.",
  },
  {
    key: "journal",
    label: "Journal",
    category: "core",
    status: "available",
    href: "/journal",
    description: "Record reflections and daily context.",
  },
  {
    key: "goals",
    label: "Goals",
    category: "core",
    status: "available",
    href: "/goals",
    description: "Define outcomes, milestones, and linked progress.",
  },
  {
    key: "projects",
    label: "Projects",
    category: "core",
    status: "available",
    href: "/projects",
    description: "Organize multi-step work and project tasks.",
  },
  {
    key: "results",
    label: "Results",
    category: "core",
    status: "available",
    href: "/results",
    description: "Track measurable outcomes over time.",
  },
  {
    key: "insights",
    label: "Insights",
    category: "core",
    status: "available",
    href: "/insights",
    description: "Review patterns across activity and progress.",
  },
  {
    key: "settings",
    label: "Settings",
    category: "core",
    status: "available",
    href: "/settings",
    description: "Manage profile, setup preference, and life areas.",
  },
  {
    key: "body",
    label: "Body",
    category: "personal",
    status: "available",
    href: "/body",
    description: "Track body metrics, workouts, nutrition, and health notes.",
  },
  {
    key: "mind",
    label: "Mind",
    category: "personal",
    status: "available",
    href: "/mind",
    description: "Track mood, focus, stress, clarity, and motivation.",
  },
  {
    key: "finance",
    label: "Finance",
    category: "personal",
    status: "available",
    href: "/finance",
    description: "Track accounts, transactions, budgets, and cashflow.",
  },
  {
    key: "knowledge",
    label: "Knowledge",
    category: "personal",
    status: "available",
    href: "/knowledge",
    description: "Collect knowledge items and collections.",
  },
  {
    key: "passions",
    label: "Passions",
    category: "personal",
    status: "available",
    href: "/passions",
    description: "Track hobbies, creative work, and passion sessions.",
  },
  {
    key: "coach",
    label: "Coach",
    category: "ai",
    status: "preview",
    href: "/coach",
    description: "Rule-based recommendations. AI summaries are not enabled yet.",
  },
  {
    key: "weeklyReview",
    label: "Weekly Review",
    category: "ai",
    status: "preview",
    href: "/weekly-review",
    description: "Lightweight weekly reflection and review surface.",
  },
  {
    key: "devices",
    label: "Devices",
    category: "devices",
    status: "preview",
    href: "/devices",
    description: "Manual-first device foundation. Device sync is not active yet.",
  },
  {
    key: "business",
    label: "Business",
    category: "business",
    status: "planned",
    description: "Future business operating context.",
  },
  {
    key: "clients",
    label: "Clients",
    category: "business",
    status: "planned",
    description: "Future client relationship tracking.",
  },
  {
    key: "sales",
    label: "Sales",
    category: "business",
    status: "planned",
    description: "Future sales pipeline and follow-up support.",
  },
  {
    key: "meetings",
    label: "Meetings",
    category: "business",
    status: "planned",
    description: "Future meeting notes, actions, and decisions.",
  },
  {
    key: "businessFinance",
    label: "Business Finance",
    category: "business",
    status: "planned",
    description: "Future business-specific financial context.",
  },
  {
    key: "documents",
    label: "Documents",
    category: "business",
    status: "planned",
    description: "Future document organization and context.",
  },
  {
    key: "team",
    label: "Team",
    category: "team",
    status: "planned",
    description: "Future shared team operating space.",
  },
  {
    key: "sharedProjects",
    label: "Shared Projects",
    category: "team",
    status: "planned",
    description: "Future collaborative project execution.",
  },
  {
    key: "members",
    label: "Members",
    category: "team",
    status: "planned",
    description: "Future team member and role management.",
  },
  {
    key: "decisions",
    label: "Decisions",
    category: "team",
    status: "planned",
    description: "Future decision tracking and shared memory.",
  },
  {
    key: "smartocaster",
    label: "Smartocaster",
    category: "devices",
    status: "planned",
    description: "Future Smartocaster hardware integration.",
  },
  {
    key: "wearables",
    label: "Wearables",
    category: "devices",
    status: "planned",
    description: "Future wearable device integrations.",
  },
  {
    key: "morningBriefing",
    label: "Morning Briefing",
    category: "ai",
    status: "planned",
    description: "Future personalized daily briefing.",
  },
] as const;

const RECOMMENDED_MODULE_KEYS: Record<IntendedUse, readonly ModuleKey[]> = {
  personal: [
    "today",
    "tasks",
    "habits",
    "journal",
    "goals",
    "projects",
    "insights",
    "settings",
    "body",
    "mind",
    "finance",
    "knowledge",
    "passions",
    "coach",
    "weeklyReview",
  ],
  business: [
    "today",
    "tasks",
    "projects",
    "goals",
    "insights",
    "settings",
    "finance",
    "knowledge",
    "coach",
    "weeklyReview",
    "business",
    "clients",
    "sales",
    "meetings",
    "documents",
  ],
  team: [
    "today",
    "tasks",
    "projects",
    "goals",
    "insights",
    "settings",
    "knowledge",
    "coach",
    "team",
    "sharedProjects",
    "members",
    "decisions",
    "meetings",
  ],
  mixed: [
    "today",
    "tasks",
    "habits",
    "journal",
    "goals",
    "projects",
    "insights",
    "settings",
    "body",
    "mind",
    "finance",
    "knowledge",
    "passions",
    "coach",
    "weeklyReview",
    "business",
    "clients",
    "meetings",
  ],
} as const;

export function getModulesByCategory(): Record<ModuleCategory, LifePulseModule[]> {
  return MODULE_REGISTRY.reduce<Record<ModuleCategory, LifePulseModule[]>>(
    (groups, module) => {
      groups[module.category].push(module);
      return groups;
    },
    { core: [], personal: [], business: [], team: [], devices: [], ai: [] },
  );
}

export function getRecommendedModuleKeys(intendedUse: IntendedUse): readonly ModuleKey[] {
  return RECOMMENDED_MODULE_KEYS[intendedUse];
}

export function getRecommendedModules(intendedUse: IntendedUse): LifePulseModule[] {
  const recommendedKeys = new Set(getRecommendedModuleKeys(intendedUse));
  return MODULE_REGISTRY.filter((module) => recommendedKeys.has(module.key));
}

export function getModuleStatusLabel(status: ModuleStatus): string {
  if (status === "available") return "Available";
  if (status === "preview") return "Preview";
  return "Planned";
}

export function getModuleCategoryLabel(category: ModuleCategory): string {
  if (category === "core") return "Core";
  if (category === "personal") return "Personal";
  if (category === "business") return "Business";
  if (category === "team") return "Team";
  if (category === "devices") return "Devices";
  return "AI";
}
