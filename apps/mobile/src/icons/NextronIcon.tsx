import React from "react";
import { Svg, Path, Defs, LinearGradient, Stop, Ellipse } from "react-native-svg";

// NEXTRON — orbital N mark
// mono: clean monochrome (nav, 22px) — single color, no glow
// brand: premium orbit gradient + luminous N (header 28px, empty 40px+)
type Props = { size?: number; color?: string; variant?: "mono" | "brand" };

export function NextronIcon({ size = 22, color = "currentColor", variant = "mono", ...props }: Props) {
  const isBrand = variant === "brand";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      {isBrand && (
        <Defs>
          <LinearGradient id="nx-orbit" x1="2" y1="8" x2="22" y2="16" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#312e81" stopOpacity={1} />
            <Stop offset="45%" stopColor="#2563eb" stopOpacity={1} />
            <Stop offset="100%" stopColor="#06b6d4" stopOpacity={1} />
          </LinearGradient>
        </Defs>
      )}

      {/* Orbital ring — tilted ellipse wrapping the N, futuristic swoosh */}
      <Ellipse
        cx={12}
        cy={12}
        rx={9.8}
        ry={5.6}
        fill="none"
        stroke={isBrand ? "url(#nx-orbit)" : color}
        strokeWidth={isBrand ? 1.35 : 1.15}
        strokeLinecap="round"
        opacity={isBrand ? 1 : 0.9}
        transform="rotate(-14 12 12)"
      />
      {/* Second inner orbit hint — very subtle, only brand */}
      {isBrand && (
        <Ellipse
          cx={12}
          cy={12}
          rx={7.2}
          ry={3.9}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={0.7}
          strokeLinecap="round"
          opacity={0.22}
          transform="rotate(-14 12 12)"
        />
      )}

      {/* Geometric N — bold, premium, unmistakable at 22px */}
      <Path
        d="M7 6.6 L7 17.4 L9.95 17.4 L9.95 10.05 L14.05 17.4 L17 17.4 L17 6.6 L14.05 6.6 L14.05 13.95 L9.95 6.6 Z"
        fill={isBrand ? "#e0f2fe" : color}
        stroke={isBrand ? "#e0f2fe" : "none"}
        strokeWidth={isBrand ? 0.35 : 0}
        strokeLinejoin="round"
      />
      {/* N inner bevel highlight — brand only, subtle depth */}
      {isBrand && (
        <Path
          d="M7 6.6 L9.95 6.6 L14.05 13.95 L14.05 6.6"
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.18}
        />
      )}
    </Svg>
  );
}
