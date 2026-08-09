export type NextronContextDomain =
  | "profile"
  | "today"
  | "tasks"
  | "taskActions"
  | "habits"
  | "results"
  | "goals"
  | "projects"
  | "knowledge"
  | "drive"
  | "calendar"
  | "journal"
  | "eveningShutdown"
  | "weeklyReview";

export type NextronPermissionLevel = "allowed" | "denied" | "unavailable";

export interface NextronContextPermission {
  domain: NextronContextDomain;
  dbColumn: NextronPermissionColumn;
  label: string;
  description: string;
  level: NextronPermissionLevel;
  textHeavy: boolean;
}

export type NextronPermissionState = Record<NextronContextDomain, NextronPermissionLevel>;

export type NextronPermissionColumn =
  | "allow_profile"
  | "allow_today"
  | "allow_tasks"
  | "allow_task_actions"
  | "allow_habits"
  | "allow_results"
  | "allow_goals"
  | "allow_projects"
  | "allow_knowledge"
  | "allow_drive"
  | "allow_calendar"
  | "allow_journal"
  | "allow_evening_shutdown"
  | "allow_weekly_review";

export interface NextronPreferenceRow {
  permission_version: number | null;
  allow_profile: boolean | null;
  allow_today: boolean | null;
  allow_tasks: boolean | null;
  allow_task_actions?: boolean | null;
  allow_habits: boolean | null;
  allow_results: boolean | null;
  allow_goals: boolean | null;
  allow_projects: boolean | null;
  allow_knowledge?: boolean | null;
  allow_drive?: boolean | null;
  allow_calendar?: boolean | null;
  allow_journal: boolean | null;
  allow_evening_shutdown: boolean | null;
  allow_weekly_review: boolean | null;
}

export interface NextronPreferenceUpsert {
  user_id: string;
  permission_version: number;
  allow_profile: boolean;
  allow_today: boolean;
  allow_tasks: boolean;
  allow_task_actions: boolean;
  allow_habits: boolean;
  allow_results: boolean;
  allow_goals: boolean;
  allow_projects: boolean;
  allow_knowledge: boolean;
  allow_drive: boolean;
  allow_calendar: boolean;
  allow_journal: boolean;
  allow_evening_shutdown: boolean;
  allow_weekly_review: boolean;
}

export interface NormalizedNextronPreferences {
  permissions: NextronPermissionState;
  warning: string | null;
}

export const NEXTRON_PERMISSION_VERSION = 5;

const NEXTRON_DEFAULT_PERMISSION_LEVELS: NextronPermissionState = {
  profile: "allowed",
  today: "allowed",
  tasks: "allowed",
  taskActions: "denied",
  habits: "allowed",
  results: "allowed",
  goals: "allowed",
  projects: "allowed",
  knowledge: "denied",
  drive: "denied",
  calendar: "denied",
  journal: "denied",
  eveningShutdown: "denied",
  weeklyReview: "denied",
};

export const NEXTRON_CONTEXT_PERMISSIONS: readonly NextronContextPermission[] = [
  {
    domain: "profile",
    dbColumn: "allow_profile",
    label: "Profile intent",
    description: "Uses your onboarding intent, not private profile secrets.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.profile,
    textHeavy: false,
  },
  {
    domain: "today",
    dbColumn: "allow_today",
    label: "Today",
    description: "Uses today's priority, task counts, and habit counts.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.today,
    textHeavy: false,
  },
  {
    domain: "tasks",
    dbColumn: "allow_tasks",
    label: "Tasks",
    description: "Uses bounded open-task counts. Titles stay hidden unless this is allowed.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.tasks,
    textHeavy: false,
  },
  {
    domain: "taskActions",
    dbColumn: "allow_task_actions",
    label: "Task actions",
    description: "Allows explicitly approved NEXTRON Task create/update mutations. Each action still requires a separate approval click.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.taskActions,
    textHeavy: false,
  },
  {
    domain: "habits",
    dbColumn: "allow_habits",
    label: "Habits",
    description: "Uses due/completed counts and weekly progress from habit logs.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.habits,
    textHeavy: false,
  },
  {
    domain: "results",
    dbColumn: "allow_results",
    label: "Results",
    description: "Uses bounded manual metric counts and latest values.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.results,
    textHeavy: false,
  },
  {
    domain: "goals",
    dbColumn: "allow_goals",
    label: "Goals",
    description: "Uses active goal counts and a few names when allowed.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.goals,
    textHeavy: false,
  },
  {
    domain: "projects",
    dbColumn: "allow_projects",
    label: "Projects",
    description: "Uses active project counts and whether projects have open tasks.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.projects,
    textHeavy: false,
  },
  {
    domain: "knowledge",
    dbColumn: "allow_knowledge",
    label: "Knowledge notes",
    description: "Allow NEXTRON to read bounded snippets from your Knowledge notes when relevant.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.knowledge,
    textHeavy: true,
  },
  {
    domain: "drive",
    dbColumn: "allow_drive",
    label: "Imported Google Drive files",
    description: "Allow NEXTRON to use only Google Drive files you explicitly imported into Knowledge.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.drive,
    textHeavy: true,
  },
  {
    domain: "calendar",
    dbColumn: "allow_calendar",
    label: "Google Calendar",
    description: "Allow bounded read-only Calendar lookups when your Google Calendar connector is also connected.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.calendar,
    textHeavy: true,
  },
  {
    domain: "journal",
    dbColumn: "allow_journal",
    label: "Journal text",
    description: "Can read a bounded recent reflection snippet only if you allow it.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.journal,
    textHeavy: true,
  },
  {
    domain: "eveningShutdown",
    dbColumn: "allow_evening_shutdown",
    label: "Evening Shutdown reflection",
    description: "Can read today's saved shutdown reflection only if you allow it.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.eveningShutdown,
    textHeavy: true,
  },
  {
    domain: "weeklyReview",
    dbColumn: "allow_weekly_review",
    label: "Weekly Review reflection",
    description: "Can read the current weekly review focus only if you allow it.",
    level: NEXTRON_DEFAULT_PERMISSION_LEVELS.weeklyReview,
    textHeavy: true,
  },
];

