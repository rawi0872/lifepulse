import React from "react";
import { Svg, Path } from "react-native-svg";

// Heart + subtle pulse line — restrained health mark, not NEXTRON
export function HealthIcon({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M12 19.2L4.9 12.1A4.1 4.1 0 0 1 12 6.2A4.1 4.1 0 0 1 19.1 12.1L12 19.2Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M7 12H9.2L10.8 9.5L13 15.2L14.6 10.2L15.8 12H17" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
    </Svg>
  );
}
