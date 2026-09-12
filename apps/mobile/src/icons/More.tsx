import React from "react";
import { Svg, Circle } from "react-native-svg";

// More - horizontal ellipsis (three dots), optically balanced with the
// existing 22px tab icon set. Filled dots read well at small sizes.
export function More({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Circle cx="5" cy="12" r="1.8" fill={color} />
      <Circle cx="12" cy="12" r="1.8" fill={color} />
      <Circle cx="19" cy="12" r="1.8" fill={color} />
    </Svg>
  );
}
