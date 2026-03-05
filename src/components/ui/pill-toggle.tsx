"use client";

interface PillToggleProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PillToggle({
  options,
  value,
  onChange,
  className = "",
}: PillToggleProps) {
  return (
    <div
      className={`inline-flex rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--bg-input)] p-1 ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[var(--radius-full)] px-4 py-1.5 text-[var(--text-sm)] font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            value === opt.value
              ? "bg-[var(--accent-amber)] text-[var(--bg-deep)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
