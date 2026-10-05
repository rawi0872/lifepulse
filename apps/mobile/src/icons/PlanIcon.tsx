import React from "react";
import { Svg, Path } from "react-native-svg";

// Plan — small flag mark, optically balanced with the other tab icons.
export function PlanIcon({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path d="M5 21V4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M5 5h11l-2.5 3.5L16 12H5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
