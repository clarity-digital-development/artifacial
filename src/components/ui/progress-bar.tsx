"use client";

interface ProgressBarProps {
  progress: number; // 0-100
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  progress,
  animated = false,
  className = "",
}: ProgressBarProps) {
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--bg-elevated)] ${className}`}
    >
      <div
        className={`h-full rounded-[var(--radius-full)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          animated
            ? "animate-amber-sweep bg-gradient-to-r from-[var(--accent-amber-dim)] via-[var(--accent-amber)] to-[var(--accent-amber-dim)] bg-[length:200%_100%]"
            : "bg-[var(--accent-amber)]"
        }`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
