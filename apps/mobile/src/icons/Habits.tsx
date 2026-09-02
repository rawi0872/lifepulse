import React from "react";
import { Svg, Path } from "react-native-svg";

// Simplified repeat — clean loop, legible at 22px without tangled strokes.
export function Habits({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path d="M17 1l3 3-3 3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 11V8.5A3.5 3.5 0 016.5 5H20" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 23l-3-3 3-3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 13v2.5A3.5 3.5 0 0117.5 19H4" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
