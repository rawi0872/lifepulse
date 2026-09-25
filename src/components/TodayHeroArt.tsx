"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [mounted, setMounted] = useState(false);
  const dark = mounted ? resolved === "dark" : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  const art = useMemo(() => {
    if (!mounted) {
      return null;
    }
    if (dark) {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 140"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Moon glow - positioned top-right, subtle */}
          <ellipse cx="340" cy="30" rx="80" ry="40" fill="var(--hero-glow)" opacity="0.45" />
          {/* Moon - smaller, positioned to not clash with greeting */}
          <circle cx="340" cy="30" r="14" fill="#DCE9F7" opacity="0.75" />
          <circle cx="335" cy="26" r="11" fill="var(--hero-sky)" opacity="0.35" />
          {/* Mountain ridge - lower, integrates with content */}
          <path
            d="M0 105 L60 80 L110 100 L160 75 L220 100 L280 85 L340 105 L400 95 L400 140 L0 140 Z"
            fill="var(--hero-ridge)"
            opacity="0.9"
          />
          <path
            d="M0 118 L70 100 L130 115 L190 95 L250 112 L310 105 L370 118 L400 110 L400 140 L0 140 Z"
            fill="#0E2138"
            opacity="0.65"
          />
        </svg>
      );
    }
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 140"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        {/* Sun glow - warm, centered */}
        <ellipse cx="200" cy="45" rx="140" ry="50" fill="var(--hero-glow)" opacity="0.55" />
        {/* Sun - centered, not floating */}
        <circle cx="200" cy="50" r="18" fill="#F5B96B" opacity="0.75" />
        <circle cx="200" cy="50" r="24" fill="#F5B96B" opacity="0.1" />
        {/* Mountain ridge - lower, anchors the composition */}
        <path
          d="M0 105 L65 82 L125 100 L185 78 L245 100 L305 85 L365 102 L400 98 L400 140 L0 140 Z"
          fill="var(--hero-ridge)"
          opacity="0.8"
        />
        <path
          d="M0 120 L80 102 L150 118 L220 98 L290 115 L350 110 L400 118 L400 140 L0 140 Z"
          fill="#DCCBAE"
          opacity="0.5"
        />
        {/* Botanical accents - subtle, anchored at base */}
        <path
          d="M30 125 q5 -12 14 -16 q-2 9 -5 14 q7 -5 12 -5 q-7 8 -19 8 Z"
          fill="#9DB98A"
          opacity="0.5"
        />
        <path
          d="M370 127 q-5 -12 -14 -16 q2 8 5 14 q-7 -4 -12 -4 q7 7 20 7 Z"
          fill="#9DB98A"
          opacity="0.4"
        />
      </svg>
    );
  }, [dark, mounted]);

  if (!mounted) {
    return <div className={`pointer-events-none overflow-hidden absolute inset-x-0 top-0 h-[140px] ${className}`} style={{ zIndex: -1 }} aria-hidden="true" />;
  }

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