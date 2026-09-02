import React from "react";
import { Svg, Path } from "react-native-svg";

export function Chevron({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const ChevronRight = Chevron;
