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
  // Single source of truth: official Life Pulse logo asset (public/icon.svg)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.svg"
      alt=""
      aria-hidden="true"
      className={cn("h-full w-full object-contain", className)}
      draggable={false}
    />
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
