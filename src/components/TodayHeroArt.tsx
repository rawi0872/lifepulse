"use client";

import { useMemo } from "react";
import { useLifePulseWebTheme } from "@/components/theme-provider";

type HeroArtProps = {
  className?: string;
};

/**
 * Web Today hero atmosphere — parity with mobile TodayHeroArt.
 * Dark = night mountain ridge + moon glow (Signature Pulse).
 * Light = sunrise ridge + sun glow + botanical wash (Warm Human Premium).
 * Decorative only: no text, pointer-events none, scales safely.
 */
export function TodayHeroArt({ className = "" }: HeroArtProps) {
  const { resolved } = useLifePulseWebTheme();
  const dark = resolved === "dark";

  const art = useMemo(() => {
    if (dark) {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 120"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          <ellipse cx="310" cy="24" rx="70" ry="30" fill="var(--hero-glow)" opacity="0.55" />
          <circle cx="310" cy="24" r="13" fill="#DCE9F7" opacity="0.8" />
          <circle cx="305" cy="21" r="12" fill="var(--hero-sky)" opacity="0.4" />
          <path
            d="M0 95 L50 65 L100 88 L150 58 L220 88 L270 70 L400 95 L400 120 L0 120 Z"
            fill="var(--hero-ridge)"
            opacity="0.85"
          />
          <path
            d="M0 108 L65 90 L120 105 L180 85 L240 102 L400 95 L400 120 L0 120 Z"
            fill="#0E2138"
            opacity="0.75"
          />
        </svg>
      );
    }
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 120"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <ellipse cx="200" cy="38" rx="120" ry="42" fill="var(--hero-glow)" opacity="0.65" />
        <circle cx="200" cy="40" r="16" fill="#F5B96B" opacity="0.8" />
        <circle cx="200" cy="40" r="22" fill="#F5B96B" opacity="0.12" />
        <path
          d="M0 92 L60 68 L115 90 L170 65 L230 88 L290 76 L400 90 L400 120 L0 120 Z"
          fill="var(--hero-ridge)"
          opacity="0.8"
        />
        <path
          d="M0 110 L75 92 L140 112 L210 94 L280 110 L400 102 L400 120 L0 120 Z"
          fill="#DCCBAE"
          opacity="0.55"
        />
        <path
          d="M30 115 q4 -10 11 -14 q-1 7 -4 12 q6 -4 10 -4 q-6 6 -17 6 Z"
          fill="#9DB98A"
          opacity="0.6"
        />
        <path
          d="M370 117 q-4 -10 -11 -14 q2 8 4 14 q-6 -3 -10 -3 q6 6 18 6 Z"
          fill="#9DB98A"
          opacity="0.5"
        />
      </svg>
    );
  }, [dark]);

  return (
    <div
      className={`pointer-events-none overflow-hidden absolute inset-x-0 top-0 h-[140px] ${className}`}
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {art}
    </div>
  );
}