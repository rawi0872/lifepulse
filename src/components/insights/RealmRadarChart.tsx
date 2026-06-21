"use client";

import { useMemo, useId } from "react";
import { cn } from "@/lib/utils";

export interface RealmRadarEntry {
  name: string;
  color: string;
  icon: string;
  score: number;
}

interface RealmRadarChartProps {
  realms: RealmRadarEntry[];
  className?: string;
}

// ─── SVG constants ──────────────────────────────────────────────────────────

const VIEWBOX = 400;
const CENTER = 200;
const CHART_RADIUS = 120;
const LABEL_RADIUS = 150;
const ENCLOSURE_OFFSET = 10;
const MIN_RADIUS_PCT = 5;
const ENCLOSURE_RADIUS = CHART_RADIUS + ENCLOSURE_OFFSET;

const EMPTY_REALMS: RealmRadarEntry[] = Array.from({ length: 6 }, () => ({
  name: "",
  color: "",
  icon: "",
  score: 0,
}));

// ─── SVG math helpers ──────────────────────────────────────────────────────

function getChartCoords(
  index: number,
  total: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function buildPolygon(
  entries: RealmRadarEntry[],
  radius: number,
  cx: number,
  cy: number,
  scale: (score: number) => number,
): string {
  return (
    entries
      .map((e, i) => {
        const pt = getChartCoords(i, entries.length, radius * scale(e.score), cx, cy);
        return `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`;
      })
      .join(" ") + "Z"
  );
}

function buildGridRing(
  total: number,
  radius: number,
  cx: number,
  cy: number,
  pct: number,
): string {
  const dummy = Array.from({ length: total }, () => ({
    score: pct,
    name: "",
    color: "",
    icon: "",
  }));
  return buildPolygon(dummy, radius, cx, cy, (s) => s / 100);
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RealmRadarChart({ realms, className }: RealmRadarChartProps) {
  const id = useId();
  const fillId = `${id}-fill`;
  const glowId = `${id}-glow`;
  const dotGlowId = `${id}-dot-glow`;

  const effectiveRealms = realms.length === 0 ? EMPTY_REALMS : realms;
  const total = effectiveRealms.length;
  const hasAnyScore = effectiveRealms.some((r) => r.score > 0);

  // Enclosure / backing panel
  const enclosurePath = useMemo(
    () => buildGridRing(total, ENCLOSURE_RADIUS, CENTER, CENTER, 100),
    [total],
  );

  // Grid rings at 20/40/60/80/100
  const gridRings = useMemo(
    () =>
      [20, 40, 60, 80, 100].map((pct) => ({
        pct,
        d: buildGridRing(total, CHART_RADIUS, CENTER, CENTER, pct),
      })),
    [total],
  );

  // Data polygon
  const dataPolygon = useMemo(() => {
    if (total === 0) return "";
    return buildPolygon(effectiveRealms, CHART_RADIUS, CENTER, CENTER, (s) =>
      Math.max(MIN_RADIUS_PCT / 100, Math.min(1, (s || 0) / 100)),
    );
  }, [effectiveRealms, total]);

  // Axis lines from center to each vertex
  const axisEnds = useMemo(
    () =>
      effectiveRealms.map((r, i) => ({
        ...getChartCoords(i, total, CHART_RADIUS, CENTER, CENTER),
        name: r.name,
      })),
    [effectiveRealms, total],
  );

  // Label positions with smart alignment
  const labelPositions = useMemo(
    () =>
      effectiveRealms.map((r, i) => {
        const pt = getChartCoords(i, total, LABEL_RADIUS, CENTER, CENTER);
        const angleDeg = (360 / total) * i;

        let anchor: "start" | "middle" | "end";
        let dy: string;

        if (angleDeg === 0) {
          anchor = "middle";
          dy = "1.2em";
        } else if (angleDeg === 180) {
          anchor = "middle";
          dy = "-0.5em";
        } else if (angleDeg > 0 && angleDeg < 180) {
          anchor = "start";
          dy = "0.35em";
        } else {
          anchor = "end";
          dy = "0.35em";
        }

        return { ...pt, name: r.name, color: r.color, score: r.score, anchor, dy };
      }),
    [effectiveRealms, total],
  );

  // Vertex dot positions
  const dotPositions = useMemo(
    () =>
      effectiveRealms.map((r, i) => {
        const pct = Math.max(MIN_RADIUS_PCT / 100, Math.min(1, (r.score || 0) / 100));
        return {
          ...getChartCoords(i, total, CHART_RADIUS * pct, CENTER, CENTER),
          score: r.score,
        };
      }),
    [effectiveRealms, total],
  );

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="h-full w-full"
        role="img"
        aria-label={`Life Balance Map showing ${total} life areas${hasAnyScore ? " with current progress" : ""}`}
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={dotGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={fillId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.30" />
            <stop offset="65%" stopColor="currentColor" stopOpacity="0.10" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
          </radialGradient>
        </defs>

        {/* ── Enclosure / backdrop panel ── */}
        <path
          d={enclosurePath}
          fill="var(--surface)"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeOpacity="0.06"
        />

        {/* ── Outer boundary ring (decorative frame) ── */}
        <path
          d={buildGridRing(total, CHART_RADIUS + 4, CENTER, CENTER, 100)}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.04"
        />

        {/* ── Nested grid rings ── */}
        {gridRings.map((ring) => (
          <path
            key={ring.pct}
            d={ring.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={
              ring.pct === 100 ? "1.2" :
              ring.pct === 80 ? "0.8" :
              "0.5"
            }
            opacity={
              ring.pct === 100 ? 0.22 :
              ring.pct === 80 ? 0.14 :
              ring.pct === 60 ? 0.08 :
              ring.pct === 40 ? 0.06 :
              0.05
            }
          />
        ))}

        {/* ── Axis lines ── */}
        {axisEnds.map((pt, i) => (
          <line
            key={effectiveRealms[i]?.name || `axis-${i}`}
            x1={CENTER}
            y1={CENTER}
            x2={pt.x}
            y2={pt.y}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.08"
          />
        ))}

        {/* ── Center node ── */}
        <circle cx={CENTER} cy={CENTER} r="3" fill="currentColor" opacity="0.20" />
        <circle cx={CENTER} cy={CENTER} r="1.2" fill="currentColor" opacity="0.45" />

        {/* ── Data polygon fill ── */}
        {hasAnyScore && dataPolygon && (
          <path
            d={dataPolygon}
            fill={`url(#${fillId})`}
            opacity="0.45"
          />
        )}

        {/* ── Data polygon soft glow ── */}
        {hasAnyScore && dataPolygon && (
          <path
            d={dataPolygon}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.35"
            filter={`url(#${glowId})`}
          />
        )}

        {/* ── Data polygon main outline ── */}
        {hasAnyScore && dataPolygon && (
          <path
            d={dataPolygon}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.55"
          />
        )}

        {/* ── Vertex dots ── */}
        {dotPositions.map((pt, i) => {
          const realm = effectiveRealms[i];
          const score = realm?.score ?? 0;
          const color = realm?.color || "currentColor";
          return (
            <g key={realm?.name || `dot-${i}`}>
              {score > 0 && (
                <>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="7"
                    fill={color}
                    opacity="0.20"
                    filter={`url(#${dotGlowId})`}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill={color}
                    stroke="var(--bg)"
                    strokeWidth="2"
                  />
                </>
              )}
              {score === 0 && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="2.5"
                  fill="currentColor"
                  opacity="0.12"
                />
              )}
            </g>
          );
        })}

        {/* ── Labels (clean text, no emojis) ── */}
        {labelPositions.map((pos) =>
          pos.name ? (
            <g key={pos.name}>
              <text
                x={pos.x}
                y={pos.y}
                dy={pos.dy}
                textAnchor={pos.anchor}
                fill="currentColor"
                fontSize="10"
                fontWeight="600"
                opacity="0.80"
              >
                {pos.name}
              </text>
              <text
                x={pos.x}
                y={pos.y}
                dy={pos.dy ? `${Number.parseFloat(pos.dy) + 1.15}em` : "1.15em"}
                textAnchor={pos.anchor}
                fill="currentColor"
                fontSize="9"
                fontWeight="400"
                opacity="0.40"
              >
                {Math.round(pos.score)}%
              </text>
            </g>
          ) : null,
        )}
      </svg>

      {/* Screen-reader summary */}
      {hasAnyScore && total > 0 && (
        <div className="sr-only" role="status">
          Life Balance Map.{" "}
          {effectiveRealms
            .filter((r) => r.name)
            .map((r) => `${r.name}: ${Math.round(r.score)}%`)
            .join(". ")}
          .
        </div>
      )}
    </div>
  );
}

// ─── Helpers (unchanged logic) ─────────────────────────────────────────────

export function computeRealmScores(
  realmXp: { name: string; color: string; icon: string; xp: number }[],
  getLevelInfoFn: (xp: number) => { level: number; progressPercent: number },
): RealmRadarEntry[] {
  if (!realmXp || realmXp.length === 0) return [];

  return realmXp.map((r) => {
    const info = getLevelInfoFn(r.xp);
    const baseScore = (info.level - 1) * 10;
    const progressBonus = info.progressPercent / 10;
    const score = Math.min(100, Math.round(baseScore + progressBonus));
    return { name: r.name, color: r.color, icon: r.icon, score };
  });
}

export function getStrongestRealm(realms: RealmRadarEntry[]): RealmRadarEntry | null {
  if (realms.length === 0) return null;
  return realms.reduce((a, b) => (a.score >= b.score ? a : b));
}

export function getWeakestRealm(realms: RealmRadarEntry[]): RealmRadarEntry | null {
  if (realms.length === 0) return null;
  return realms.reduce((a, b) => (a.score <= b.score ? a : b));
}

export function computeBalanceScore(realms: RealmRadarEntry[]): number {
  if (realms.length < 2) return 100;
  const avg = realms.reduce((s, r) => s + r.score, 0) / realms.length;
  if (avg === 0) return 100;
  const maxDev = realms.reduce((m, r) => Math.max(m, Math.abs(r.score - avg)), 0);
  return Math.round(Math.max(0, 100 - (maxDev / avg) * 50));
}

export { RealmRadarExpandedDialog } from "./RealmRadarExpandedDialog";

export function generateSuggestion(
  strongest: RealmRadarEntry | null,
  weakest: RealmRadarEntry | null,
): string {
  if (!strongest || !weakest) return "";
  if (strongest.name === weakest.name) return "All areas are equally active. Pick one to focus next.";
  if (weakest.score === 0) return `Get started with ${weakest.name} by linking one habit or task to this area.`;
  if (strongest.score - weakest.score > 40) return `Good focus on ${strongest.name}. Try adding one small action to ${weakest.name} this week.`;
  return `${strongest.name} leads the way. Consider a weekly practice in ${weakest.name} to build balance.`;
}
