import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({
  hover = false,
  glow = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.3),0_0_1px_rgba(232,166,52,0.05)] ${
        hover
          ? "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:scale-[1.02] hover:border-[var(--accent-amber)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_24px_rgba(232,166,52,0.12)]"
          : ""
      } ${
        glow
          ? "border-[var(--accent-amber)] shadow-[0_0_24px_rgba(232,166,52,0.12)]"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
