import React from "react";
import { Svg, Path } from "react-native-svg";

export function Close({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
