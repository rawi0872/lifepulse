import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { useLifePulseTheme } from "../../lib/theme-provider";

/**
 * Lightweight bundled Today hero atmosphere.
 * Dark  = night mountain ridge + moon glow (Signature Pulse).
 * Light = sunrise ridge + sun glow + botanical wash (Warm Human Premium).
 * Decorative only: no text baked in, pointer-events none, scales safely.
 */
export function TodayHeroArt() {
  const { resolvedMode, colors } = useLifePulseTheme();
  const dark = resolvedMode === "dark";
  const art = useMemo(() => {
    if (dark) {
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
  }, [dark, colors]);
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
