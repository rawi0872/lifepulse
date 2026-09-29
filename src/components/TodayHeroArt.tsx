"use client";

import { useEffect, useMemo, useState } from "react";
import { useLifePulseWebTheme } from "@/components/theme-provider";

type HeroArtProps = {
  className?: string;
};

/**
 * Web Today hero atmosphere — parity with mobile TodayHeroArt.
 * Four phases: morning, afternoon, evening, night
 * Decorative only: no text, pointer-events none, scales safely.
 * Desktop: bounded hero region ~180-200px tall, landscape orientation.
 */
export function TodayHeroArt({ className = "" }: HeroArtProps) {
  const { resolved, dayCyclePhase } = useLifePulseWebTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the active variant: day cycle phase if active, otherwise resolved light/dark
  const variant = dayCyclePhase ?? (resolved === "dark" ? "night" : "day");

  const art = useMemo(() => {
    if (!mounted) {
      return null;
    }

    // Night / Dark variant
    if (variant === "night") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 180"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Moon glow - positioned top-right, subtle */}
          <ellipse cx="340" cy="25" rx="85" ry="38" fill="var(--hero-glow)" opacity="0.4" />
          {/* Moon - smaller, positioned to not clash with greeting */}
          <circle cx="340" cy="23" r="12" fill="#DCE9F7" opacity="0.7" />
          <circle cx="335" cy="19" r="8" fill="var(--hero-sky)" opacity="0.3" />
          {/* Mountain ridge - lower, integrates with UP NEXT area */}
          <path
            d="M0 115 L45 95 L95 110 L140 90 L190 105 L240 95 L285 103 L340 98 L400 105 L400 180 L0 180 Z"
            fill="var(--hero-ridge)"
            opacity="0.9"
          />
          <path
            d="M0 125 L55 110 L110 122 L165 105 L220 118 L275 113 L335 120 L400 115 L400 180 L0 180 Z"
            fill="#0E2138"
            opacity="0.6"
          />
        </svg>
      );
    }

    // Morning variant - soft sunrise
    if (variant === "morning") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 180"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Sunrise glow - low, warm, rising from the ridge */}
          <ellipse cx="200" cy="85" rx="150" ry="50" fill="var(--hero-glow)" opacity="0.55" />
          {/* Rising sun - sits just above the ridge line */}
          <circle cx="200" cy="90" r="16" fill="#F5B96B" opacity={0.8} />
          <circle cx="200" cy="90" r="24" fill="#F5B96B" opacity={0.12} />
          {/* Layered ridges */}
          <path
            d="M0 120 L55 102 L105 115 L155 98 L210 112 L265 103 L320 110 L400 105 L400 180 L0 180 Z"
            fill="var(--hero-ridge)"
            opacity={0.85}
          />
          <path
            d="M0 135 L65 118 L130 130 L195 115 L260 125 L325 120 L400 118 L400 180 L0 180 Z"
            fill="var(--hero-ridge)"
            opacity={0.45}
          />
          {/* Botanical accents - subtle, anchored at base */}
          <path
            d="M25 155 q5 -12 14 -15 q-2 10 -5 14 q7 -5 12 -5 q-7 9 -18 9 Z"
            fill="#9DB98A"
            opacity={0.5}
          />
          <path
            d="M375 157 q-5 -12 -14 -15 q2 9 5 14 q-7 -4 -11 -4 q7 7 19 7 Z"
            fill="#9DB98A"
            opacity={0.4}
          />
        </svg>
      );
    }

    // Afternoon variant - bright calm daylight
    if (variant === "afternoon") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 180"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Bright noon glow - centered, crisp */}
          <ellipse cx="200" cy="40" rx="130" ry="48" fill="var(--hero-glow)" opacity="0.45" />
          {/* High sun - centered, bright */}
          <circle cx="200" cy="45" r="15" fill="#F5B96B" opacity={0.9} />
          <circle cx="200" cy="45" r="22" fill="#F5B96B" opacity={0.06} />
          {/* Sharp, warm ridges */}
          <path
            d="M0 118 L50 98 L100 112 L150 95 L205 110 L260 100 L315 108 L400 102 L400 180 L0 180 Z"
            fill="var(--hero-ridge)"
            opacity={0.9}
          />
          <path
            d="M0 132 L60 112 L120 125 L180 108 L240 120 L300 112 L365 115 L400 112 L400 180 L0 180 Z"
            fill="#DCCBAE"
            opacity={0.4}
          />
          {/* Botanical accents - subtle, anchored at base */}
          <path
            d="M25 152 q5 -12 14 -15 q-2 10 -5 14 q7 -5 12 -5 q-7 9 -18 9 Z"
            fill="#9DB98A"
            opacity={0.5}
          />
          <path
            d="M375 155 q-5 -12 -14 -15 q2 9 5 14 q-7 -4 -11 -4 q7 7 19 7 Z"
            fill="#9DB98A"
            opacity={0.4}
          />
        </svg>
      );
    }

    // Evening variant - dusk glow, low amber wash
    if (variant === "evening") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 180"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Dusk glow - low amber wash */}
          <ellipse cx="200" cy="80" rx="155" ry="52" fill="var(--hero-glow)" opacity="0.6" />
          {/* Setting sun - low and warm */}
          <circle cx="200" cy="88" r="18" fill="#E8913A" opacity={0.85} />
          <circle cx="200" cy="88" r="26" fill="#E8913A" opacity={0.12} />
          {/* Deeper dusk ridges */}
          <path
            d="M0 115 L50 95 L105 110 L155 90 L210 108 L265 98 L325 108 L400 102 L400 180 L0 180 Z"
            fill="var(--hero-ridge)"
            opacity={0.85}
          />
          <path
            d="M0 130 L60 110 L120 122 L180 102 L245 115 L310 108 L370 112 L400 108 L400 180 L0 180 Z"
            fill="var(--hero-ridge)"
            opacity={0.5}
          />
        </svg>
      );
    }

    // Day (fallback) - bright calm daylight
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 180"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        {/* Sun glow - warm, centered, larger */}
        <ellipse cx="200" cy="45" rx="140" ry="52" fill="var(--hero-glow)" opacity="0.5" />
        {/* Sun - centered, not floating */}
        <circle cx="200" cy="50" r="17" fill="#F5B96B" opacity={0.7} />
        <circle cx="200" cy="50" r="24" fill="#F5B96B" opacity={0.08} />
        {/* Mountain ridge - lower, anchors the composition, extends to UP NEXT area */}
        <path
          d="M0 118 L50 98 L100 112 L150 95 L205 110 L260 100 L315 108 L400 102 L400 180 L0 180 Z"
          fill="var(--hero-ridge)"
          opacity={0.8}
        />
        <path
          d="M0 132 L60 112 L120 125 L180 108 L240 120 L300 112 L365 115 L400 112 L400 180 L0 180 Z"
          fill="#DCCBAE"
          opacity={0.5}
        />
        {/* Botanical accents - subtle, anchored at base */}
        <path
          d="M25 152 q5 -12 14 -15 q-2 10 -5 14 q7 -5 12 -5 q-7 9 -18 9 Z"
          fill="#9DB98A"
          opacity={0.5}
        />
        <path
          d="M375 155 q-5 -12 -14 -15 q2 9 5 14 q-7 -4 -11 -4 q7 7 19 7 Z"
          fill="#9DB98A"
          opacity={0.4}
        />
      </svg>
    );
  }, [variant, mounted]);

  if (!mounted) {
    return <div className={`pointer-events-none overflow-hidden absolute inset-x-0 top-0 h-[180px] ${className}`} style={{ zIndex: -1 }} aria-hidden="true" />;
  }

  return (
    <div
      className={`pointer-events-none overflow-hidden absolute inset-x-0 top-0 h-[180px] ${className}`}
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      {art}
    </div>
  );
}