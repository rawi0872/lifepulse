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
          viewBox="0 0 400 220"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Moon glow - positioned top-right, subtle */}
          <ellipse cx="340" cy="30" rx="90" ry="45" fill="var(--hero-glow)" opacity="0.4" />
          {/* Moon - smaller, positioned to not clash with greeting */}
          <circle cx="340" cy="28" r="14" fill="#DCE9F7" opacity="0.7" />
          <circle cx="335" cy="24" r="10" fill="var(--hero-sky)" opacity="0.3" />
          {/* Mountain ridge - extends lower, integrates with UP NEXT area */}
          <path
            d="M0 140 L50 115 L100 135 L150 110 L200 130 L260 115 L310 128 L370 120 L400 130 L400 220 L0 220 Z"
            fill="var(--hero-ridge)"
            opacity="0.9"
          />
          <path
            d="M0 155 L60 135 L120 150 L180 125 L240 142 L300 135 L360 145 L400 140 L400 220 L0 220 Z"
            fill="#0E2138"
            opacity="0.6"
          />
        </svg>
      );
    }
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        {/* Sun glow - warm, centered, larger */}
        <ellipse cx="200" cy="55" rx="160" ry="65" fill="var(--hero-glow)" opacity="0.5" />
        {/* Sun - centered, not floating */}
        <circle cx="200" cy="60" r="20" fill="#F5B96B" opacity="0.7" />
        <circle cx="200" cy="60" r="28" fill="#F5B96B" opacity="0.08" />
        {/* Mountain ridge - lower, anchors the composition, extends to UP NEXT area */}
        <path
          d="M0 145 L60 122 L115 140 L170 118 L230 138 L290 125 L355 138 L400 130 L400 220 L0 220 Z"
          fill="var(--hero-ridge)"
          opacity="0.8"
        />
        <path
          d="M0 165 L75 142 L145 158 L215 138 L285 152 L350 145 L400 148 L400 220 L0 220 Z"
          fill="#DCCBAE"
          opacity="0.5"
        />
        {/* Botanical accents - subtle, anchored at base */}
        <path
          d="M30 185 q6 -14 16 -18 q-2 11 -6 16 q8 -6 14 -6 q-8 10 -22 10 Z"
          fill="#9DB98A"
          opacity="0.5"
        />
        <path
          d="M370 188 q-6 -14 -16 -18 q2 9 6 16 q-7 -4 -12 -4 q8 8 23 8 Z"
          fill="#9DB98A"
          opacity="0.4"
        />
      </svg>
    );
  }, [dark, mounted]);

  if (!mounted) {
    return <div className={`pointer-events-none overflow-hidden absolute inset-x-0 top-0 h-[220px] ${className}`} style={{ zIndex: -1 }} aria-hidden="true" />;
  }

  return (
    <div
      className={`pointer-events-none overflow-hidden absolute inset-x-0 top-0 h-[220px] ${className}`}
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {art}
    </div>
  );
}