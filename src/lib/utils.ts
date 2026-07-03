export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getWeekStartDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  // Create monday without mutating d
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

export function getTodayStartISO(): string {
  const d = new Date();
  // Build a Date at local-calendar midnight (00:00:00 local time) then convert to
  // ISO so the resulting UTC timestamp correctly represents "start of today" in
  // the user's timezone, not UTC midnight.
  const localMidnight = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0, 0, 0, 0,
  );
  return localMidnight.toISOString();
}

export function getTodayDayOfWeek(): number {
  return new Date().getDay();
}
