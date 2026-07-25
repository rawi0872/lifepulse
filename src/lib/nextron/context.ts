export type NextronContextDomain =
  | "profile"
  | "today"
  | "tasks"
  | "habits"
  | "results"
  | "goals"
  | "projects"
  | "journal"
  | "eveningShutdown"
  | "weeklyReview";

export type NextronPermissionLevel = "allowed" | "denied" | "unavailable";

export interface NextronContextPermission {
  domain: NextronContextDomain;
  label: string;
  description: string;
  level: NextronPermissionLevel;
  textHeavy: boolean;
  persisted: boolean;
}

export type NextronPermissionState = Record<NextronContextDomain, NextronPermissionLevel>;

export const NEXTRON_CONTEXT_PERMISSIONS: readonly NextronContextPermission[] = [
  {
    domain: "profile",
    label: "Profile intent",
    description: "Uses your onboarding intent, not private profile secrets.",
    level: "allowed",
    textHeavy: false,
    persisted: false,
  },
  {
    domain: "today",
    label: "Today",
    description: "Uses today's priority, task counts, and habit counts.",
    level: "allowed",
    textHeavy: false,
    persisted: false,
  },
  {
    domain: "tasks",
    label: "Tasks",
    description: "Uses bounded open-task counts. Titles stay hidden unless this is allowed.",
    level: "allowed",
    textHeavy: false,
    persisted: false,
  },
  {
    domain: "habits",
    label: "Habits",
    description: "Uses due/completed counts and weekly progress from habit logs.",
    level: "allowed",
    textHeavy: false,
    persisted: false,
  },
  {
    domain: "results",
    label: "Results",
    description: "Uses bounded manual metric counts and latest values.",
    level: "allowed",
    textHeavy: false,
    persisted: false,
  },
  {
    domain: "goals",
    label: "Goals",
    description: "Uses active goal counts and a few names when allowed.",
    level: "allowed",
    textHeavy: false,
    persisted: false,
  },
  {
    domain: "projects",
    label: "Projects",
    description: "Uses active project counts and whether projects have open tasks.",
    level: "allowed",
    textHeavy: false,
    persisted: false,
  },
  {
    domain: "journal",
    label: "Journal text",
    description: "Can read a bounded recent reflection snippet only if you allow it.",
    level: "denied",
    textHeavy: true,
    persisted: false,
  },
  {
    domain: "eveningShutdown",
    label: "Evening Shutdown reflection",
    description: "Can read today's saved shutdown reflection only if you allow it.",
    level: "denied",
    textHeavy: true,
    persisted: false,
  },
  {
    domain: "weeklyReview",
    label: "Weekly Review reflection",
    description: "Can read the current weekly review focus only if you allow it.",
    level: "denied",
    textHeavy: true,
    persisted: false,
  },
];

export const NEXTRON_UNAVAILABLE_CONTEXT = [
  "External AI memory",
  "Calendar, reminders, email, and messages",
  "Wearables or automatic device sync",
  "Bank connections or investment accounts",
  "Denied Journal, Evening Shutdown, or Weekly Review text",
] as const;

export function getDefaultNextronPermissions(): NextronPermissionState {
  return NEXTRON_CONTEXT_PERMISSIONS.reduce<NextronPermissionState>((state, permission) => {
    state[permission.domain] = permission.level;
    return state;
  }, {} as NextronPermissionState);
}

export function isNextronContextAllowed(state: NextronPermissionState, domain: NextronContextDomain): boolean {
  return state[domain] === "allowed";
}

export function getNextronPermission(domain: NextronContextDomain): NextronContextPermission {
  const permission = NEXTRON_CONTEXT_PERMISSIONS.find((item) => item.domain === domain);
  if (!permission) throw new Error(`Unknown NEXTRON context domain: ${domain}`);
  return permission;
}
