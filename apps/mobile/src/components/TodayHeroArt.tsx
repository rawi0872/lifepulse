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
        <Svg width="100%" height="100%" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice">
          {/* Moon glow - positioned top-right, subtle */}
          <Ellipse cx="340" cy="30" rx="80" ry="40" fill={colors.heroGlow} opacity={0.45} />
          {/* Moon - smaller, positioned to not clash with greeting */}
          <Circle cx="340" cy="30" r="14" fill="#DCE9F7" opacity={0.75} />
          <Circle cx="335" cy="26" r="11" fill={colors.heroSky} opacity={0.35} />
          {/* Mountain ridge - lower, integrates with content */}
          <Path d="M0 105 L60 80 L110 100 L160 75 L220 100 L280 85 L340 105 L400 95 L400 140 L0 140 Z" fill={colors.heroRidge} opacity={0.9} />
          <Path d="M0 118 L70 100 L130 115 L190 95 L250 112 L310 105 L370 118 L400 110 L400 140 L0 140 Z" fill="#0E2138" opacity={0.65} />
        </Svg>
      );
    }
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice">
        {/* Sun glow - warm, centered */}
        <Ellipse cx="200" cy="45" rx="140" ry="50" fill={colors.heroGlow} opacity={0.55} />
        {/* Sun - centered, not floating */}
        <Circle cx="200" cy="50" r="18" fill="#F5B96B" opacity={0.75} />
        <Circle cx="200" cy="50" r="24" fill="#F5B96B" opacity={0.1} />
        {/* Mountain ridge - lower, anchors the composition */}
        <Path d="M0 105 L65 82 L125 100 L185 78 L245 100 L305 85 L365 102 L400 98 L400 140 L0 140 Z" fill={colors.heroRidge} opacity={0.8} />
        <Path d="M0 120 L80 102 L150 118 L220 98 L290 115 L350 110 L400 118 L400 140 L0 140 Z" fill="#DCCBAE" opacity={0.5} />
        {/* Botanical accents - subtle, anchored at base */}
        <Path d="M30 125 q5 -12 14 -16 q-2 9 -5 14 q7 -5 12 -5 q-7 8 -19 8 Z" fill="#9DB98A" opacity={0.5} />
        <Path d="M370 127 q-5 -12 -14 -16 q2 8 5 14 q-7 -4 -12 -4 q7 7 20 7 Z" fill="#9DB98A" opacity={0.4} />
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
    height: 140,
    opacity: 1,
    overflow: "hidden",
    zIndex: -1,
  },
});
