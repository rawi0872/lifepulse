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
        <Svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice">
          <Ellipse cx="310" cy="24" rx="70" ry="30" fill={colors.heroGlow} opacity={0.55} />
          <Circle cx="310" cy="24" r="13" fill="#DCE9F7" opacity={0.8} />
          <Circle cx="305" cy="21" r="12" fill={colors.heroSky} opacity={0.4} />
          <Path d="M0 95 L50 65 L100 88 L150 58 L220 88 L270 70 L400 95 L400 120 L0 120 Z" fill={colors.heroRidge} opacity={0.85} />
          <Path d="M0 108 L65 90 L120 105 L180 85 L240 102 L400 95 L400 120 L0 120 Z" fill="#0E2138" opacity={0.75} />
        </Svg>
      );
    }
    return (
      <Svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice">
        <Ellipse cx="200" cy="38" rx="120" ry="42" fill={colors.heroGlow} opacity={0.65} />
        <Circle cx="200" cy="40" r="16" fill="#F5B96B" opacity={0.8} />
        <Circle cx="200" cy="40" r="22" fill="#F5B96B" opacity={0.12} />
        <Path d="M0 92 L60 68 L115 90 L170 65 L230 88 L290 76 L400 90 L400 120 L0 120 Z" fill={colors.heroRidge} opacity={0.8} />
        <Path d="M0 110 L75 92 L140 112 L210 94 L280 110 L400 102 L400 120 L0 120 Z" fill="#DCCBAE" opacity={0.55} />
        <Path d="M30 115 q4 -10 11 -14 q-1 7 -4 12 q6 -4 10 -4 q-6 6 -17 6 Z" fill="#9DB98A" opacity={0.6} />
        <Path d="M370 117 q-4 -10 -11 -14 q2 8 4 14 q-6 -3 -10 -3 q6 6 18 6 Z" fill="#9DB98A" opacity={0.5} />
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
