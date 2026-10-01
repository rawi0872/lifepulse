"use client";

import { useEffect, useMemo, useState } from "react";
import { useLifePulseWebTheme } from "@/components/theme-provider";

type HeroArtProps = {
  className?: string;
};

/**
 * Web Today hero atmosphere — parity with mobile TodayHeroArt.
 * Four phases: morning, afternoon, evening, night.
 * Decorative only: no text, pointer-events none, scales safely.
 *
 * Desktop-native geometry: wide 1200x220 landscape viewBox so the
 * composition (sun/moon, glow, ridges, botanicals) survives the
 * horizontal `slice` crop on desktop widths. Same fills, opacities,
 * and y-language as mobile — only extended horizontally.
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

    // Night / Dark variant — Signature Pulse moon + ridge
    if (variant === "night") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 220"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Moon glow - top-right, subtle */}
          <ellipse cx="960" cy="32" rx="260" ry="42" fill="var(--hero-glow)" opacity="0.4" />
          {/* Moon - positioned to not clash with greeting */}
          <circle cx="960" cy="28" r="14" fill="#DCE9F7" opacity={0.7} />
          <circle cx="954" cy="24" r="9" fill="var(--hero-sky)" opacity={0.3} />
          {/* Mountain ridge layers - span the full width */}
          <path
            d="M0 140 L120 112 L240 132 L360 108 L480 128 L600 112 L720 126 L840 112 L960 124 L1080 114 L1200 122 L1200 220 L0 220 Z"
            fill="var(--hero-ridge)"
            opacity={0.9}
          />
          <path
            d="M0 158 L140 136 L280 150 L420 128 L560 144 L700 136 L840 146 L980 138 L1120 144 L1200 140 L1200 220 L0 220 Z"
            fill="#0E2138"
            opacity={0.6}
          />
        </svg>
      );
    }

    // Morning variant - soft sunrise rising from the ridge
    if (variant === "morning") {
      return (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 220"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Sunrise glow - low, warm, rising from the ridge */}
          <ellipse cx="600" cy="95" rx="460" ry="58" fill="var(--hero-glow)" opacity={0.55} />
          {/* Rising sun - sits just above the ridge line */}
          <circle cx="600" cy="100" r="19" fill="#F5B96B" opacity={0.8} />
          <circle cx="600" cy="100" r="28" fill="#F5B96B" opacity={0.12} />
          {/* Layered ridges */}
          <path
            d="M0 148 L140 124 L280 142 L420 120 L560 140 L700 128 L840 140 L980 130 L1120 140 L1200 134 L1200 220 L0 220 Z"
            fill="var(--hero-ridge)"
            opacity={0.85}
          />
          <path
            d="M0 168 L170 146 L330 162 L500 142 L660 156 L830 148 L1000 154 L1200 150 L1200 220 L0 220 Z"
            fill="var(--hero-ridge)"
            opacity={0.45}
          />
          {/* Botanical accents - subtle, anchored at base */}
          <path
            d="M60 188 q6 -14 16 -18 q-2 11 -6 16 q8 -6 14 -6 q-8 10 -22 10 Z"
            fill="#9DB98A"
            opacity={0.5}
          />
          <path
            d="M1140 190 q-6 -14 -16 -18 q2 9 6 16 q-8 -5 -14 -5 q8 8 23 8 Z"
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
          viewBox="0 0 1200 220"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Bright noon glow - centered, crisp */}
          <ellipse cx="600" cy="55" rx="430" ry="60" fill="var(--hero-glow)" opacity={0.5} />
          {/* High sun - centered, bright */}
          <circle cx="600" cy="60" r="20" fill="#F5B96B" opacity={0.7} />
          <circle cx="600" cy="60" r="28" fill="#F5B96B" opacity={0.08} />
          {/* Sharp, warm ridges */}
          <path
            d="M0 145 L140 120 L280 138 L420 116 L560 136 L700 124 L840 136 L980 126 L1120 136 L1200 130 L1200 220 L0 220 Z"
            fill="var(--hero-ridge)"
            opacity={0.8}
          />
          <path
            d="M0 165 L170 142 L330 158 L500 138 L660 152 L830 144 L1000 148 L1200 146 L1200 220 L0 220 Z"
            fill="#DCCBAE"
            opacity={0.5}
          />
          {/* Botanical accents - subtle, anchored at base */}
          <path
            d="M60 188 q6 -14 16 -18 q-2 11 -6 16 q8 -6 14 -6 q-8 10 -22 10 Z"
            fill="#9DB98A"
            opacity={0.5}
          />
          <path
            d="M1140 190 q-6 -14 -16 -18 q2 9 6 16 q-8 -5 -14 -5 q8 8 23 8 Z"
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
          viewBox="0 0 1200 220"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          {/* Dusk glow - low amber wash */}
          <ellipse cx="600" cy="90" rx="480" ry="58" fill="var(--hero-glow)" opacity={0.6} />
          {/* Setting sun - low and warm */}
          <circle cx="600" cy="98" r="21" fill="#E8913A" opacity={0.85} />
          <circle cx="600" cy="98" r="32" fill="#E8913A" opacity={0.12} />
          {/* Deeper dusk ridges */}
          <path
            d="M0 142 L140 116 L280 136 L420 110 L560 132 L700 118 L840 132 L980 122 L1120 132 L1200 126 L1200 220 L0 220 Z"
            fill="var(--hero-ridge)"
            opacity={0.85}
          />
          <path
            d="M0 162 L170 138 L330 154 L500 132 L660 146 L830 140 L1000 144 L1200 142 L1200 220 L0 220 Z"
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
        viewBox="0 0 1200 220"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        {/* Sun glow - warm, centered, larger */}
        <ellipse cx="600" cy="60" rx="440" ry="62" fill="var(--hero-glow)" opacity={0.5} />
        {/* Sun - centered, not floating */}
        <circle cx="600" cy="64" r="20" fill="#F5B96B" opacity={0.7} />
        <circle cx="600" cy="64" r="28" fill="#F5B96B" opacity={0.08} />
        {/* Mountain ridge - lower, anchors the composition */}
        <path
          d="M0 145 L140 120 L280 138 L420 116 L560 136 L700 124 L840 136 L980 126 L1120 136 L1200 130 L1200 220 L0 220 Z"
          fill="var(--hero-ridge)"
          opacity={0.8}
        />
        <path
          d="M0 165 L170 142 L330 158 L500 138 L660 152 L830 144 L1000 148 L1200 146 L1200 220 L0 220 Z"
          fill="#DCCBAE"
          opacity={0.5}
        />
        {/* Botanical accents - subtle, anchored at base */}
        <path
          d="M60 188 q6 -14 16 -18 q-2 11 -6 16 q8 -6 14 -6 q-8 10 -22 10 Z"
          fill="#9DB98A"
          opacity={0.5}
        />
        <path
          d="M1140 190 q-6 -14 -16 -18 q2 9 6 16 q-8 -5 -14 -5 q8 8 23 8 Z"
          fill="#9DB98A"
          opacity={0.4}
        />
      </svg>
    );
  }, [variant, mounted]);

  // Fills the dedicated hero section (parent is relative + bounded height).
  // No negative z-index: art paints first, overlay content follows in order.
  if (!mounted) {
    return <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true" />;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {art}
    </div>
  );
}
