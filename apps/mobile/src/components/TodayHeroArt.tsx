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
        <Svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="xMidYMax slice">
          <Ellipse cx="310" cy="42" rx="90" ry="46" fill={colors.heroGlow} opacity={0.7} />
          <Circle cx="310" cy="42" r="20" fill="#DCE9F7" opacity={0.9} />
          <Circle cx="303" cy="36" r="20" fill={colors.heroSky} opacity={0.55} />
          <Path d="M0 130 L70 84 L130 122 L200 78 L270 124 L330 92 L400 128 L400 180 L0 180 Z" fill={colors.heroRidge} opacity={0.95} />
          <Path d="M0 150 L90 118 L170 148 L260 116 L340 146 L400 132 L400 180 L0 180 Z" fill="#0E2138" opacity={0.9} />
        </Svg>
      );
    }
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="xMidYMax slice">
        <Ellipse cx="200" cy="60" rx="150" ry="60" fill={colors.heroGlow} opacity={0.8} />
        <Circle cx="200" cy="62" r="24" fill="#F5B96B" opacity={0.9} />
        <Circle cx="200" cy="62" r="34" fill="#F5B96B" opacity={0.18} />
        <Path d="M0 128 L80 88 L150 120 L220 84 L300 122 L360 100 L400 118 L400 180 L0 180 Z" fill={colors.heroRidge} opacity={0.9} />
        <Path d="M0 150 L100 124 L190 150 L280 126 L360 148 L400 140 L400 180 L0 180 Z" fill="#DCCBAE" opacity={0.65} />
        <Path d="M40 160 q6 -18 16 -24 q-2 14 -6 20 q8 -6 14 -6 q-8 10 -24 10 Z" fill="#9DB98A" opacity={0.7} />
        <Path d="M350 162 q-6 -16 -16 -22 q2 12 6 18 q-8 -5 -13 -5 q8 9 23 9 Z" fill="#9DB98A" opacity={0.6} />
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
    height: 210,
    opacity: 1,
    overflow: "hidden",
  },
});
