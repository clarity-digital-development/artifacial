"use client";

import { useState } from "react";

export function CopyFieldClient({
  value,
  label,
  mono,
}: {
  value: string;
  label: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5">
        <span
          className={`truncate text-sm text-[var(--text-primary)] ${
            mono ? "font-mono tracking-wide" : ""
          }`}
        >
          {value}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        {copied ? (
          <span className="text-[var(--success)]">Copied!</span>
        ) : (
          `Copy ${label}`
        )}
      </button>
    </div>
  );
}
