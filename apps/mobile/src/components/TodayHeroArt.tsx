import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { useLifePulseTheme } from "../../lib/theme-provider";
import type { DayCyclePhase } from "../../lib/theme";

/**
 * Lightweight bundled Today hero atmosphere.
 * Dark  = night mountain ridge + moon glow (Signature Pulse).
 * Light = sunrise ridge + sun glow + botanical wash (Warm Human Premium).
 * Day Cycle phases: morning, afternoon, evening, night
 * Decorative only: no text baked in, pointer-events none, scales safely.
 */
type HeroVariant = DayCyclePhase | "day";

export function TodayHeroArt() {
  const { resolvedMode, colors, dayCyclePhase } = useLifePulseTheme();
  // Day Cycle drives the variant directly; otherwise fall back to the
  // resolved binary theme (dark → night, light → day).
  const variant: HeroVariant = dayCyclePhase ?? (resolvedMode === "dark" ? "night" : "day");
  const art = useMemo(() => {
    if (variant === "night") {
      return (
        <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice">
          {/* Moon glow - positioned top-right, subtle */}
          <Ellipse cx="340" cy="30" rx="90" ry="45" fill={colors.heroGlow} opacity={0.4} />
          {/* Moon - smaller, positioned to not clash with greeting */}
          <Circle cx="340" cy="28" r="14" fill="#DCE9F7" opacity={0.7} />
          <Circle cx="335" cy="24" r="10" fill={colors.heroSky} opacity={0.3} />
          {/* Mountain ridge - extends lower, integrates with UP NEXT area */}
          <Path d="M0 140 L50 115 L100 135 L150 110 L200 130 L260 115 L310 128 L370 120 L400 130 L400 220 L0 220 Z" fill={colors.heroRidge} opacity={0.9} />
          <Path d="M0 155 L60 135 L120 150 L180 125 L240 142 L300 135 L360 145 L400 140 L400 220 L0 220 Z" fill="#0E2138" opacity={0.6} />
        </Svg>
      );
    }
    if (variant === "morning") {
      return (
        <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice">
          {/* Sunrise glow - low, warm, rising from the ridge */}
          <Ellipse cx="200" cy="95" rx="160" ry="60" fill={colors.heroGlow} opacity={0.55} />
          {/* Rising sun - sits just above the ridge line */}
          <Circle cx="200" cy="100" r="19" fill="#F5B96B" opacity={0.8} />
          <Circle cx="200" cy="100" r="28" fill="#F5B96B" opacity={0.12} />
          {/* Layered ridges */}
          <Path d="M0 148 L60 126 L115 144 L170 122 L230 142 L290 129 L355 142 L400 134 L400 220 L0 220 Z" fill={colors.heroRidge} opacity={0.85} />
          <Path d="M0 168 L75 146 L145 162 L215 142 L285 156 L350 149 L400 152 L400 220 L0 220 Z" fill={colors.heroRidge} opacity={0.45} />
          {/* Botanical accents - subtle, anchored at base */}
          <Path d="M30 188 q6 -14 16 -18 q-2 11 -6 16 q8 -6 14 -6 q-8 10 -22 10 Z" fill="#9DB98A" opacity={0.5} />
          <Path d="M370 190 q-6 -14 -16 -18 q2 9 6 16 q-8 -5 -14 -5 q8 8 23 8 Z" fill="#9DB98A" opacity={0.4} />
        </Svg>
      );
    }
    if (variant === "evening") {
      return (
        <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice">
          {/* Dusk glow - low amber wash */}
          <Ellipse cx="200" cy="90" rx="170" ry="62" fill={colors.heroGlow} opacity={0.6} />
          {/* Setting sun - low and warm */}
          <Circle cx="200" cy="98" r="21" fill="#E8913A" opacity={0.85} />
          <Circle cx="200" cy="98" r="32" fill="#E8913A" opacity={0.12} />
          {/* Deeper dusk ridges */}
          <Path d="M0 142 L55 118 L110 138 L165 112 L225 134 L285 120 L350 134 L400 126 L400 220 L0 220 Z" fill={colors.heroRidge} opacity={0.85} />
          <Path d="M0 162 L70 138 L140 156 L210 132 L280 148 L350 142 L400 146 L400 220 L0 220 Z" fill={colors.heroRidge} opacity={0.5} />
        </Svg>
      );
    }
    if (variant === "afternoon") {
      return (
        <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice">
          {/* Bright noon glow - centered, crisp */}
          <Ellipse cx="200" cy="45" rx="140" ry="55" fill={colors.heroGlow} opacity={0.45} />
          {/* High sun - centered, bright */}
          <Circle cx="200" cy="50" r="18" fill="#F5B96B" opacity={0.9} />
          <Circle cx="200" cy="50" r="26" fill="#F5B96B" opacity={0.06} />
          {/* Sharp, warm ridges */}
          <Path d="M0 145 L60 122 L115 140 L170 118 L230 138 L290 125 L355 138 L400 130 L400 220 L0 220 Z" fill={colors.heroRidge} opacity={0.9} />
          <Path d="M0 165 L75 142 L145 158 L215 138 L285 152 L350 145 L400 148 L400 220 L0 220 Z" fill="#DCCBAE" opacity={0.4} />
          {/* Botanical accents - subtle, anchored at base */}
          <Path d="M30 185 q6 -14 16 -18 q-2 11 -6 16 q8 -6 14 -6 q-8 10 -22 10 Z" fill="#9DB98A" opacity={0.5} />
          <Path d="M370 188 q-6 -14 -16 -18 q2 9 6 16 q-8 -5 -14 -5 q8 8 23 8 Z" fill="#9DB98A" opacity={0.4} />
        </Svg>
      );
    }
    // day (fallback) — bright calm daylight
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice">
        {/* Sun glow - warm, centered, larger */}
        <Ellipse cx="200" cy="55" rx="160" ry="65" fill={colors.heroGlow} opacity={0.5} />
        {/* Sun - centered, not floating */}
        <Circle cx="200" cy="60" r="20" fill="#F5B96B" opacity={0.7} />
        <Circle cx="200" cy="60" r="28" fill="#F5B96B" opacity={0.08} />
        {/* Mountain ridge - lower, anchors the composition, extends to UP NEXT area */}
        <Path d="M0 145 L60 122 L115 140 L170 118 L230 138 L290 125 L355 138 L400 130 L400 220 L0 220 Z" fill={colors.heroRidge} opacity={0.8} />
        <Path d="M0 165 L75 142 L145 158 L215 138 L285 152 L350 145 L400 148 L400 220 L0 220 Z" fill="#DCCBAE" opacity={0.5} />
        {/* Botanical accents - subtle, anchored at base */}
        <Path d="M30 185 q6 -14 16 -18 q-2 11 -6 16 q8 -6 14 -6 q-8 10 -22 10 Z" fill="#9DB98A" opacity={0.5} />
        <Path d="M370 188 q-6 -14 -16 -18 q2 9 6 16 q-8 -5 -14 -5 q8 8 23 8 Z" fill="#9DB98A" opacity={0.4} />
      </Svg>
    );
  }, [variant, colors]);
  return <View style={styles.root} pointerEvents="none" accessibilityElementsHidden>{art}</View>;
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    opacity: 1,
    overflow: "hidden",
    zIndex: -1,
  },
});
