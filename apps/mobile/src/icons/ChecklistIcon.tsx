import React from "react";
import { Svg, Path } from "react-native-svg";

// Checklist — two small checks + two equal task lines, optically balanced.
export function ChecklistIcon({ size = 22, color = "currentColor", ...props }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      {/* check 1 */}
      <Path d="M5.5 8.2L7.4 10.1L10.2 6.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      {/* line 1 */}
      <Path d="M12.5 8.2H19" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      {/* check 2 */}
      <Path d="M5.5 15.2L7.4 17.1L10.2 13.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      {/* line 2 */}
      <Path d="M12.5 15.2H19" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
