import React from "react";
import { Svg, Path } from "react-native-svg";

export function BellIcon({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path d="M6 8.5A6 6 0 0 1 18 8.5c0 6.2-3 5.2-3 8H9c0-2.8-3-1.8-3-8Z" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.2 19.5A1.8 1.8 0 0 0 13.8 19.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
