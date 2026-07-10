"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { HelpPopover } from "@/components/HelpPopover";
import { getLevelInfo, getRealmTitle } from "@/lib/levels";

interface RealmXp {
  name: string;
  color: string;
  icon: string;
  xp: number;
}

interface RealmLevelListProps {
  realmXp: RealmXp[];
}

export function RealmLevelList({ realmXp }: RealmLevelListProps) {
  const router = useRouter();

  return (
    <div className="mb-6">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="min-w-0 break-words text-sm font-semibold text-[var(--text)]">Life area levels</h2>
          <HelpPopover title="How XP and levels work">
            <p>Completing habits and tasks earns XP. XP goes into your overall level and into the life area connected to that action.</p>
            <p className="mt-1.5">Weekly consistency shows how often you completed expected habit check-ins. Life area levels show where your progress is growing.</p>
          </HelpPopover>
        </div>
        <button
          onClick={() => router.push("/settings")}
          className="min-h-9 shrink-0 rounded-md px-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] sm:min-h-0 sm:px-0"
        >
          Manage
        </button>
      </div>

      {realmXp.length === 0 || realmXp.every((r) => r.xp === 0) ? (
        <Card variant="subtle" className="border-dashed border-[var(--border)]">
          <div className="p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Complete habits or tasks to start leveling up your life areas.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-2">
          {realmXp.map((r) => {
            const info = getLevelInfo(r.xp);
            const title = getRealmTitle(r.name, info.level);
            const xpInLevel = r.xp - info.currentLevelXp;
            const xpRange = info.nextLevelXp - info.currentLevelXp;
            return (
              <Card key={r.name} className="overflow-hidden border-[var(--border-strong)] transition-all duration-150 hover:border-[var(--border-strong)]">
                <div className="flex min-w-0 items-center gap-3 p-4 sm:gap-4 sm:p-5">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm bg-gradient-to-br"
                    style={{
                      backgroundImage: `linear-gradient(to bottom right, ${r.color}33, transparent)`,
                      color: r.color,
                      boxShadow: `inset 0 0 0 1px ${r.color}30`,
                    }}
                  >
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-[var(--text)]">{r.name}</p>
                        <p className="break-words text-[11px] text-[var(--text-muted)]">{title}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-xl font-bold text-[var(--text)]">{info.level}</p>
                          <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Level</p>
                        </div>
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold"
                          style={{
                            backgroundColor: r.color + "15",
                            color: r.color,
                          }}
                        >
                          {r.xp}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)] ring-1 ring-inset ring-[var(--border)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${info.progressPercent}%`, backgroundColor: r.color, boxShadow: `0 1px 3px 0 ${r.color}1A` }}
                      />
                    </div>
                    <p className="mt-1 break-words text-[10px] text-[var(--text-muted)]">
                      {r.xp} XP &middot; {xpInLevel}/{xpRange} to next level
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
