export const INTENDED_USE_VALUES = ["personal", "business", "team", "mixed"] as const;

export type IntendedUse = (typeof INTENDED_USE_VALUES)[number];

export const INTENDED_USE_OPTIONS: readonly {
  value: IntendedUse;
  label: string;
  description: string;
}[] = [
  {
    value: "personal",
    label: "Personal life",
    description: "Habits, goals, health, journal, tasks, and daily rhythm.",
  },
  {
    value: "business",
    label: "Business / entrepreneurship",
    description: "Projects, clients, sales follow-ups, meetings, and founder focus.",
  },
  {
    value: "team",
    label: "Team / organization",
    description: "Shared projects, tasks, meetings, blockers, and team progress.",
  },
  {
    value: "mixed",
    label: "Mixed use",
    description: "Personal and business priorities in one system, with clear separation.",
  },
] as const;

export function resolveIntendedUse(value: string | null | undefined): IntendedUse {
  return INTENDED_USE_VALUES.includes(value as IntendedUse) ? (value as IntendedUse) : "personal";
}

export const TODAY_COPY: Record<IntendedUse, { subtitle: string; focusPrompt: string; emptyTitle: string; emptyBody: string }> = {
  personal: {
    subtitle: "Personal OS - Daily rhythm",
    focusPrompt: "What will make today count?",
    emptyTitle: "Welcome to your personal Life OS",
    emptyBody: "Add a habit or task to start building your daily rhythm.",
  },
  business: {
    subtitle: "Business focus - Daily execution",
    focusPrompt: "What business outcome matters most today?",
    emptyTitle: "Welcome to your business command center",
    emptyBody: "Capture a task or project to start turning business priorities into action.",
  },
  team: {
    subtitle: "Team setup - Early access",
    focusPrompt: "What team or project outcome needs attention?",
    emptyTitle: "Welcome to your team setup",
    emptyBody: "Start with a project or task. Shared team permissions are an early-access direction, not active in this setup yet.",
  },
  mixed: {
    subtitle: "Mixed mode - Context-aware day",
    focusPrompt: "What matters most across life and work today?",
    emptyTitle: "Welcome to your mixed Life OS",
    emptyBody: "Capture what matters today across life and work. Keep separation clear as you build your system.",
  },
};
