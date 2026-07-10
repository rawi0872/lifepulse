"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface Realm {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface QuickDraftData {
  title: string;
  realmId: string;
  category: string;
  suggestedTasks: string[];
}

export const TASK_TEMPLATES: Record<string, string[]> = {
  music: [
    "Define the exact skill or song to improve",
    "Practice for 30 minutes",
    "Record one short progress video",
    "Review weak spots",
    "Schedule the next practice block",
  ],
  body: [
    "Choose workout days",
    "Take starting measurements",
    "Complete first workout",
    "Prepare simple meal plan",
    "Track progress weekly",
  ],
  study: [
    "List topics to revise",
    "Create study blocks",
    "Solve one practice set",
    "Review mistakes",
    "Schedule mock exam",
  ],
  business: [
    "Define the target customer",
    "List the first MVP features",
    "Talk to one potential user",
    "Build first version",
    "Review feedback",
  ],
  generic: [
    "Define the outcome clearly",
    "Break it into first 3 tasks",
    "Set a next action",
    "Review progress this week",
  ],
};

export function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(guitar|music|singing|piano|drum|song|melody|band|solo|chord)\b/.test(lower)) return "music";
  if (/\b(workout|body|health|weight|gym|exercise|fitness|diet|run|lift|cardio|muscle)\b/.test(lower)) return "body";
  if (/\b(exam|study|physics|school|course|test|class|lesson|university|college|grade|subject)\b/.test(lower)) return "study";
  if (/\b(startup|business|money|client|revenue|launch|sell|market|invest|income|company)\b/.test(lower)) return "business";
  return "generic";
}

export function guessRealm(text: string, realms: Realm[]): string {
  const lower = text.toLowerCase();
  for (const r of realms) {
    const rn = r.name.toLowerCase();
    if (/\b(music|guitar|singing|piano|song)\b/.test(lower) && /\b(music|guitar|song|piano|sing)\b/.test(rn)) return r.id;
    if (/\b(body|health|workout|gym|fitness|diet|exercise)\b/.test(lower) && /\b(body|health|fitness|wellness|gym|workout)\b/.test(rn)) return r.id;
    if (/\b(study|exam|school|college|course|learn|education|physics|math)\b/.test(lower) && /\b(mind|study|brain|education|intellect|school)\b/.test(rn)) return r.id;
    if (/\b(business|startup|money|revenue|company|income|finance|invest|career)\b/.test(lower) && /\b(career|business|finance|work|money|entrepreneur)\b/.test(rn)) return r.id;
    if (/\b(faith|prayer|religion|god|spiritual|bible|worship)\b/.test(lower) && /\b(faith|religion|spiritual|prayer)\b/.test(rn)) return r.id;
  }
  return "";
}

interface QuickDraftWizardProps {
  realms: Realm[];
  quickInput: string;
  onQuickInputChange: (value: string) => void;
  onQuickDraft: () => void;
  quickDraft: QuickDraftData | null;
  selectedTaskIdx: Set<number>;
  onToggleSuggestion: (index: number) => void;
  saving: boolean;
  onSaveQuickDraft: () => void;
  onCancelQuickDraft: () => void;
}

export function QuickDraftWizard({
  realms,
  quickInput,
  onQuickInputChange,
  onQuickDraft,
  quickDraft,
  selectedTaskIdx,
  onToggleSuggestion,
  saving,
  onSaveQuickDraft,
  onCancelQuickDraft,
}: QuickDraftWizardProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onQuickDraft();
  }

  return (
    <Card className="mb-6 border-[var(--border-strong)]">
      <div className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Quick plan</h2>
        </div>
        <p className="text-pretty text-xs text-[var(--text-muted)]">
          Describe what you want to achieve. Life Pulse will turn it into a project draft.
        </p>
        <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={quickInput}
            onChange={(e) => onQuickInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Example: Improve my guitar soloing by September"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none sm:py-2"
          />
          <Button className="w-full sm:w-auto" onClick={onQuickDraft} disabled={!quickInput.trim()}>
            Create plan
          </Button>
        </div>

        {quickDraft && (
          <div className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-ghost)] p-4">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="min-w-0 text-pretty text-sm font-semibold text-[var(--accent)]">Draft: {quickDraft.title}</h3>
              {quickDraft.realmId && realms.find((r) => r.id === quickDraft.realmId) && (
                <span
                  className="w-fit rounded-full px-2 py-1 text-[10px] sm:py-0.5"
                  style={{
                    backgroundColor: realms.find((r) => r.id === quickDraft.realmId)!.color + "20",
                    color: realms.find((r) => r.id === quickDraft.realmId)!.color,
                  }}
                >
                  {realms.find((r) => r.id === quickDraft.realmId)!.icon}{" "}
                  {realms.find((r) => r.id === quickDraft.realmId)!.name}
                </span>
              )}
            </div>

            <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Suggested tasks
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {quickDraft.suggestedTasks.map((t, i) => (
                <label
                  key={i}
                  className="flex min-w-0 cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-xs text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--surface-raised)] sm:items-center sm:py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={selectedTaskIdx.has(i)}
                    onChange={() => onToggleSuggestion(i)}
                    className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] focus:ring-[var(--accent)]/30 focus:ring-offset-0 hover:border-[var(--accent)]/50"
                  />
                  <span className="min-w-0 text-pretty">{t}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
              <Button size="sm" onClick={onSaveQuickDraft} disabled={saving}>
                {saving ? "Saving..." : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Save project
                  </>
                )}
              </Button>
              <Button variant="secondary" size="sm" onClick={onCancelQuickDraft}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
