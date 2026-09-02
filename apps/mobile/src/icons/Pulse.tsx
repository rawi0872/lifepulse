import React from 'react';
import { Svg, Path } from 'react-native-svg';

export function Pulse({ size = 22, color = 'currentColor', ...props }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M4 12s4-8 8-8 8 8 8 8-4 8-8 8-8-8-8-8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
      />
      <Path
        d="M4 12s3-5 5-5 5 5 5 5 3 5 5 5 3-5 5-5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
        strokeDashoffset="0"
      />
      <Path
        d="M9 12h2v-4h-2v4zm4 0h2v-6h-2v6zm4 0h2v-2h-2v2z"
        fill={color}
        opacity="0.9"
      />
    </Svg>
  );
}