export const NEXTRON_UNAVAILABLE_CONTEXT = [
  "External AI memory",
  "Reminders, email, and messages",
  "Wearables or automatic device sync",
  "Bank connections or investment accounts",
] as const;

export function getDefaultNextronPermissions(): NextronPermissionState {
  return { ...NEXTRON_DEFAULT_PERMISSION_LEVELS };
}

export function isNextronContextAllowed(state: NextronPermissionState, domain: NextronContextDomain): boolean {
  return state[domain] === "allowed";
}

export function getNextronPermission(domain: NextronContextDomain): NextronContextPermission {
  const permission = NEXTRON_CONTEXT_PERMISSIONS.find((item) => item.domain === domain);
  if (!permission) throw new Error(`Unknown NEXTRON context domain: ${domain}`);
  return permission;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function normalizeNextronPreferences(row: NextronPreferenceRow | null | undefined): NormalizedNextronPreferences {
  const defaults = getDefaultNextronPermissions();
  if (!row) return { permissions: defaults, warning: null };

  if (row.permission_version !== NEXTRON_PERMISSION_VERSION && row.permission_version !== 4 && row.permission_version !== 3 && row.permission_version !== 2 && row.permission_version !== 1) {
    return {
      permissions: defaults,
      warning: "Saved NEXTRON context permissions use an unsupported version, so safe defaults are active.",
    };
  }

  const normalized = getDefaultNextronPermissions();
  let malformed = false;

  for (const permission of NEXTRON_CONTEXT_PERMISSIONS) {
    const value = row[permission.dbColumn];
    if (!isBoolean(value)) {
      normalized[permission.domain] = permission.level;
      malformed = true;
    } else {
      normalized[permission.domain] = value ? "allowed" : "denied";
    }
  }

  return {
    permissions: normalized,
    warning: malformed ? "Saved NEXTRON context permissions were incomplete, so missing fields used safe defaults." : null,
  };
}

export function buildNextronPreferenceUpsert(userId: string, permissions: NextronPermissionState): NextronPreferenceUpsert {
  return {
    user_id: userId,
    permission_version: NEXTRON_PERMISSION_VERSION,
    allow_profile: permissions.profile === "allowed",
    allow_today: permissions.today === "allowed",
    allow_tasks: permissions.tasks === "allowed",
    allow_task_actions: permissions.taskActions === "allowed",
    allow_habits: permissions.habits === "allowed",
    allow_results: permissions.results === "allowed",
    allow_goals: permissions.goals === "allowed",
    allow_projects: permissions.projects === "allowed",
    allow_knowledge: permissions.knowledge === "allowed",
    allow_drive: permissions.drive === "allowed",
    allow_calendar: permissions.calendar === "allowed",
    allow_journal: permissions.journal === "allowed",
    allow_evening_shutdown: permissions.eveningShutdown === "allowed",
    allow_weekly_review: permissions.weeklyReview === "allowed",
  };
}

export function areNextronPermissionsEqual(a: NextronPermissionState, b: NextronPermissionState): boolean {
  return NEXTRON_CONTEXT_PERMISSIONS.every((permission) => a[permission.domain] === b[permission.domain]);
}
