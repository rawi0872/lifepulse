import { useId } from "react";
import { cn } from "@/lib/utils";

interface LifePulseLogoProps {
  variant?: "default" | "mark" | "compact";
  size?: "sm" | "md" | "lg";
  className?: string;
  showWordmark?: boolean;
}

const sizeMap = {
  sm: { container: "h-6 w-6", viewBox: "0 0 24 24" },
  md: { container: "h-8 w-8", viewBox: "0 0 24 24" },
  lg: { container: "h-10 w-10", viewBox: "0 0 24 24" },
};

function PulseMark({ className }: { className?: string }) {
  // Same geometry as the official Life Pulse mark (public/icon.svg), drawn
  // inline so tile + pulse follow the active theme via --brand-* tokens.
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={cn("h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`${uid}-tile`} x1="92" y1="72" x2="420" y2="440" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-tile-from)" />
          <stop offset="1" stopColor="var(--brand-tile-to)" />
        </linearGradient>
        <linearGradient id={`${uid}-pulse`} x1="104" y1="258" x2="408" y2="258" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-pulse-1)" />
          <stop offset="0.52" stopColor="var(--brand-pulse-2)" />
          <stop offset="1" stopColor="var(--brand-pulse-3)" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${uid}-tile)`} stroke="var(--brand-tile-border)" strokeWidth="10" />
      <circle cx="256" cy="256" r="178" fill="none" stroke="var(--brand-ring)" strokeWidth="24" />
      <path d="M104 266h64l34-78 62 150 48-104 26 32h70" fill="none" stroke={`url(#${uid}-pulse)`} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="256" cy="256" r="18" fill="var(--brand-dot)" fillOpacity="0.9" />
    </svg>
  );
}

export function LifePulseLogo({
  variant = "default",
  size = "md",
  className,
  showWordmark = true,
}: LifePulseLogoProps) {
  const dims = sizeMap[size];

  // Mark-only variant
  if (variant === "mark") {
    return (
      <div className={cn("relative flex items-center justify-center", dims.container, className)}>
        <PulseMark />
      </div>
    );
  }

  // Compact variant (small icon + wordmark, no subtitle)
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn("relative flex items-center justify-center", dims.container)}>
          <PulseMark />
        </div>
        {showWordmark && (
          <span className={cn(
            "font-semibold tracking-tight text-[var(--text)]",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-base",
          )}>
            Life Pulse
          </span>
        )}
      </div>
    );
  }

  // Default variant (icon + wordmark + subtitle)
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("relative flex items-center justify-center", dims.container)}>
        <PulseMark />
      </div>
      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <span className={cn(
            "font-semibold tracking-tight text-[var(--text)]",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-base",
          )}>
            Life Pulse
          </span>
          <span className={cn(
            "font-medium uppercase text-[var(--text-muted)]",
            size === "sm" && "text-[8px] tracking-[0.1em]",
            size === "md" && "text-[9px] tracking-[0.12em]",
            size === "lg" && "text-[10px] tracking-[0.14em]",
          )}>
            Personal OS
          </span>
        </div>
      )}
    </div>
  );
}
