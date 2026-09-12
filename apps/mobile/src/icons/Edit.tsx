import React from "react";
import { Svg, Path } from "react-native-svg";

export function Edit({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4.5 1.5L5 15 16.5 3.5z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
