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
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("h-full w-full", className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.85" />
      <path d="M12 3a9 9 0 016.364 2.636" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
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
