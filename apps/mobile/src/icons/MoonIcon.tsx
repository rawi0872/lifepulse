import React from "react";
import { Svg, Path } from "react-native-svg";

export function MoonIcon({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path d="M21 12.8A9 9 0 1 1 11.1 3a6.8 6.8 0 0 0 9.9 9.8Z" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
