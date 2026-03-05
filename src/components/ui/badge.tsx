import { type HTMLAttributes } from "react";

type BadgeVariant = "default" | "amber" | "success" | "error";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  amber:
    "bg-[var(--accent-amber-glow)] text-[var(--accent-amber)] border-[var(--accent-amber)]/20",
  success:
    "bg-[rgba(74,222,128,0.1)] text-[var(--success)] border-[var(--success)]/20",
  error:
    "bg-[rgba(239,68,68,0.1)] text-[var(--error)] border-[var(--error)]/20",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-[var(--text-xs)] font-medium ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
