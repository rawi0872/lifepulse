import React from "react";
import { Svg, Path } from "react-native-svg";
export function WealthIcon({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path d="M4 20V10M8 20V14M12 20V8M16 20V12M20 20V16" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 20H21" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
